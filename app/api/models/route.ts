import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3456";

// Caching: the model CATALOG only changes on backend redeploy, but the
// `tierDefaults` in this same payload are DYNAMIC — they swap a model out when
// the performance monitor flags it degraded. A long TTL left a just-degraded
// model pre-selected in the UI for up to 30 min. 60s (stale-while-revalidate)
// keeps TTFB ~10ms from cache while letting a swap propagate within a minute.

export const dynamic = "force-static";
export const revalidate = 60;

export async function GET() {
  try {
    const upstream = await fetch(`${API_URL}/models`, {
      next: { revalidate: 60 },
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ models: [], defaults: [] }, { status: 200 });
  }
}
