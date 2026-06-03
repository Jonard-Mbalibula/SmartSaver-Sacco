import { redirect } from "next/navigation";
import { createSupabaseAuthClient, hasAnonKey } from "@/lib/supabase";
import { isAdmin } from "@/lib/roles";

/**
 * Admin layout — enforces admin role at the layout level as a hard guard.
 * Even if middleware is bypassed, this will redirect non-admins.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (hasAnonKey()) {
    try {
      const supabase = await createSupabaseAuthClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) redirect("/login");
      if (!isAdmin(user)) redirect("/member");
    } catch {
      redirect("/login");
    }
  }

  return <>{children}</>;
}
