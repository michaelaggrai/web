import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Edge runtime for streaming pass-through (see app/api/ask/route.ts).
export const runtime = "edge";

const API_URL = process.env.API_URL ?? "http://localhost:3456";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Phase 5a (AGG-29): single-model conversation continuation. Proxies to the
// backend /converse, which reconstructs the chosen model's own thread from the
// user's RLS-scoped history and streams a follow-up answer. Signed-in only, so
// (unlike /ask) there's no anonymous-id path — the Supabase access token is
// required for the backend to resolve the account + its history.
export async function POST(req: NextRequest) {
  const body = await req.text();
  let parsed: { question?: string; conversationId?: string; modelId?: string; models?: string[] } = {};
  try { parsed = JSON.parse(body); } catch { /* fall through */ }
  if (!parsed?.question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }
  if (!parsed?.conversationId) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }
  // Two modes, mirroring the backend: single-model continuation (modelId) or
  // "Ask all again" — a compare follow-up (models[]). This check was written for
  // P5a, when modelId was the only mode, and never updated when P5b added
  // compare — so every "Ask all again" was rejected here, with the backend that
  // handles it perfectly well sitting untouched behind the 400. Validate the
  // shape the backend actually accepts, and let IT reject anything else: model
  // validity and tier gating are its job, not the proxy's.
  if (!parsed?.modelId && !(Array.isArray(parsed?.models) && parsed.models.length > 0)) {
    return NextResponse.json({ error: "modelId or models[] is required" }, { status: 400 });
  }

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
    } catch { /* no session */ }
  }
  // Continuation requires an account (the thread is RLS-scoped). Fail fast here
  // rather than streaming an error the client has to parse.
  if (!accessToken) {
    return NextResponse.json({ error: "Sign in to continue a conversation." }, { status: 401 });
  }

  // Same visitor signals as /ask so the continuation's tracking row is complete
  // + consent is honoured (see app/api/ask/route.ts for the rationale on each).
  const country = req.headers.get("x-vercel-ip-country") ?? "";
  const sessionId = req.headers.get("x-aggrai-session-id") ?? "";
  const xff = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "";
  const clientIp = (xff.split(",")[0] ?? "").trim();
  const ua = req.headers.get("user-agent") ?? "";
  const consent = req.cookies.get("aggrai_consent_v1")?.value ?? "";

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/converse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(country ? { "x-aggrai-country": country } : {}),
        ...(sessionId ? { "x-aggrai-session-id": sessionId } : {}),
        ...(clientIp && consent === "accepted" ? { "x-aggrai-ip": clientIp } : {}),
        ...(ua && consent === "accepted" ? { "x-aggrai-ua": ua } : {}),
        ...(consent === "accepted" || consent === "rejected" ? { "x-aggrai-consent": consent } : {}),
      },
      body,
      signal: req.signal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream unreachable";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
