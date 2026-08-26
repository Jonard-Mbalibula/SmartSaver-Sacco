import type { Role } from "./types";

type UserLike = {
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
} | null;

/**
 * DEPRECATED ROLE CHECKING - DO NOT USE FOR AUTHORIZATION
 * 
 * ⚠️ SECURITY WARNING ⚠️
 * 
 * This function reads role from user_metadata, which can be manipulated by users.
 * NEVER use this function for authorization decisions.
 * 
 * Use lib/authorization.ts functions instead:
 * - requireAdmin() for admin-only operations
 * - getUserProfile() to get authoritative role from database
 * 
 * This function is kept ONLY for backward compatibility and UI display purposes.
 * It will be removed in a future version.
 * 
 * Get role from the Supabase user object.
 * Primary source: user_metadata.role (set via admin API or at signup).
 * Fallback: app_metadata.role.
 * Default: "member".
 *
 * NOTE: user_metadata is included in the JWT returned by getUser(),
 * so this works immediately after login — no extra DB query needed.
 * 
 * @deprecated Use getUserProfile() from lib/authorization.ts instead
 */
export function getRoleFromUser(user: UserLike): Role {
  if (!user) return "member";

  const meta = user.user_metadata?.role;
  if (meta === "admin") return "admin";
  if (meta === "member") return "member";

  const app = user.app_metadata?.role;
  if (app === "admin") return "admin";

  return "member";
}

/**
 * DEPRECATED - DO NOT USE FOR AUTHORIZATION
 * 
 * @deprecated Use requireAdmin() from lib/authorization.ts instead
 */
export function isAdmin(user: UserLike): boolean {
  return getRoleFromUser(user) === "admin";
}
