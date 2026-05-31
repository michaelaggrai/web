import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(country ? { "x-aggrai-country": country } : {}),
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
