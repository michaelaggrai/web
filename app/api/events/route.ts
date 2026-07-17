import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { CONSENT_COOKIE } from "@/lib/consent";
import { rateLimitOk, clientIpKey } from "@/lib/rate-limit";

// AGG-21/AGG-27: first-party event collector.
//
// The browser is the only tier that can see a page view, so it beacons here.
// This route is the TRUST BOUNDARY — who is allowed to assert what:
//   user_id            SERVER-derived from the Supabase session cookie. NEVER read
//                      from the body: a client-supplied user_id is forged signups
//                      and poisoned attribution.
//   anon_id/session_id client-supplied — they're the caller's OWN pseudonymous ids,
//                      so forging one only pollutes their own row. Charset-validated.
//   device             parsed HERE from the real User-Agent. This route is hit by the
//                      browser directly, unlike /ask (whose socket is the tunnel, so
//                      it needs x-aggrai-ua forwarded).
//   country            from the Vercel edge header — never trust a client for geo.
//   event_type         whitelisted (see EVENT_TYPES) — the governance for the log.
//   properties         key-whitelisted + length-capped; unbounded jsonb from a public
//                      endpoint is a storage-abuse vector.
//   consent            enforced here; the client cannot opt itself back in.
//
// `events` has no INSERT policy (SELECT-own only), so writes go through the
// service role — which is also why this validation has to be airtight.
//
// TODO (AGG-48 / P7): this is a public unauthenticated write. Add it to the
// rate-limit sweep alongside /ask and /api/me/*.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Deliberately short. Anything with an entity table is DERIVED, never emitted
// here: asks → questions, signup/upgrade → profile_events. The day this list has
// 40 entries, someone is autocapturing by stealth.
const EVENT_TYPES = new Set(["page_view"]);

// Payload whitelist. `from` is the previous in-app path — SPA route changes don't
// update document.referrer, so it's the only way to attribute an internal nav.
const PROP_KEYS = ["path", "from", "referrer", "utm_source", "utm_medium", "utm_campaign"] as const;

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_VALUE_LEN = 300;

// Mirror of deviceFrom() in the ops repo (api/server.js ~831). The bucket
// vocabulary is a CONTRACT: questions.device and events.device must stay
// comparable or any landed→asked cut by device breaks. Keep the two in sync
// (see the aggrai-mirror-check skill).
function deviceFrom(ua: string | null) {
  if (!ua) return null;
  const s = ua.slice(0, 400);
  const isBot = /bot|crawler|spider|crawl|slurp|bingpreview|headless/i.test(s);
  const isTablet = /iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(s);
  const isMobile = !isTablet && /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|IEMobile/i.test(s);
  const type = isBot ? "bot" : isTablet ? "tablet" : isMobile ? "mobile" : "desktop";
  const os = /Windows NT/i.test(s) ? "Windows"
    : /iPhone|iPad|iPod|CPU OS/i.test(s) ? "iOS"
    : /Mac OS X/i.test(s) ? "macOS"
    : /Android/i.test(s) ? "Android"
    : /CrOS/i.test(s) ? "ChromeOS"
    : /Linux/i.test(s) ? "Linux" : "other";
  const browser = /Edg(?:e|A|iOS)?\//i.test(s) ? "Edge"
    : /OPR\/|Opera/i.test(s) ? "Opera"
    : /SamsungBrowser/i.test(s) ? "Samsung"
    : /Firefox\/|FxiOS/i.test(s) ? "Firefox"
    : /Chrome\/|CriOS/i.test(s) ? "Chrome"
    : /Safari\//i.test(s) && !/Chrome|CriOS/i.test(s) ? "Safari" : "other";
  return { type, os, browser, ua: s };
}

const cleanId = (v: unknown): string | null =>
  typeof v === "string" && ID_RE.test(v) ? v : null;

function cleanProps(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== "object") return out;
  const src = input as Record<string, unknown>;
  for (const k of PROP_KEYS) {
    const v = src[k];
    if (typeof v === "string") {
      const s = v.trim().slice(0, MAX_VALUE_LEN);
      if (s) out[k] = s;
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  // A beacon is fire-and-forget: the client ignores the response, so every path
  // returns 204 and nothing here may ever surface an error to the page.
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  // P7 (AGG-48): cap beacon volume per IP — a public unauthenticated write, so a
  // flood is a storage-abuse vector. 120/min is generous for real browsing; a
  // beacon is fire-and-forget, so an over-limit one is silently dropped (204).
  if (!(await rateLimitOk(`events:${clientIpKey(req)}`, 120, 60))) {
    return new NextResponse(null, { status: 204 });
  }

  const type = typeof body.type === "string" ? body.type : "";
  if (!EVENT_TYPES.has(type)) {
    console.warn(`[events] rejected event_type: ${type.slice(0, 40)}`);
    return new NextResponse(null, { status: 204 });
  }

  let userId: string | null = null;
  try {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} },
    });
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    /* anonymous visitor — expected */
  }

  const accepted = req.cookies.get(CONSENT_COOKIE)?.value === "accepted";

  // Coarse country is kept regardless of consent (legitimate interest — it also
  // picks the language variant), matching /ask and the /privacy copy.
  const props = cleanProps(body.props);
  const country = req.headers.get("x-vercel-ip-country");
  if (country) props.country = country.slice(0, 8);

  const row = {
    event_type: type,
    user_id: userId,
    anon_id: accepted ? cleanId(body.anon_id) : null,
    session_id: accepted ? cleanId(body.session_id) : null,
    device: accepted ? deviceFrom(req.headers.get("user-agent")) : null,
    properties: props,
  };

  try {
    const { error } = await createAdminClient().from("events").insert(row);
    if (error) console.error("[events]", error.message);
  } catch (e) {
    console.error("[events]", e instanceof Error ? e.message : "insert failed");
  }
  return new NextResponse(null, { status: 204 });
}
