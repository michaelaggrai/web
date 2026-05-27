import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// AGG-34 follow-up: keep this aligned with app/api/login/route.ts —
// both used to share a `?? "aggrai"` failing-open fallback that we
// removed from the route handler. Removed from middleware too: if
// SITE_PASSWORD is unset, PASSWORD is undefined, the cookie compare
// always fails, and every page redirects to /login. Loud, not silent.
const PASSWORD = process.env.SITE_PASSWORD;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API routes pass through — the beta password wall is their protection
  // for now; per-user auth on /api/ask comes with the backend phase.
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // --- Gate 1: beta password wall ---
  // /login is the password page — always reachable.
  // /sitemap.xml + /robots.txt are crawler-only — bypass the gate so
  // search engines can read them while V1 is still password-walled
  // (AGG-40). They list only public pages; auth-only routes are
  // disallowed in robots.txt itself.
  if (pathname === "/login") return NextResponse.next();
  if (pathname === "/sitemap.xml" || pathname === "/robots.txt") return NextResponse.next();
  if (req.cookies.get("auth")?.value !== PASSWORD) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // --- Gate 2: Supabase account session ---
  // (we are past the password wall here)
  // If Supabase env vars are missing, degrade gracefully to password-wall-only
  // rather than crashing every request.
  if (!SUPABASE_URL || !SUPABASE_KEY) return NextResponse.next();

  let response = NextResponse.next({ request: req });
  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        },
      },
    },
  );

  // IMPORTANT: no logic between createServerClient and getUser().
  // We refresh the session here but do NOT require one — anonymous users
  // can use the app at the Free tier; an account is only for upgrading.
  const { data: { user } } = await supabase.auth.getUser();

  // Already signed in but on the auth page → send to the app.
  if (user && pathname === "/signin") {
    return redirectWithCookies(req, response, "/app");
  }

  // Signed-in users land on /app when they visit /.
  // Anonymous users can always reach the landing page.
  if (pathname === "/" && user) {
    return redirectWithCookies(req, response, "/app");
  }

  return response;
}

// Redirect while preserving any refreshed Supabase session cookies.
function redirectWithCookies(req: NextRequest, from: NextResponse, to: string) {
  const url = req.nextUrl.clone();
  url.pathname = to;
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach(c => redirect.cookies.set(c));
  return redirect;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
