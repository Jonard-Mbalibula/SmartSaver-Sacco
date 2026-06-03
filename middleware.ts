import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRoleFromUser } from "@/lib/roles";

// Routes that require a logged-in session
const AUTH_REQUIRED = ["/dashboard", "/member"];
// Admin-only routes
const ADMIN_ONLY = ["/dashboard"];
// Member-only routes
const MEMBER_ONLY = ["/member"];

// NOTE: /login, /register, /forgot-password are intentionally NOT
// auto-redirected for logged-in users. This prevents one user's session
// from blocking another user from logging in on a shared device.
// Anyone can always reach the login page to sign in as a different account.

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Demo mode — no auth configured, allow everything through
  if (!supabaseUrl || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      }
    }
  });

  const { data: { user } } = await supabase.auth.getUser();
  const role = getRoleFromUser(user);

  // 1. Unauthenticated — redirect to login, preserving the intended destination
  const needsAuth = AUTH_REQUIRED.some((p) => pathname.startsWith(p));
  if (needsAuth && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Authenticated member trying to access admin routes — redirect to member portal
  const isAdminOnly = ADMIN_ONLY.some((p) => pathname.startsWith(p));
  if (isAdminOnly && user && role !== "admin") {
    const memberUrl = request.nextUrl.clone();
    memberUrl.pathname = "/member";
    memberUrl.search = "";
    return NextResponse.redirect(memberUrl);
  }

  // 3. Authenticated admin trying to access member-only routes — redirect to admin dashboard
  const isMemberOnly = MEMBER_ONLY.some((p) => pathname.startsWith(p));
  if (isMemberOnly && user && role === "admin") {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    dashUrl.search = "";
    return NextResponse.redirect(dashUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
