/**
 * Audit Logging System
 * 
 * All sensitive operations MUST be logged to provide:
 * - Accountability (who did what)
 * - Forensics (investigate incidents)
 * - Compliance (regulatory requirements)
 * - Deterrence (users know actions are logged)
 * 
 * Audit logs are IMMUTABLE - they cannot be edited or deleted via RLS.
 * Only service-role can insert. Admins can read via RLS policy.
 */

"use server";

import { createSupabaseServerClient } from "./supabase";
import { getClientIP, getClientUserAgent } from "./authorization";

/**
 * Audit log action types
 * Add new actions as features are implemented
 */
export type AuditAction =
  // Authentication
  | "LOGIN"
  | "LOGOUT"
  | "LOGIN_FAILED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "MFA_ENABLED"
  | "MFA_DISABLED"
  
  // Member management
  | "MEMBER_CREATED"
  | "MEMBER_UPDATED"
  | "MEMBER_STATUS_CHANGED"
  | "MEMBER_CLOSED"
  | "MEMBER_ARCHIVED"
  
  // Financial transactions
  | "TRANSACTION_RECORDED"
  | "TRANSACTION_REVERSED"
  | "TRANSACTION_ADJUSTED"
  | "TRANSACTION_DELETED_ATTEMPT" // Should be blocked
  
  // Loans
  | "LOAN_APPLIED"
  | "LOAN_CREATED"
  | "LOAN_APPROVED"
  | "LOAN_REJECTED"
  | "LOAN_CLOSED"
  | "LOAN_REPAYMENT_RECORDED"
  
  // Authorization & roles
  | "ROLE_CHANGED"
  | "USER_LINKED_TO_MEMBER"
  | "USER_UNLINKED_FROM_MEMBER"
  | "UNAUTHORIZED_ACCESS_ATTEMPT"
  | "AUTHORIZATION_CHECK_FAILED"
  
  // Data export & reporting
  | "DATA_EXPORT"
  | "REPORT_GENERATED"
  | "MEMBER_DATA_ACCESSED"
  | "SENSITIVE_DATA_REVEALED"
  
  // System
  | "CONFIGURATION_CHANGED"
  | "BACKUP_INITIATED"
  | "BACKUP_RESTORED";

/**
 * Audit log entry details
 */
export interface AuditLogDetails {
  /** User performing the action (defaults to current authenticated user if not specified) */
  actor?: string;
  
  /** Role of the actor at time of action */
  actor_role?: string;
  
  /** Type of entity affected (e.g., "member", "transaction", "loan") */
  entity_type?: string;
  
  /** ID of the entity affected */
  entity_id?: string;
  
  /** Previous value (for UPDATE operations) - will be JSON serialized */
  old_value?: unknown;
  
  /** New value (for INSERT/UPDATE operations) - will be JSON serialized */
  new_value?: unknown;
  
  /** Human-readable reason for the action */
  reason?: string;
  
  /** Additional context data */
  metadata?: Record<string, unknown>;
}

/**
 * Write an entry to the audit log
 * 
 * This function NEVER throws - audit logging failures should not break the application.
 * However, failures are logged to console for investigation.
 * 
 * @param action - Type of action being logged
 * @param details - Additional details about the action
 * 
 * @example
 * await auditLog("MEMBER_CREATED", {
 *   entity_type: "member",
 *   entity_id: newMember.id,
 *   new_value: newMember,
 *   reason: "New member registration"
 * });
 * 
 * @example
 * await auditLog("UNAUTHORIZED_ACCESS_ATTEMPT", {
 *   entity_type: "server_action",
 *   entity_id: "assignRole",
 *   reason: "Member attempted to call admin-only function"
 * });
 */
export async function auditLog(
  action: AuditAction,
  details: AuditLogDetails = {}
): Promise<void> {
  try {
    const supabase = createSupabaseServerClient();
    
    // Get current authenticated user
    let actor_user_id: string | null = details.actor || null;
    let actor_role: string = details.actor_role || "system";
    
    if (!actor_user_id) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          actor_user_id = user.id;
          
          // Get role from database (not user_metadata!)
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("role")
            .eq("id", user.id)
            .single();
          
          if (profile) {
            actor_role = profile.role;
          }
        }
      } catch {
        // If we can't get user, log as system action
        actor_user_id = null;
        actor_role = "system";
      }
    }
    
    // Get request context
    const ip_address = await getClientIP();
    const user_agent = await getClientUserAgent();
    
    // Insert audit log entry (using service-role, bypasses RLS)
    const { error } = await supabase
      .from("audit_logs")
      .insert({
        actor_user_id,
        actor_role,
        action,
        entity_type: details.entity_type || null,
        entity_id: details.entity_id || null,
        old_value: details.old_value ? JSON.parse(JSON.stringify(details.old_value)) : null,
        new_value: details.new_value ? JSON.parse(JSON.stringify(details.new_value)) : null,
        reason: details.reason || null,
        metadata: details.metadata || null,
        ip_address,
        user_agent
      });
    
    if (error) {
      // Log error but don't throw - audit failures should not break the app
      console.error("[AUDIT] Failed to write audit log:", {
        action,
        error: error.message,
        details
      });
    }
  } catch (error) {
    // Catch-all to ensure audit logging never breaks the application
    console.error("[AUDIT] Unexpected error in auditLog():", error);
  }
}

/**
 * Log an unauthorized access attempt
 * This is a convenience wrapper for a common audit scenario
 */
export async function logUnauthorizedAttempt(
  attemptedAction: string,
  additionalDetails?: Partial<AuditLogDetails>
): Promise<void> {
  await auditLog("UNAUTHORIZED_ACCESS_ATTEMPT", {
    entity_type: "server_action",
    entity_id: attemptedAction,
    reason: `Unauthorized attempt to execute ${attemptedAction}`,
    ...additionalDetails
  });
}

/**
 * Log a successful authorization decision
 * Useful for tracking admin actions
 */
export async function logAuthorizedAction(
  action: AuditAction,
  details: AuditLogDetails
): Promise<void> {
  await auditLog(action, details);
}
