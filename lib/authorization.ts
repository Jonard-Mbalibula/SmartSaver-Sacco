/**
 * Authorization Module - AUTHORITATIVE ROLE CHECKING
 * 
 * CRITICAL SECURITY RULE:
 * NEVER use user_metadata.role for authorization decisions.
 * ALWAYS query the database for the authoritative role from user_profiles.
 * 
 * user_metadata can be manipulated by users during signup.
 * The database is the single source of truth.
 */

"use server";

import { createSupabaseAuthClient, createSupabaseServerClient } from "./supabase";
import type { Role, UserProfile } from "./types";
import { headers } from "next/headers";

/**
 * Get the currently authenticated user or throw error
 * @throws Error if not authenticated
 */
export async function getAuthenticatedUser() {
  const supabase = await createSupabaseAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new Error("Not authenticated");
  }
  
  return user;
}

/**
 * Get user profile from DATABASE (authoritative role source)
 * 
 * SECURITY NOTE: This function queries the database, not JWT metadata.
 * It is the ONLY safe way to check user roles for authorization.
 * 
 * @throws Error if user not found or profile missing
 */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  const supabase = createSupabaseServerClient();
  
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("id, member_id, role, created_at")
    .eq("id", userId)
    .single();
  
  if (error || !profile) {
    throw new Error("User profile not found. This should not happen for authenticated users.");
  }
  
  return profile as UserProfile;
}

/**
 * Require admin role or throw error
 * 
 * Usage at start of every admin-only server action:
 * ```typescript
 * export async function someAdminAction() {
 *   const { user, profile } = await requireAdmin();
 *   // Now safe to proceed with admin operation
 * }
 * ```
 * 
 * @throws Error if not authenticated or not admin
 * @returns Authenticated user and their profile
 */
export async function requireAdmin() {
  const user = await getAuthenticatedUser();
  const profile = await getUserProfile(user.id);
  
  // DEBUG: Log what we found
  console.log('[requireAdmin] User ID:', user.id);
  console.log('[requireAdmin] Profile role:', profile.role);
  
  if (profile.role !== "admin") {
    // Log unauthorized access attempt (will be implemented with audit system)
    console.warn(`[SECURITY] Unauthorized admin access attempt by user ${user.id} (role: ${profile.role})`);
    throw new Error("Unauthorized: Admin role required");
  }
  
  console.log('[requireAdmin] ✅ Admin access granted');
  return { user, profile };
}

/**
 * Require authenticated user (any role)
 * @throws Error if not authenticated
 */
export async function requireAuth() {
  const user = await getAuthenticatedUser();
  const profile = await getUserProfile(user.id);
  
  return { user, profile };
}

/**
 * Check if user has admin role (safe for conditionals)
 * Returns false instead of throwing, useful for UI rendering decisions
 * 
 * WARNING: For actual authorization enforcement, use requireAdmin() instead
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const profile = await getUserProfile(userId);
    return profile.role === "admin";
  } catch {
    return false;
  }
}

/**
 * Get client IP address for audit logging
 */
export async function getClientIP(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for") || h.get("x-real-ip") || null;
}

/**
 * Get user agent for audit logging
 */
export async function getClientUserAgent(): Promise<string | null> {
  const h = await headers();
  return h.get("user-agent") || null;
}
