import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { deleteUserData } from "@/lib/gdpr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// POST /api/me/delete — GDPR Article-17 erasure. Hard-deletes the signed-in
// user's personal data across every table, then the auth user itself.
// IRREVERSIBLE. Requires the caller to echo their own email as confirmation
// (guards against accidental / cross-site triggering; Supabase auth cookies are
// SameSite=Lax so a cross-site POST wouldn't authenticate in the first place).
export async function POST(req: NextRequest) {
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const confirm = String(body?.confirm ?? "").trim().toLowerCase();
  if (!user.email || confirm !== user.email.trim().toLowerCase()) {
    return NextResponse.json({ error: "Type your account email exactly to confirm deletion." }, { status: 400 });
  }

  const { error } = await deleteUserData(createAdminClient(), user.id);
  if (error) {
    console.error("[me/delete]", error);
    return NextResponse.json({ error: "Deletion failed — nothing was removed. Please contact support." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
