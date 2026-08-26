import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

export function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Production fail-closed check
 * 
 * In production, the application MUST have a database configured.
 * Failing silently to demo mode in production would be a security disaster.
 * 
 * @throws Error if production environment lacks database configuration
 */
export function requireProductionDatabase() {
  if (process.env.NODE_ENV === "production" && !hasSupabaseConfig()) {
    throw new Error(
      "FATAL: Database not configured in production environment. " +
      "The application cannot operate without a database connection. " +
      "Please configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
      "environment variables before deploying to production."
    );
  }
}

export function hasAnonKey() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

// ---------------------------------------------------------------------------
// Admin / service-role client  (server only, never send to browser)
// ---------------------------------------------------------------------------

export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server env vars missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ---------------------------------------------------------------------------
// Auth client  (uses anon key + reads/writes cookies for session)
// ---------------------------------------------------------------------------

export async function createSupabaseAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase anon key not configured. Add NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local");

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll called from a Server Component — cookies can't be mutated there,
          // middleware handles the refresh instead.
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Browser client (anon key, for client components)
// ---------------------------------------------------------------------------

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase anon key not configured.");
  return createClient(url, anonKey);
}
