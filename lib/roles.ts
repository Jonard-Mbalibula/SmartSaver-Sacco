import type { Role } from "./types";

type UserLike = {
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
} | null;

/**
 * Get role from the Supabase user object.
 * Primary source: user_metadata.role (set via admin API or at signup).
 * Fallback: app_metadata.role.
 * Default: "member".
 *
 * NOTE: user_metadata is included in the JWT returned by getUser(),
 * so this works immediately after login — no extra DB query needed.
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

export function isAdmin(user: UserLike): boolean {
  return getRoleFromUser(user) === "admin";
}
