import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server-admin";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const API_URL = process.env.API_URL ?? "http://localhost:3456";

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

  // Tell the backend to drop its cached account for this user so the new
  // tier takes effect on the user's very next /api/ask request. Without
  // this, the backend would serve the old tier from its in-memory cache
  // for up to the 1-hour TTL.
  //
  // Authenticated by forwarding the user's Supabase access token — the
  // backend verifies it belongs to the userId being invalidated. We await
  // (not fire-and-forget) so the success response we return to the
  // browser is only sent once the cache is actually clear, eliminating
  // the race where the user's next request fires before invalidation
  // lands. ~50ms typical via the Cloudflare tunnel.
  //
  // If invalidation fails (backend down, network blip) we still return
  // success because the Supabase write succeeded — the user IS upgraded.
  // The 1-hour backend cache TTL is the safety net.
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (accessToken) {
      const invRes = await fetch(`${API_URL}/invalidate-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });
      if (!invRes.ok) {
        console.warn(`invalidate-account returned HTTP ${invRes.status} for user ${user.id}`);
      }
    }
  } catch (err) {
    // Non-fatal — the TTL handles it within 1 hour.
    console.warn("invalidate-account fetch failed", err);
  }

  return NextResponse.json({ ok: true, tier });
}
