import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { proxyAuthHeaders } from "@/lib/proxy-auth";

// Edge runtime supports streaming response bodies (ReadableStream pass-through),
// which the default Node serverless runtime does not.
export const runtime = "edge";

const API_URL = process.env.API_URL ?? "http://localhost:3456";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(req: NextRequest) {
  const body = await req.text();
  let parsed: { question?: string } = {};
  try { parsed = JSON.parse(body); } catch { /* fall through */ }
  if (!parsed?.question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  // Forward the caller's Supabase access token so the backend can resolve
  // their account + tier.
  let accessToken: string | null = null;
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
        cookies: {
          getAll() { return req.cookies.getAll(); },
          setAll() { /* read-only in this route */ },
        },
      });
      const { data } = await supabase.auth.getSession();
      accessToken = data.session?.access_token ?? null;
    } catch { /* no session — proceed anonymously */ }
  }

  // Vercel tags each request with the visitor's country. Forward it so the
  // backend can pick an English variant (British spelling for GB/IE/AU/… ) for
  // LIVE asks. Absent in local dev → backend defaults to American.
  const country = req.headers.get("x-vercel-ip-country") ?? "";
  // Pseudonymous per-browser id for anonymous visitors (set by lib/anon-id),
  // forwarded so the backend tracking log can distinguish anonymous users.
  const anonId = req.headers.get("x-aggrai-anon-id") ?? "";
  // The synthetic uptime canary tags itself so the backend can exclude it from
  // "real usage". (Internal-analytics classification only — not a trust
  // boundary; a client could spoof it, which is fine for V1.)
  const synthetic = req.headers.get("x-aggrai-synthetic") ?? "";
  // Per-tab session id (lib/session-id) — forwarded for session-level analytics
  // (visitor → session → ask).
  const sessionId = req.headers.get("x-aggrai-session-id") ?? "";
  // Visitor IP + browser UA for the backend tracking log. The backend's own
  // socket is the cloudflared tunnel, so the real client values must be forwarded
  // from here at the edge. x-forwarded-for is "client, proxy1, …" → take the
  // first hop. PII (raw IP + UA) — forwarded ONLY when the visitor Accepted
  // analytics (opt-in, mirrors the anon/session id gating); withheld pre-consent
  // and on reject (AGG-30). The backend re-applies the same gate (defence in depth).
  const xff = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "";
  const clientIp = (xff.split(",")[0] ?? "").trim();
  const ua = req.headers.get("user-agent") ?? "";
  // GDPR (Phase 4b): the analytics-consent choice — the first-party
  // aggrai_consent_v1 cookie, sent automatically. Forwarded so the backend can
  // stamp it on the tracking row (and, in 4b enforcement, honour it).
  const consent = req.cookies.get("aggrai_consent_v1")?.value ?? "";
  // AGG-44: arrival attribution — the aggrai_ref cookie set on /share (e.g.
  // "share:<id>"). Forwarded so the backend can stamp questions.referrer.
  const ref = req.cookies.get("aggrai_ref")?.value ?? "";

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...proxyAuthHeaders(),   // AGG-48: authenticate the proxy hop so the backend trusts the x-aggrai-* below
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(country ? { "x-aggrai-country": country } : {}),
        ...(anonId ? { "x-aggrai-anon-id": anonId } : {}),
        ...(synthetic ? { "x-aggrai-synthetic": synthetic } : {}),
        ...(sessionId ? { "x-aggrai-session-id": sessionId } : {}),
        ...(clientIp && consent === "accepted" ? { "x-aggrai-ip": clientIp } : {}),
        ...(ua && consent === "accepted" ? { "x-aggrai-ua": ua } : {}),
        ...(consent === "accepted" || consent === "rejected" ? { "x-aggrai-consent": consent } : {}),
        ...(ref ? { "x-aggrai-ref": ref } : {}),
      },
      body,
      // Forward the client's abort: if the user clicks Stop / navigates away,
      // req.signal aborts → this upstream fetch aborts → the backend sees the
      // connection drop and cancels the in-flight model calls (saving cost).
      signal: req.signal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream unreachable";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Forward the NDJSON stream as-is.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
