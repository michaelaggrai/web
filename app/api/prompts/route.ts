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
//   - `revalidate = 300` re-fetches every 5 min. The 04:00 cron rotates the pool
//     once a day; a short window bounds how long the landing can show a
//     just-rotated-out prompt (no longer cache-warm post warm-then-swap → it
//     would run live). 5 min keeps the post-rotation cold window small.
//   - Cached upstream fetch belt-and-braces — keeps the warm path cheap.
//
// Falls back to an empty list on upstream failure so the hero gracefully
// degrades to its own FALLBACK_POOL.

export const dynamic = "force-static";
export const revalidate = 300;

export async function GET() {
  try {
    const upstream = await fetch(`${API_URL}/prompts?all=1`, {
      next: { revalidate: 300 },
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ prompts: [], total: 0 }, { status: 200 });
  }
}
