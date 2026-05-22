import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PASSWORD = process.env.SITE_PASSWORD ?? "aggrai";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API routes pass through — the beta password wall is their protection
  // for now; per-user auth on /api/ask comes with the backend phase.
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // --- Gate 1: beta password wall ---
  // /login is the password page — always reachable.
  if (pathname === "/login") return NextResponse.next();
  if (req.cookies.get("auth")?.value !== PASSWORD) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // --- Gate 2: Supabase account session ---
  // (we are past the password wall here)
  let response = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
  const { data: { user } } = await supabase.auth.getUser();

  const onAuthPage = pathname === "/signin";

  // No account session → send to the sign-in page.
  if (!user && !onAuthPage) {
    return redirectWithCookies(req, response, "/signin");
  }
  // Already signed in but on the auth page → send to the app.
  if (user && onAuthPage) {
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
