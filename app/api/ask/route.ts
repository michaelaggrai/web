import { NextRequest, NextResponse } from "next/server";

// Edge runtime supports streaming response bodies (ReadableStream pass-through),
// which the default Node serverless runtime does not.
export const runtime = "edge";

const API_URL = process.env.API_URL ?? "http://localhost:3456";

export async function POST(req: NextRequest) {
  const body = await req.text();
  let parsed: { question?: string } = {};
  try { parsed = JSON.parse(body); } catch { /* fall through */ }
  if (!parsed?.question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
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
