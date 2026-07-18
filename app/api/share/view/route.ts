import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { rateLimitOk, clientIpKey } from "@/lib/rate-limit";

// AGG-44: best-effort share view counter. Fire-and-forget beacon from /share, so
// every path returns 204 and an over-limit or bad request is silently dropped.
export async function POST(req: NextRequest) {
  if (!(await rateLimitOk(`shareview:${clientIpKey(req)}`, 120, 60))) {
    return new NextResponse(null, { status: 204 });
  }
  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  if (id) {
    await createAdminClient().rpc("increment_share_view", { p_id: id }).then(() => {}, () => {});
  }
  return new NextResponse(null, { status: 204 });
}
