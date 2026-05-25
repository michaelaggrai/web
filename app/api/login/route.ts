import { NextRequest, NextResponse } from "next/server";

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
  const { password } = await req.json();
  if (password !== PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("auth", PASSWORD, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
