import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3456";

export async function POST(req: NextRequest) {
  const body = await req.text();
  if (!body || !JSON.parse(body)?.question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const upstream = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  // Forward the NDJSON stream as-is.
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
