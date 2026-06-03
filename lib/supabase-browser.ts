/**
 * Browser-only Supabase client — safe to import in "use client" components.
 * Does NOT import next/headers.
 */
import { createClient } from "@supabase/supabase-js";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase anon key not configured.");
  return createClient(url, anonKey);
}
