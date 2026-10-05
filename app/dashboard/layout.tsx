import { redirect } from "next/navigation";
import { hasAnonKey } from "@/lib/supabase";
import { requireAuth } from "@/lib/authorization";

/**
 * Admin layout — enforces admin role at the layout level as a hard guard.
 * Even if middleware is bypassed, this will redirect non-admins.
 * 
 * Uses database-authoritative role checking (user_profiles table).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (hasAnonKey()) {
    try {
      const { profile } = await requireAuth();
      
      // Check authoritative role from database, not JWT metadata
      if (profile.role !== "admin") {
        redirect("/member");
      }
    } catch {
      redirect("/login");
    }
  }

  return <>{children}</>;
}
