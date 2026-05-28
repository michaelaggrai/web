import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3456";

// Proxy to backend /prompts — always returns the full pool. The frontend
// (components/landing/hero.tsx) does its own client-side selection +
// shuffle from the pool. Previous query-string passthrough (`?all=1`,
// `?n=`) is dropped because Next.js 16 won't prerender a route handler
// that reads searchParams. The backend's /prompts default already returns
// the full pool so behaviour is unchanged.
//
// Caching:
//   - `force-static` makes the route response prerenderable — Vercel
//     serves the cached payload from edge in ~10ms instead of cold-
//     starting a Node function (~400ms previously).
//   - `revalidate = 1800` re-fetches every 30 minutes. Trending refresher
//     only runs once a day at 04:00 BST, so 30 min staleness is fine.
//   - Cached upstream fetch belt-and-braces — keeps the warm path cheap.
//
// Falls back to an empty list on upstream failure so the hero gracefully
// degrades to its own FALLBACK_POOL.

export const dynamic = "force-static";
export const revalidate = 1800;

export async function GET() {
  try {
    const upstream = await fetch(`${API_URL}/prompts?all=1`, {
      next: { revalidate: 1800 },
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ prompts: [], total: 0 }, { status: 200 });
  }
}
