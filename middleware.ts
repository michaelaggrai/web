import { NextRequest, NextResponse } from "next/server";

const PASSWORD = process.env.SITE_PASSWORD ?? "aggrai";

export function middleware(req: NextRequest) {
  // Skip auth for the login page and API routes
  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("auth")?.value;
  if (cookie === PASSWORD) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
