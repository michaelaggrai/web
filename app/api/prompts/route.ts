import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3456";

// Proxy to backend /prompts. Passes through `?all=1` and `?n=` query params.
// Falls back to an empty list on upstream failure so the hero gracefully
// degrades to its own FALLBACK_POOL.
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const url = `${API_URL}/prompts${qs ? `?${qs}` : ""}`;
  try {
    const upstream = await fetch(url, { cache: "no-store" });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ prompts: [], total: 0 }, { status: 200 });
  }
}
