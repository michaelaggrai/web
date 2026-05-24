import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server-admin";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Route name is legacy "upgrade" but it accepts any tier — used for both
// upgrades (free→pro, pro→premium, etc.) and downgrades (premium→free,
// pro→free, etc.). Downgrade UX lives in /settings; upgrades in /upgrade.
const VALID_TIERS = ["free", "pro", "premium"] as const;
type TargetTier = (typeof VALID_TIERS)[number];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const tier = body?.tier as TargetTier | undefined;

  if (!tier || !VALID_TIERS.includes(tier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  // Verify caller is signed in.
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() { return req.cookies.getAll(); },
      setAll() {},
    },
  });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  // Use service role to update the tier (RLS blocks user self-updates).
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ tier })
    .eq("id", user.id);

  if (error) {
    console.error("upgrade error", error);
    return NextResponse.json({ error: "Failed to upgrade" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tier });
}
