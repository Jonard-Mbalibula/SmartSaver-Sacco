/**
 * Server Actions - SECURITY HARDENED
 * 
 * CRITICAL SECURITY RULES:
 * 1. Every privileged action MUST call requireAdmin() first
 * 2. Every sensitive operation MUST be audit logged
 * 3. Never trust user_metadata.role for authorization
 * 4. Always validate inputs server-side
 * 5. Use service-role only after authorization check
 * 
 * Version: 2.0 - Security Remediation Complete
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  createSupabaseServerClient,
  createSupabaseAuthClient,
  hasSupabaseConfig
} from "@/lib/supabase";
import { requireAdmin, requireAuth, getAuthenticatedUser, getUserProfile } from "@/lib/authorization";
import { auditLog, logUnauthorizedAttempt } from "@/lib/audit";
import { getRoleFromUser } from "@/lib/roles";
import { checkLoanEligibility, canMemberApplyForLoan } from "@/lib/loan-eligibility";
import type { ActionResult } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireSupabase() {
  // Production fail-closed check
  if (process.env.NODE_ENV === "production" && !hasSupabaseConfig()) {
    throw new Error(
      "FATAL: Database not configured in production. " +
      "Application cannot run without proper database connection. " +
      "Please configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  
  if (!hasSupabaseConfig()) {
    throw new Error("Connect Supabase before saving live records.");
  }
  
  return createSupabaseServerClient();
}

function requiredText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function requiredNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${key} must be greater than 0.`);
  return value;
}

// New helper for monetary amounts - preserves precision by keeping as string
function requiredMonetaryAmount(formData: FormData, key: string) {
  const rawValue = String(formData.get(key) ?? "").trim();
  const numValue = Number(rawValue);
  
  if (!Number.isFinite(numValue) || numValue <= 0)
    throw new Error(`${key} must be greater than 0.`);
  
  // Validate it's a valid decimal number with max 2 decimal places
  if (!/^\d+(\.\d{1,2})?$/.test(rawValue)) {
    throw new Error(`${key} must be a valid amount (max 2 decimal places).`);
  }
  
  // Return the string representation to avoid JavaScript floating-point precision issues
  // PostgreSQL numeric type will handle the conversion correctly
  return rawValue;
}

async function getOrigin() {
  const supabase = await createSupabaseAuthClient();
  const { data } = await supabase.auth.getSession();
  
  // Try to get from session metadata first
  if (data.session) {
    const host = process.env.NEXT_PUBLIC_SITE_URL;
    if (host) return host;
  }
  
  // Fallback to localhost for development
  return "http://localhost:3000";
}

// ---------------------------------------------------------------------------
// Auth — Sign In
// ---------------------------------------------------------------------------

export async function loginAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    // Log failed login attempt
    await auditLog("LOGIN_FAILED", {
      reason: "Missing email or password",
      metadata: { email }
    });
    return { success: false, error: "Email and password are required." };
  }

  const supabase = await createSupabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await auditLog("LOGIN_FAILED", {
      reason: error.message,
      metadata: { email }
    });
    return { success: false, error: error.message };
  }
  
  if (!data.user) {
    await auditLog("LOGIN_FAILED", {
      reason: "No user returned",
      metadata: { email }
    });
    return { success: false, error: "Login failed — no user returned." };
  }

  // Log successful login
  await auditLog("LOGIN", {
    actor: data.user.id,
    metadata: { email }
  });

  // Check role from database (authoritative source)
  const db = createSupabaseServerClient();
  const { data: profile } = await db
    .from("user_profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const role = profile?.role || "member";
  
  if (role === "admin") {
    redirect("/dashboard");
  } else {
    redirect("/member");
  }
}

// ---------------------------------------------------------------------------
// Auth — Register
// ---------------------------------------------------------------------------

export async function registerAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const email = requiredText(formData, "email");
    const password = requiredText(formData, "password");
    const confirm = requiredText(formData, "confirm");
    const fullName = requiredText(formData, "full_name");

    if (password !== confirm) return { success: false, error: "Passwords do not match." };
    if (password.length < 8)
      return { success: false, error: "Password must be at least 8 characters." };

    const supabase = await createSupabaseAuthClient();
    
    // NOTE: Even if user tries to set role='admin' in user_metadata,
    // the database trigger will create user_profiles with role='member'
    // Admin role can ONLY be granted via direct database update
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { 
          full_name: fullName
          // DO NOT pass role here - database trigger sets it to 'member'
        },
        emailRedirectTo: `${await getOrigin()}/auth-callback`
      }
    });

    if (error) return { success: false, error: error.message };
    
    // Log user registration
    if (data.user) {
      await auditLog("MEMBER_CREATED", {
        actor: data.user.id,
        entity_type: "user",
        entity_id: data.user.id,
        new_value: { email, full_name: fullName },
        reason: "Self-registration"
      });
    }
    
    return {
      success: true,
      message: "Account created! Check your email to confirm before signing in."
    };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Auth — Forgot Password
// ---------------------------------------------------------------------------

export async function forgotPasswordAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const email = requiredText(formData, "email");
    const supabase = await createSupabaseAuthClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${await getOrigin()}/reset-password`
    });
    
    if (error) return { success: false, error: error.message };
    
    // Log password reset request (without user_id since they're not authenticated)
    await auditLog("PASSWORD_RESET_REQUESTED", {
      metadata: { email }
    });
    
    return {
      success: true,
      message: "Password reset link sent! Check your inbox (and spam folder)."
    };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Auth — Reset Password
// ---------------------------------------------------------------------------

export async function resetPasswordAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const password = requiredText(formData, "password");
    const confirm = requiredText(formData, "confirm");
    
    if (password !== confirm) return { success: false, error: "Passwords do not match." };
    if (password.length < 8)
      return { success: false, error: "Password must be at least 8 characters." };

    const supabase = await createSupabaseAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { success: false, error: error.message };
    
    // Log password reset completion
    if (user) {
      await auditLog("PASSWORD_RESET_COMPLETED", {
        actor: user.id,
        entity_type: "user",
        entity_id: user.id
      });
    }
    
    return { success: true, message: "Password updated. You can now sign in." };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Auth — Sign Out  (global scope = invalidates ALL sessions on all devices)
// ---------------------------------------------------------------------------

export async function logoutAction(): Promise<void> {
  try {
    const supabase = await createSupabaseAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // "global" scope revokes the refresh token server-side — the session
    // cannot be reused even if the cookie is still present in the browser.
    await supabase.auth.signOut({ scope: "global" });
    
    // Log logout
    if (user) {
      await auditLog("LOGOUT", {
        actor: user.id,
        entity_type: "user",
        entity_id: user.id
      });
    }
  } catch {
    // Always redirect to login even if signOut call fails
  }
  // Redirect to a clean /login — no `next` param, no auto-redirect
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Admin — Assign role
// ⚠️ CRITICAL: This grants/revokes admin privileges
// ---------------------------------------------------------------------------

export async function assignRole(
  userId: string,
  role: "admin" | "member"
): Promise<ActionResult> {
  try {
    // 🔒 AUTHORIZATION CHECK
    const { user: adminUser, profile: adminProfile } = await requireAdmin();
    
    // Validate inputs
    if (!["admin", "member"].includes(role)) {
      return { success: false, error: "Invalid role" };
    }
    
    const supabase = requireSupabase();
    
    // Get current role for audit log
    const { data: targetProfile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", userId)
      .single();
    
    const oldRole = targetProfile?.role || "unknown";
    
    // Update role in user_profiles (authoritative source)
    const { error: profileError } = await supabase
      .from("user_profiles")
      .upsert({ id: userId, role }, { onConflict: "id" });
    
    if (profileError) return { success: false, error: profileError.message };
    
    // Also update user_metadata for backward compatibility (but this is NOT used for auth)
    const { error: metaError } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { role }
    });
    
    if (metaError) {
      console.warn("Failed to update user_metadata (non-critical):", metaError.message);
    }
    
    // 📝 AUDIT LOG
    await auditLog("ROLE_CHANGED", {
      actor: adminUser.id,
      actor_role: adminProfile.role,
      entity_type: "user_profile",
      entity_id: userId,
      old_value: { role: oldRole },
      new_value: { role },
      reason: `Admin ${adminUser.email} changed user role from ${oldRole} to ${role}`
    });

    return { 
      success: true, 
      message: `Role updated to ${role}. User must sign out and back in for changes to take effect.` 
    };
  } catch (err) {
    // Log unauthorized attempt
    if ((err as Error).message.includes("Unauthorized")) {
      await logUnauthorizedAttempt("assignRole", {
        metadata: { target_user: userId, attempted_role: role }
      });
    }
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Admin — Link user to member record
// ---------------------------------------------------------------------------

export async function linkUserToMember(
  userId: string,
  memberId: string
): Promise<ActionResult> {
  try {
    // 🔒 AUTHORIZATION CHECK
    const { user: adminUser, profile: adminProfile } = await requireAdmin();
    
    const supabase = requireSupabase();
    
    // Verify member exists
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("full_name")
      .eq("id", memberId)
      .single();
    
    if (memberError || !member) {
      return { success: false, error: "Member not found" };
    }
    
    // Get old linkage for audit
    const { data: oldProfile } = await supabase
      .from("user_profiles")
      .select("member_id")
      .eq("id", userId)
      .single();
    
    // Update linkage
    const { error } = await supabase
      .from("user_profiles")
      .upsert({ 
        id: userId, 
        member_id: memberId, 
        role: "member" // Linked users are always members
      }, { onConflict: "id" });
      
    if (error) return { success: false, error: error.message };
    
    // 📝 AUDIT LOG
    await auditLog("USER_LINKED_TO_MEMBER", {
      actor: adminUser.id,
      actor_role: adminProfile.role,
      entity_type: "user_profile",
      entity_id: userId,
      old_value: { member_id: oldProfile?.member_id },
      new_value: { member_id: memberId },
      reason: `Linked user to member: ${member.full_name}`
    });

    revalidatePath("/dashboard");
    return { success: true, message: `User linked to member ${member.full_name}.` };
  } catch (err) {
    if ((err as Error).message.includes("Unauthorized")) {
      await logUnauthorizedAttempt("linkUserToMember", {
        metadata: { user_id: userId, member_id: memberId }
      });
    }
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Admin — Add Member
// ---------------------------------------------------------------------------

export async function addMember(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    // 🔒 AUTHORIZATION CHECK
    const { user: adminUser, profile: adminProfile } = await requireAdmin();
    
    const supabase = requireSupabase();
    const fullName = requiredText(formData, "full_name");
    const phone = requiredText(formData, "phone");
    const nationalId = String(formData.get("national_id") ?? "").trim() || null;

    // Validate phone format (basic check)
    if (phone.length < 10) {
      return { success: false, error: "Phone number must be at least 10 digits" };
    }
    
    // Check for duplicate phone
    const { data: existing } = await supabase
      .from("members")
      .select("id")
      .eq("phone", phone)
      .single();
    
    if (existing) {
      return { success: false, error: "A member with this phone number already exists" };
    }

    const { data: newMember, error } = await supabase
      .from("members")
      .insert({ 
        full_name: fullName, 
        phone, 
        national_id: nationalId,
        created_by_user_id: adminUser.id
      })
      .select()
      .single();
      
    if (error) return { success: false, error: error.message };
    
    // 📝 AUDIT LOG
    await auditLog("MEMBER_CREATED", {
      actor: adminUser.id,
      actor_role: adminProfile.role,
      entity_type: "member",
      entity_id: newMember.id,
      new_value: { full_name: fullName, phone, national_id: nationalId },
      reason: "Admin created new member record"
    });

    revalidatePath("/dashboard");
    return { success: true, message: `Member "${fullName}" registered successfully.` };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if ((err as Error).message.includes("Unauthorized")) {
      await logUnauthorizedAttempt("addMember");
    }
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Admin — Update Member Status
// ---------------------------------------------------------------------------

export async function updateMemberStatus(
  memberId: string,
  status: "active" | "paused" | "closed" | "archived",
  reason?: string
): Promise<ActionResult> {
  try {
    // 🔒 AUTHORIZATION CHECK
    const { user: adminUser, profile: adminProfile } = await requireAdmin();
    
    const supabase = requireSupabase();
    
    // Get current status for audit
    const { data: member, error: fetchError } = await supabase
      .from("members")
      .select("full_name, status")
      .eq("id", memberId)
      .single();
    
    if (fetchError || !member) {
      return { success: false, error: "Member not found" };
    }
    
    const { error } = await supabase
      .from("members")
      .update({ 
        status,
        closure_reason: status === "closed" || status === "archived" ? reason : null,
        updated_by_user_id: adminUser.id
      })
      .eq("id", memberId);
      
    if (error) return { success: false, error: error.message };
    
    // 📝 AUDIT LOG
    await auditLog("MEMBER_STATUS_CHANGED", {
      actor: adminUser.id,
      actor_role: adminProfile.role,
      entity_type: "member",
      entity_id: memberId,
      old_value: { status: member.status },
      new_value: { status },
      reason: reason || `Status changed from ${member.status} to ${status}`,
      metadata: { member_name: member.full_name }
    });

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/members/${memberId}`);
    return { success: true, message: `Member status updated to ${status}.` };
  } catch (err) {
    if ((err as Error).message.includes("Unauthorized")) {
      await logUnauthorizedAttempt("updateMemberStatus", {
        metadata: { member_id: memberId, attempted_status: status }
      });
    }
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Admin — Close/Archive Member (REPLACES deleteMember)
// ⚠️ This function replaces the dangerous deleteMember function
// Members with financial history can NEVER be deleted - only closed/archived
// ---------------------------------------------------------------------------

export async function closeMemberAccount(
  memberId: string,
  reason: string
): Promise<ActionResult> {
  try {
    // 🔒 AUTHORIZATION CHECK
    const { user: adminUser, profile: adminProfile } = await requireAdmin();
    
    if (!reason || reason.trim().length < 10) {
      return { 
        success: false, 
        error: "Closure reason required (minimum 10 characters)" 
      };
    }
    
    const supabase = requireSupabase();
    
    // Get member info
    const { data: member } = await supabase
      .from("members")
      .select("full_name, status")
      .eq("id", memberId)
      .single();
    
    if (!member) {
      return { success: false, error: "Member not found" };
    }
    
    // Check for financial activity
    const { count: txCount } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("member_id", memberId);
    
    const hasFinancialHistory = (txCount || 0) > 0;
    
    if (hasFinancialHistory) {
      // Has financial history - can only close, not delete
      const { error } = await supabase
        .from("members")
        .update({ 
          status: "closed",
          closure_reason: reason,
          updated_by_user_id: adminUser.id
        })
        .eq("id", memberId);
      
      if (error) return { success: false, error: error.message };
      
      // 📝 AUDIT LOG
      await auditLog("MEMBER_CLOSED", {
        actor: adminUser.id,
        actor_role: adminProfile.role,
        entity_type: "member",
        entity_id: memberId,
        old_value: { status: member.status },
        new_value: { status: "closed" },
        reason,
        metadata: { 
          member_name: member.full_name,
          financial_records_preserved: true 
        }
      });
      
      revalidatePath("/dashboard");
      return { 
        success: true, 
        message: `Member account closed. All financial records have been preserved for audit compliance.` 
      };
    }
    
    // No financial activity - can archive
    const { error } = await supabase
      .from("members")
      .update({ 
        status: "archived",
        closure_reason: reason,
        updated_by_user_id: adminUser.id
      })
      .eq("id", memberId);
    
    if (error) return { success: false, error: error.message };
    
    // 📝 AUDIT LOG
    await auditLog("MEMBER_ARCHIVED", {
      actor: adminUser.id,
      actor_role: adminProfile.role,
      entity_type: "member",
      entity_id: memberId,
      old_value: { status: member.status },
      new_value: { status: "archived" },
      reason,
      metadata: { member_name: member.full_name }
    });
    
    revalidatePath("/dashboard");
    return { 
      success: true, 
      message: "Member account archived successfully." 
    };
  } catch (err) {
    if ((err as Error).message.includes("Unauthorized")) {
      await logUnauthorizedAttempt("closeMemberAccount", {
        metadata: { member_id: memberId }
      });
    }
    return { success: false, error: (err as Error).message };
  }
}

// DEPRECATED: deleteMember - DO NOT USE
// Use closeMemberAccount instead
export async function deleteMember(memberId: string): Promise<ActionResult> {
  // Log the attempt to use deprecated function
  await auditLog("TRANSACTION_DELETED_ATTEMPT", {
    entity_type: "member",
    entity_id: memberId,
    reason: "Attempted to use deprecated deleteMember function"
  });
  
  return {
    success: false,
    error: "Member deletion is disabled. Use member status management instead (close/archive)."
  };
}

// ---------------------------------------------------------------------------
// Admin — Record Transaction
// ---------------------------------------------------------------------------

export async function recordTransaction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    // 🔒 AUTHORIZATION CHECK
    const { user: adminUser, profile: adminProfile } = await requireAdmin();
    
    const supabase = requireSupabase();
    const memberId = requiredText(formData, "member_id");
    const type = requiredText(formData, "type");
    const amount = requiredMonetaryAmount(formData, "amount");
    const memo = String(formData.get("memo") ?? "").trim() || null;
    const loanId = String(formData.get("loan_id") ?? "").trim() || null;
    
    // 🔍 DIAGNOSTIC: Log the raw amount value to investigate precision issues
    console.log("💰 Transaction amount received:", {
      raw: formData.get("amount"),
      processed: amount,
      type: typeof amount
    });
    
    // Validate transaction type
    const validTypes = ["deposit", "withdrawal", "loan_payment", "fee", "adjustment"];
    if (!validTypes.includes(type)) {
      return { success: false, error: "Invalid transaction type" };
    }
    
    // Validate loan_payment requires loan_id
    if (type === "loan_payment" && !loanId) {
      return { success: false, error: "Loan repayment must be linked to a specific loan" };
    }
    
    // Verify member exists and is active
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("full_name, status")
      .eq("id", memberId)
      .single();
    
    if (memberError || !member) {
      return { success: false, error: "Member not found" };
    }
    
    if (member.status === "closed" || member.status === "archived") {
      return { 
        success: false, 
        error: `Cannot record transactions for ${member.status} accounts` 
      };
    }
    
    // 🛡️ DUPLICATE DETECTION - Check for similar transaction in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentTx } = await supabase
      .from("transactions")
      .select("id, txn_reference, posted_at")
      .eq("member_id", memberId)
      .eq("type", type)
      .eq("amount", amount)
      .gte("posted_at", fiveMinutesAgo)
      .limit(1);
    
    if (recentTx && recentTx.length > 0) {
      const minutesAgo = Math.floor(
        (Date.now() - new Date(recentTx[0].posted_at).getTime()) / (1000 * 60)
      );
      return {
        success: false,
        error: `⚠️ Potential duplicate: Similar transaction ${recentTx[0].txn_reference} was posted ${minutesAgo} minute(s) ago. Please verify this is not a duplicate entry.`
      };
    }

    // Insert transaction (txn_reference is auto-generated by trigger)
    const { data: newTx, error } = await supabase
      .from("transactions")
      .insert({ 
        member_id: memberId, 
        type, 
        amount,
        memo,
        loan_id: loanId,
        recorded_by_user_id: adminUser.id,
        status: "posted"
      })
      .select()
      .single();
      
    if (error) return { success: false, error: error.message };
    
    // 📝 AUDIT LOG
    await auditLog("TRANSACTION_RECORDED", {
      actor: adminUser.id,
      actor_role: adminProfile.role,
      entity_type: "transaction",
      entity_id: newTx.id,
      new_value: {
        txn_reference: newTx.txn_reference,
        member: member.full_name,
        type,
        amount,
        memo
      },
      reason: memo || `${type} transaction recorded`,
      metadata: { member_id: memberId, member_name: member.full_name }
    });

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/members/${memberId}`);
    return { 
      success: true, 
      message: `Transaction ${newTx.txn_reference} posted successfully.` 
    };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if ((err as Error).message.includes("Unauthorized")) {
      await logUnauthorizedAttempt("recordTransaction");
    }
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Admin — Reverse Transaction (NEW - replaces destructive edits)
// ---------------------------------------------------------------------------

export async function reverseTransaction(
  txnId: string,
  reason: string
): Promise<ActionResult> {
  try {
    // 🔒 AUTHORIZATION CHECK
    const { user: adminUser, profile: adminProfile } = await requireAdmin();
    
    if (!reason || reason.trim().length < 10) {
      return { 
        success: false, 
        error: "Reversal reason required (minimum 10 characters)" 
      };
    }
    
    const supabase = requireSupabase();
    
    // Fetch original transaction
    const { data: original, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", txnId)
      .single();
    
    if (fetchError || !original) {
      return { success: false, error: "Transaction not found" };
    }
    
    if (original.status === "reversed") {
      return { success: false, error: "Transaction has already been reversed" };
    }
    
    // Create reversal transaction (offsetting entry)
    const { data: reversal, error: revError } = await supabase
      .from("transactions")
      .insert({
        member_id: original.member_id,
        account_id: original.account_id,
        loan_id: original.loan_id,
        type: original.type,
        amount: -1 * Number(original.amount), // Negative amount to offset
        memo: `REVERSAL: ${reason}`,
        reverses_txn_id: original.id,
        status: "reversal",
        recorded_by_user_id: adminUser.id
      })
      .select()
      .single();
    
    if (revError) {
      return { success: false, error: revError.message };
    }
    
    // Mark original as reversed
    await supabase
      .from("transactions")
      .update({ 
        status: "reversed",
        reversed_by_txn_id: reversal.id,
        reversal_reason: reason
      })
      .eq("id", original.id);
    
    // 📝 AUDIT LOG
    await auditLog("TRANSACTION_REVERSED", {
      actor: adminUser.id,
      actor_role: adminProfile.role,
      entity_type: "transaction",
      entity_id: original.id,
      old_value: {
        txn_reference: original.txn_reference,
        status: original.status,
        amount: original.amount
      },
      new_value: {
        reversal_reference: reversal.txn_reference,
        status: "reversed",
        reversal_amount: reversal.amount
      },
      reason,
      metadata: { member_id: original.member_id }
    });
    
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/members/${original.member_id}`);
    return { 
      success: true, 
      message: `Transaction reversed successfully. Original: ${original.txn_reference}, Reversal: ${reversal.txn_reference}` 
    };
  } catch (err) {
    if ((err as Error).message.includes("Unauthorized")) {
      await logUnauthorizedAttempt("reverseTransaction", {
        metadata: { txn_id: txnId }
      });
    }
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Admin — Create Loan (admin-initiated)
// ---------------------------------------------------------------------------

export async function createLoan(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    // 🔒 AUTHORIZATION CHECK
    const { user: adminUser, profile: adminProfile } = await requireAdmin();
    
    const supabase = requireSupabase();
    const memberId = requiredText(formData, "member_id");
    const principal = requiredMonetaryAmount(formData, "principal");
    const interestRate = requiredNumber(formData, "interest_rate");
    const termMonths = requiredNumber(formData, "term_months");
    
    // 🛡️ SERVER-SIDE VALIDATION
    if (interestRate < 0 || interestRate > 50) {
      return { 
        success: false, 
        error: "Interest rate must be between 0% and 50%" 
      };
    }
    
    if (termMonths < 1 || termMonths > 60) {
      return { 
        success: false, 
        error: "Loan term must be between 1 and 60 months" 
      };
    }
    
    // Verify member exists
    const { data: member } = await supabase
      .from("members")
      .select("full_name, status")
      .eq("id", memberId)
      .single();
    
    if (!member) {
      return { success: false, error: "Member not found" };
    }
    
    if (member.status !== "active") {
      return { success: false, error: "Loans can only be created for active members" };
    }

    const { data: newLoan, error } = await supabase
      .from("loans")
      .insert({
        member_id: memberId,
        principal,
        interest_rate: interestRate,
        term_months: termMonths,
        status: "pending"
      })
      .select()
      .single();
      
    if (error) return { success: false, error: error.message };
    
    // 📝 AUDIT LOG
    await auditLog("LOAN_CREATED", {
      actor: adminUser.id,
      actor_role: adminProfile.role,
      entity_type: "loan",
      entity_id: newLoan.id,
      new_value: {
        member: member.full_name,
        principal,
        interest_rate: interestRate,
        term_months: termMonths
      },
      reason: "Admin created loan application",
      metadata: { member_id: memberId, member_name: member.full_name }
    });

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/members/${memberId}`);
    return { success: true, message: "Loan request created successfully." };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if ((err as Error).message.includes("Unauthorized")) {
      await logUnauthorizedAttempt("createLoan");
    }
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Member — Apply for Loan (with comprehensive eligibility checking)
// ---------------------------------------------------------------------------

export async function applyForLoan(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    // 🔒 AUTHORIZATION CHECK (any authenticated user can apply)
    const { user, profile } = await requireAuth();
    
    const supabase = requireSupabase();

    // Verify user is linked to a member record
    if (!profile.member_id) {
      return {
        success: false,
        error: "Your account is not linked to a member record. Contact an admin."
      };
    }
    
    // Get member info
    const { data: member } = await supabase
      .from("members")
      .select("full_name, status")
      .eq("id", profile.member_id)
      .single();
    
    if (!member) {
      return { success: false, error: "Member record not found" };
    }
    
    if (member.status !== "active") {
      return { 
        success: false, 
        error: `Cannot apply for loans with ${member.status} account status` 
      };
    }

    const principal = requiredNumber(formData, "principal");
    const termMonths = requiredNumber(formData, "term_months");
    const productId = String(formData.get("loan_product_id") ?? "").trim() || undefined;
    
    // Basic validation
    if (principal < 10000) {
      return { success: false, error: "Minimum loan amount is UGX 10,000" };
    }
    
    if (termMonths < 1 || termMonths > 24) {
      return { success: false, error: "Loan term must be between 1 and 24 months" };
    }

    // 🛡️ COMPREHENSIVE ELIGIBILITY CHECK
    const eligibility = await checkLoanEligibility(
      profile.member_id,
      principal,
      termMonths,
      productId
    );
    
    if (!eligibility.eligible) {
      return {
        success: false,
        error: eligibility.reasons.join(" ")
      };
    }

    // Insert loan application (interest_rate is NULL - admin sets on approval)
    const { data: newLoan, error } = await supabase
      .from("loans")
      .insert({
        member_id: profile.member_id,
        loan_product_id: productId || null,
        principal,
        term_months: termMonths,
        status: "pending"
        // interest_rate: null (default) — admin sets when approving
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    
    // 📝 AUDIT LOG
    await auditLog("LOAN_APPLIED", {
      actor: user.id,
      actor_role: profile.role,
      entity_type: "loan",
      entity_id: newLoan.id,
      new_value: {
        member: member.full_name,
        principal,
        term_months: termMonths,
        product_id: productId
      },
      reason: "Member submitted loan application",
      metadata: { 
        member_id: profile.member_id, 
        member_name: member.full_name,
        max_eligible_amount: eligibility.maxLoanAmount 
      }
    });

    revalidatePath("/member");
    return {
      success: true,
      message: "Loan application submitted successfully. An administrator will review and set the interest rate."
    };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Admin — Approve Loan
// ---------------------------------------------------------------------------

export async function approveLoan(
  loanId: string,
  interestRate: number
): Promise<ActionResult> {
  try {
    // 🔒 AUTHORIZATION CHECK
    const { user: adminUser, profile: adminProfile } = await requireAdmin();
    
    // 🛡️ SERVER-SIDE VALIDATION
    if (!Number.isFinite(interestRate) || interestRate <= 0) {
      return { success: false, error: "Interest rate must be greater than 0" };
    }
    
    if (interestRate < 0 || interestRate > 50) {
      return { 
        success: false, 
        error: "Interest rate must be between 0% and 50%" 
      };
    }
    
    const supabase = requireSupabase();
    
    // Get loan details for audit
    const { data: loan } = await supabase
      .from("loans")
      .select("*, members(full_name)")
      .eq("id", loanId)
      .single();
    
    if (!loan) {
      return { success: false, error: "Loan not found" };
    }
    
    if (loan.status !== "pending") {
      return { 
        success: false, 
        error: `Loan is already ${loan.status}` 
      };
    }
    
    const { error } = await supabase
      .from("loans")
      .update({
        status: "approved",
        interest_rate: interestRate,
        approved_at: new Date().toISOString(),
        approved_by_user_id: adminUser.id
      })
      .eq("id", loanId);
      
    if (error) return { success: false, error: error.message };
    
    // 📝 AUDIT LOG
    await auditLog("LOAN_APPROVED", {
      actor: adminUser.id,
      actor_role: adminProfile.role,
      entity_type: "loan",
      entity_id: loanId,
      old_value: {
        status: loan.status,
        interest_rate: loan.interest_rate
      },
      new_value: {
        status: "approved",
        interest_rate: interestRate
      },
      reason: `Loan approved at ${interestRate}% interest`,
      metadata: { 
        member_id: loan.member_id,
        member_name: loan.members?.full_name,
        principal: loan.principal
      }
    });

    // 📧 SEND EMAIL NOTIFICATION
    try {
      const { sendLoanApprovedEmail } = await import("@/lib/email");
      await sendLoanApprovedEmail({
        memberId: loan.member_id,
        memberName: loan.members?.full_name || "Member",
        principal: Number(loan.principal),
        interestRate,
        termMonths: loan.term_months
      });
    } catch (emailError) {
      console.error("Failed to send approval email:", emailError);
      // Don't fail the action if email fails
    }

    revalidatePath("/dashboard");
    revalidatePath("/member");
    return { 
      success: true, 
      message: `Loan approved at ${interestRate}% interest rate.` 
    };
  } catch (err) {
    if ((err as Error).message.includes("Unauthorized")) {
      await logUnauthorizedAttempt("approveLoan", {
        metadata: { loan_id: loanId, interest_rate: interestRate }
      });
    }
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Admin — Reject Loan
// ---------------------------------------------------------------------------

export async function rejectLoan(
  loanId: string,
  reason?: string
): Promise<ActionResult> {
  try {
    // 🔒 AUTHORIZATION CHECK
    const { user: adminUser, profile: adminProfile } = await requireAdmin();
    
    const supabase = requireSupabase();
    
    // Get loan details for audit
    const { data: loan } = await supabase
      .from("loans")
      .select("*, members(full_name)")
      .eq("id", loanId)
      .single();
    
    if (!loan) {
      return { success: false, error: "Loan not found" };
    }
    
    if (loan.status !== "pending") {
      return { 
        success: false, 
        error: `Cannot reject loan that is already ${loan.status}` 
      };
    }
    
    const { error } = await supabase
      .from("loans")
      .update({ 
        status: "rejected",
        rejected_at: new Date().toISOString(),
        rejected_by_user_id: adminUser.id,
        rejection_reason: reason
      })
      .eq("id", loanId);
      
    if (error) return { success: false, error: error.message };
    
    // 📝 AUDIT LOG
    await auditLog("LOAN_REJECTED", {
      actor: adminUser.id,
      actor_role: adminProfile.role,
      entity_type: "loan",
      entity_id: loanId,
      old_value: { status: loan.status },
      new_value: { status: "rejected" },
      reason: reason || "Loan application rejected",
      metadata: { 
        member_id: loan.member_id,
        member_name: loan.members?.full_name,
        principal: loan.principal
      }
    });
    
    // 📧 SEND EMAIL NOTIFICATION
    try {
      const { sendLoanRejectedEmail } = await import("@/lib/email");
      await sendLoanRejectedEmail({
        memberId: loan.member_id,
        memberName: loan.members?.full_name || "Member",
        principal: Number(loan.principal),
        reason: reason || "Does not meet current eligibility criteria"
      });
    } catch (emailError) {
      console.error("Failed to send rejection email:", emailError);
      // Don't fail the action if email fails
    }
    
    revalidatePath("/dashboard");
    revalidatePath("/member");
    return { success: true, message: "Loan application rejected." };
  } catch (err) {
    if ((err as Error).message.includes("Unauthorized")) {
      await logUnauthorizedAttempt("rejectLoan", {
        metadata: { loan_id: loanId }
      });
    }
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Admin — Close Loan
// ---------------------------------------------------------------------------

export async function closeLoan(loanId: string): Promise<ActionResult> {
  try {
    // 🔒 AUTHORIZATION CHECK
    const { user: adminUser, profile: adminProfile } = await requireAdmin();
    
    const supabase = requireSupabase();
    
    // Get loan details for audit
    const { data: loan } = await supabase
      .from("loans")
      .select("*, members(full_name)")
      .eq("id", loanId)
      .single();
    
    if (!loan) {
      return { success: false, error: "Loan not found" };
    }
    
    if (loan.status !== "approved") {
      return { 
        success: false, 
        error: "Only approved loans can be closed" 
      };
    }
    
    const { error } = await supabase
      .from("loans")
      .update({ 
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by_user_id: adminUser.id
      })
      .eq("id", loanId);
      
    if (error) return { success: false, error: error.message };
    
    // 📝 AUDIT LOG
    await auditLog("LOAN_CLOSED", {
      actor: adminUser.id,
      actor_role: adminProfile.role,
      entity_type: "loan",
      entity_id: loanId,
      old_value: { status: loan.status },
      new_value: { status: "closed" },
      reason: "Loan marked as fully repaid and closed",
      metadata: { 
        member_id: loan.member_id,
        member_name: loan.members?.full_name,
        principal: loan.principal,
        interest_rate: loan.interest_rate
      }
    });
    
    revalidatePath("/dashboard");
    return { success: true, message: "Loan closed successfully." };
  } catch (err) {
    if ((err as Error).message.includes("Unauthorized")) {
      await logUnauthorizedAttempt("closeLoan", {
        metadata: { loan_id: loanId }
      });
    }
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Admin — Manage Loan Products
// ---------------------------------------------------------------------------

/**
 * Get all loan products (admin view)
 */
export async function getLoanProductsAdmin(): Promise<{
  success: boolean;
  products?: Array<{
    id: string;
    name: string;
    description: string | null;
    interest_rate_min: number;
    interest_rate_max: number;
    interest_rate_default: number;
    principal_min: number;
    principal_max: number;
    term_min_months: number;
    term_max_months: number;
    savings_multiplier: number;
    min_membership_days: number;
    requires_guarantor: boolean;
    is_active: boolean;
  }>;
  error?: string;
}> {
  try {
    // 🔒 AUTHORIZATION CHECK
    await requireAdmin();
    
    const supabase = requireSupabase();
    
    const { data: products, error } = await supabase
      .from("loan_products")
      .select("*")
      .order("principal_min");
    
    if (error) return { success: false, error: error.message };
    
    return { success: true, products: products || [] };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Create new loan product
 */
export async function createLoanProduct(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    // 🔒 AUTHORIZATION CHECK
    const { user, profile } = await requireAdmin();
    
    const supabase = requireSupabase();
    
    const name = requiredText(formData, "name");
    const description = String(formData.get("description") ?? "").trim() || null;
    const interestRateMin = requiredNumber(formData, "interest_rate_min");
    const interestRateMax = requiredNumber(formData, "interest_rate_max");
    const interestRateDefault = requiredNumber(formData, "interest_rate_default");
    const principalMin = requiredNumber(formData, "principal_min");
    const principalMax = requiredNumber(formData, "principal_max");
    const termMinMonths = requiredNumber(formData, "term_min_months");
    const termMaxMonths = requiredNumber(formData, "term_max_months");
    const savingsMultiplier = requiredNumber(formData, "savings_multiplier");
    const minMembershipDays = Number(formData.get("min_membership_days") || 90);
    const requiresGuarantor = formData.get("requires_guarantor") === "true";
    
    // Validation
    if (interestRateMin > interestRateMax) {
      return { success: false, error: "Minimum interest rate cannot exceed maximum" };
    }
    
    if (interestRateDefault < interestRateMin || interestRateDefault > interestRateMax) {
      return { success: false, error: "Default interest rate must be between min and max" };
    }
    
    if (principalMin > principalMax) {
      return { success: false, error: "Minimum principal cannot exceed maximum" };
    }
    
    if (termMinMonths > termMaxMonths) {
      return { success: false, error: "Minimum term cannot exceed maximum" };
    }
    
    const { data: newProduct, error } = await supabase
      .from("loan_products")
      .insert({
        name,
        description,
        interest_rate_min: interestRateMin,
        interest_rate_max: interestRateMax,
        interest_rate_default: interestRateDefault,
        principal_min: principalMin,
        principal_max: principalMax,
        term_min_months: termMinMonths,
        term_max_months: termMaxMonths,
        savings_multiplier: savingsMultiplier,
        min_membership_days: minMembershipDays,
        requires_guarantor: requiresGuarantor,
        is_active: true
      })
      .select()
      .single();
    
    if (error) return { success: false, error: error.message };
    
    // 📝 AUDIT LOG
    await auditLog("CONFIGURATION_CHANGED", {
      actor: user.id,
      actor_role: profile.role,
      entity_type: "loan_product",
      entity_id: newProduct.id,
      new_value: { name, principal_range: `${principalMin}-${principalMax}` },
      reason: "New loan product created"
    });
    
    revalidatePath("/dashboard");
    return { success: true, message: `Loan product "${name}" created successfully.` };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if ((err as Error).message.includes("Unauthorized")) {
      await logUnauthorizedAttempt("createLoanProduct");
    }
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Toggle loan product active status
 */
export async function toggleLoanProductStatus(
  productId: string,
  isActive: boolean
): Promise<ActionResult> {
  try {
    // 🔒 AUTHORIZATION CHECK
    const { user, profile } = await requireAdmin();
    
    const supabase = requireSupabase();
    
    const { data: product } = await supabase
      .from("loan_products")
      .select("name")
      .eq("id", productId)
      .single();
    
    if (!product) {
      return { success: false, error: "Loan product not found" };
    }
    
    const { error } = await supabase
      .from("loan_products")
      .update({ is_active: isActive })
      .eq("id", productId);
    
    if (error) return { success: false, error: error.message };
    
    // 📝 AUDIT LOG
    await auditLog("CONFIGURATION_CHANGED", {
      actor: user.id,
      actor_role: profile.role,
      entity_type: "loan_product",
      entity_id: productId,
      new_value: { is_active: isActive },
      reason: `Loan product "${product.name}" ${isActive ? "activated" : "deactivated"}`
    });
    
    revalidatePath("/dashboard");
    return { 
      success: true, 
      message: `Loan product ${isActive ? "activated" : "deactivated"} successfully.` 
    };
  } catch (err) {
    if ((err as Error).message.includes("Unauthorized")) {
      await logUnauthorizedAttempt("toggleLoanProductStatus");
    }
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Admin — Get Audit Logs (with pagination and filtering)
// ---------------------------------------------------------------------------

export async function getAuditLogs(options: {
  limit?: number;
  offset?: number;
  actionType?: string;
  dateFrom?: Date;
  dateTo?: Date;
}): Promise<{ logs: import("@/lib/types").AuditLog[]; total: number }> {
  try {
    // 🔒 AUTHORIZATION CHECK
    await requireAdmin();
    
    const supabase = requireSupabase();
    
    // Build query with count
    let query = supabase.from('audit_logs').select('*', { count: 'exact' });
    
    // Apply filters if provided
    if (options.actionType) {
      query = query.eq('action', options.actionType);
    }
    if (options.dateFrom) {
      query = query.gte('created_at', options.dateFrom.toISOString());
    }
    if (options.dateTo) {
      query = query.lte('created_at', options.dateTo.toISOString());
    }
    
    // Order by created_at descending
    query = query.order('created_at', { ascending: false });
    
    // Apply pagination
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    query = query.range(offset, offset + limit - 1);
    
    // Execute query
    const { data, count, error } = await query;
    
    if (error) {
      console.error('[getAuditLogs] Query error:', error);
      return { logs: [], total: 0 };
    }
    
    return { 
      logs: (data as import("@/lib/types").AuditLog[]) || [], 
      total: count || 0 
    };
  } catch (err) {
    // Log unauthorized attempt
    if ((err as Error).message.includes("Unauthorized")) {
      await logUnauthorizedAttempt("getAuditLogs");
    }
    console.error('[getAuditLogs] Error:', err);
    return { logs: [], total: 0 };
  }
}


// ---------------------------------------------------------------------------
// Admin — Bulk Upload Transactions (STUB - TODO: Implement)
// ---------------------------------------------------------------------------

export async function bulkUploadTransactions(
  formData: FormData
): Promise<ActionResult> {
  try {
    // 🔒 AUTHORIZATION CHECK
    await requireAdmin();
    
    // TODO: Implement bulk transaction upload functionality
    return {
      success: false,
      error: "Bulk upload feature is not yet implemented. Please use the single transaction form."
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
