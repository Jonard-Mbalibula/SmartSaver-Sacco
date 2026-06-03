"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { headers } from "next/headers";
import {
  createSupabaseServerClient,
  createSupabaseAuthClient,
  hasSupabaseConfig
} from "@/lib/supabase";
import { getRoleFromUser } from "@/lib/roles";
import type { ActionResult } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireSupabase() {
  if (!hasSupabaseConfig()) throw new Error("Connect Supabase before saving live records.");
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

async function getOrigin() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  return `${proto}://${host}`;
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
    return { success: false, error: "Email and password are required." };
  }

  const supabase = await createSupabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { success: false, error: error.message };
  if (!data.user) return { success: false, error: "Login failed — no user returned." };

  const role = getRoleFromUser(data.user);
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: "member" },
        emailRedirectTo: `${await getOrigin()}/auth-callback`
      }
    });

    if (error) return { success: false, error: error.message };
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
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { success: false, error: error.message };
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
    // "global" scope revokes the refresh token server-side — the session
    // cannot be reused even if the cookie is still present in the browser.
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    // Always redirect to login even if signOut call fails
  }
  // Redirect to a clean /login — no `next` param, no auto-redirect
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Admin — Assign role
// ---------------------------------------------------------------------------

export async function assignRole(
  userId: string,
  role: "admin" | "member"
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase();
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { role }
    });
    if (error) return { success: false, error: error.message };

    void supabase
      .from("user_profiles")
      .upsert({ id: userId, role }, { onConflict: "id" });

    return { success: true, message: `Role updated to ${role}. User must sign out and back in.` };
  } catch (err) {
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
    const supabase = requireSupabase();
    const { error } = await supabase
      .from("user_profiles")
      .upsert({ id: userId, member_id: memberId, role: "member" }, { onConflict: "id" });
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    return { success: true, message: "User linked to member record." };
  } catch (err) {
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
    const supabase = requireSupabase();
    const fullName = requiredText(formData, "full_name");
    const phone = requiredText(formData, "phone");
    const nationalId = String(formData.get("national_id") ?? "").trim() || null;

    const { error } = await supabase
      .from("members")
      .insert({ full_name: fullName, phone, national_id: nationalId });
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    return { success: true, message: `Member "${fullName}" registered successfully.` };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Admin — Update Member Status
// ---------------------------------------------------------------------------

export async function updateMemberStatus(
  memberId: string,
  status: "active" | "paused" | "closed"
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase();
    const { error } = await supabase
      .from("members")
      .update({ status })
      .eq("id", memberId);
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/members/${memberId}`);
    return { success: true, message: `Member status updated to ${status}.` };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Admin — Delete Member  (hard delete — cascades transactions via FK)
// ---------------------------------------------------------------------------

export async function deleteMember(memberId: string): Promise<ActionResult> {
  try {
    const supabase = requireSupabase();

    // First delete loans (FK restrict blocks cascade from members)
    await supabase.from("loans").delete().eq("member_id", memberId);
    // Then transactions
    await supabase.from("transactions").delete().eq("member_id", memberId);
    // Unlink any user_profile
    await supabase
      .from("user_profiles")
      .update({ member_id: null })
      .eq("member_id", memberId);
    // Delete the member
    const { error } = await supabase.from("members").delete().eq("id", memberId);
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    return { success: true, message: "Member account deleted." };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Admin — Record Transaction
// ---------------------------------------------------------------------------

export async function recordTransaction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase();
    const memberId = requiredText(formData, "member_id");
    const type = requiredText(formData, "type");
    const amount = requiredNumber(formData, "amount");
    const memo = String(formData.get("memo") ?? "").trim() || null;

    const { error } = await supabase
      .from("transactions")
      .insert({ member_id: memberId, type, amount, memo });
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/members/${memberId}`);
    return { success: true, message: "Transaction posted successfully." };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Admin — Create Loan (admin-initiated, interest set immediately)
// ---------------------------------------------------------------------------

export async function createLoan(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase();
    const memberId = requiredText(formData, "member_id");
    const principal = requiredNumber(formData, "principal");
    const interestRate = requiredNumber(formData, "interest_rate");
    const termMonths = requiredNumber(formData, "term_months");

    const { error } = await supabase.from("loans").insert({
      member_id: memberId,
      principal,
      interest_rate: interestRate,
      term_months: termMonths,
      status: "pending"
    });
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/members/${memberId}`);
    return { success: true, message: "Loan request created." };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Member — Apply for Loan (no interest rate — admin sets it on approval)
// ---------------------------------------------------------------------------

export async function applyForLoan(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const authClient = await createSupabaseAuthClient();
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return { success: false, error: "Not authenticated." };

    const supabase = requireSupabase();

    // Get member_id from user_profiles
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("member_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.member_id) {
      return {
        success: false,
        error: "Your account is not linked to a member record. Contact an admin."
      };
    }

    const principal = requiredNumber(formData, "principal");
    const termMonths = requiredNumber(formData, "term_months");

    // Validate: loan amount must not exceed member's savings balance
    const { data: txRows, error: txErr } = await supabase
      .from("transactions")
      .select("type, amount")
      .eq("member_id", profile.member_id);

    if (!txErr && txRows) {
      const deposits = txRows.filter(t => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0);
      const withdrawals = txRows.filter(t => t.type === "withdrawal").reduce((s, t) => s + Number(t.amount), 0);
      const balance = deposits - withdrawals;

      if (principal > balance && balance > 0) {
        return {
          success: false,
          error: `Loan amount (UGX ${principal.toLocaleString()}) cannot exceed your savings balance (UGX ${balance.toLocaleString()}).`
        };
      }
    }

    // Insert loan — no memo column in DB yet, interest_rate is NULL (admin sets on approval)
    const { error } = await supabase.from("loans").insert({
      member_id: profile.member_id,
      principal,
      term_months: termMonths,
      status: "pending"
      // interest_rate: null (default) — admin sets when approving
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/member");
    return {
      success: true,
      message: "Application submitted. Admin will review and set the interest rate."
    };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Admin — Approve Loan  (sets interest rate + calculates monthly payment)
// ---------------------------------------------------------------------------

export async function approveLoan(
  loanId: string,
  interestRate: number
): Promise<ActionResult> {
  try {
    if (!Number.isFinite(interestRate) || interestRate <= 0) {
      return { success: false, error: "Interest rate must be greater than 0." };
    }
    const supabase = requireSupabase();
    const { error } = await supabase
      .from("loans")
      .update({
        status: "approved",
        interest_rate: interestRate,
        approved_at: new Date().toISOString()
      })
      .eq("id", loanId);
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    revalidatePath("/member");
    return { success: true, message: `Loan approved at ${interestRate}% per month.` };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Admin — Reject Loan
// ---------------------------------------------------------------------------

export async function rejectLoan(loanId: string): Promise<ActionResult> {
  try {
    const supabase = requireSupabase();
    const { error } = await supabase
      .from("loans")
      .update({ status: "rejected" })
      .eq("id", loanId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard");
    revalidatePath("/member");
    return { success: true, message: "Loan rejected." };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Admin — Close Loan
// ---------------------------------------------------------------------------

export async function closeLoan(loanId: string): Promise<ActionResult> {
  try {
    const supabase = requireSupabase();
    const { error } = await supabase
      .from("loans")
      .update({ status: "closed" })
      .eq("id", loanId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard");
    return { success: true, message: "Loan closed." };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
