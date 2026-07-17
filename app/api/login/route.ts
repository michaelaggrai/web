import { NextRequest, NextResponse } from "next/server";
import { rateLimitOk, clientIpKey } from "@/lib/rate-limit";

// Two-layer auth model: this endpoint guards the V0/V1 beta password wall
// (a sitewide cookie called `auth`, set when the user enters the shared
// pre-launch password). It is INTENTIONALLY independent of Supabase
// auth — Supabase governs which signed-in user you are and which tier
// (free/pro/premium) you're on; the password wall just decides whether
// you're allowed past the marketing site at all during the closed beta.
// The two cookies coexist deliberately. The password wall is removed
// after V2 launch.
//
// AGG-34: the previous version had `?? "aggrai"` as a fallback when
// SITE_PASSWORD wasn't set — which meant ANY deploy that forgot to set
// the env var silently used the literal word `aggrai` as the password.
// Now: if the env var is missing we refuse to authenticate at all
// (500) instead of failing-open. Set SITE_PASSWORD on Vercel before
// shipping.
const PASSWORD = process.env.SITE_PASSWORD;

export async function POST(req: NextRequest) {
  if (!PASSWORD) {
    return NextResponse.json(
      { error: "Site password not configured" },
      { status: 500 },
    );
  }
  // P7 (AGG-48): throttle brute-force against the shared beta password — 10
  // attempts / 10 min per IP. A legit user's typos stay well under; a bot can't
  // grind. Fails open on a Supabase blip so real users are never locked out.
  if (!(await rateLimitOk(`login:${clientIpKey(req)}`, 10, 600))) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429 },
    );
  }
  const { password } = await req.json();
  if (password !== PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("auth", PASSWORD, {
    httpOnly: true,
    sameSite: "lax",
    // `secure` is REQUIRED in production: modern browsers (Chrome incognito
    // in particular, Safari with ITP) refuse to persist non-Secure cookies
    // on HTTPS in privacy-protective contexts. Without it, incognito users
    // would successfully POST /api/login, get a 200 back, navigate to /,
    // but the auth cookie would silently not be set → middleware bounces
    // them back to /login forever. (Filed by user 2026-05-26.)
    //
    // We gate on NODE_ENV instead of hardcoding true so local development
    // over http://localhost still works (Secure cookies are dropped on
    // non-HTTPS origins).
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
