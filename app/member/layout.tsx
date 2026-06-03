import { redirect } from "next/navigation";
import { createSupabaseAuthClient, hasAnonKey } from "@/lib/supabase";
import { isAdmin } from "@/lib/roles";

/**
 * Member layout — enforces member role at the layout level.
 * Admins get redirected to their dashboard.
 */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  if (hasAnonKey()) {
    try {
      const supabase = await createSupabaseAuthClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) redirect("/login");
      if (isAdmin(user)) redirect("/dashboard");
    } catch {
      redirect("/login");
    }
  }

  return <>{children}</>;
}
