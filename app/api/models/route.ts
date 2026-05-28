import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3456";

// Caching: the model catalog only changes when we redeploy the backend
// (new MODEL_CATALOG in server.js). 30-min revalidate is conservative;
// could go to 24h. `force-static` + edge cache drops user-visible TTFB
// from ~400ms cold to ~10ms.

export const dynamic = "force-static";
export const revalidate = 1800;

export async function GET() {
  try {
    const upstream = await fetch(`${API_URL}/models`, {
      next: { revalidate: 1800 },
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ models: [], defaults: [] }, { status: 200 });
  }
}
