import { createAdminClient } from "@/lib/supabase/server-admin";

// P7 (AGG-48): serverless-safe rate limiting for the public Vercel routes.
// In-memory won't survive across serverless invocations, so the shared state is
// an atomic Postgres check-and-increment (public.rate_limits + check_rate_limit
// RPC). Returns true if the request is ALLOWED, false if it should be blocked
// (429). FAILS OPEN on any error — a Supabase blip must never lock users out of
// login / contact.
export async function rateLimitOk(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("check_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) return true; // fail open
    return data !== false;
  } catch {
    return true; // fail open
  }
}

// Client IP from the Vercel edge (x-forwarded-for = "client, proxy1, …") — the
// rate-limit key for unauthenticated routes. A shared "unknown" bucket when
// absent (local dev), which is fine — these caps are abuse guards, not quotas.
export function clientIpKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "";
  const ip = xff.split(",")[0]?.trim();
  return ip || "unknown";
}
