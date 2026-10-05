import { redirect } from "next/navigation";
import { hasAnonKey } from "@/lib/supabase";
import { requireAuth } from "@/lib/authorization";

/**
 * Member layout — enforces member role at the layout level.
 * Admins get redirected to their dashboard.
 * 
 * Uses database-authoritative role checking (user_profiles table).
 */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  if (hasAnonKey()) {
    try {
      const { profile } = await requireAuth();
      
      // Check authoritative role from database, not JWT metadata
      if (profile.role === "admin") {
        redirect("/dashboard");
      }
    } catch {
      redirect("/login");
    }
  }

  return <>{children}</>;
}
