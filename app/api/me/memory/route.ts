import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Phase 5c (AGG-29): read + write the signed-in user's memory profile.
// RLS-scoped to the caller (policy user_memory_owner) — no admin client. The
// backend /converse injects this via buildMemoryNote(); see the migration
// 20260714_p5a_conversations_messages.sql for the table shape.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Allowed values for the two enum-ish explicit fields; anything else is dropped.
const LENGTHS = ["concise", "balanced", "detailed"];
const TONES = ["professional", "casual", "friendly", "direct"];
const MAX = { expertise: 300, topics: 300, custom: 500 };

function clientFrom(req: NextRequest) {
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} },
  });
}

// Keep only known keys, enum-check the selects, trim + length-cap the free text.
// Blank values are omitted so buildMemoryNote skips them cleanly.
function cleanExplicit(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== "object") return out;
  const src = input as Record<string, unknown>;
  if (typeof src.length === "string" && LENGTHS.includes(src.length)) out.length = src.length;
  if (typeof src.tone === "string" && TONES.includes(src.tone)) out.tone = src.tone;
  for (const k of ["expertise", "topics", "custom"] as const) {
    if (typeof src[k] === "string") {
      const v = (src[k] as string).trim().slice(0, MAX[k]);
      if (v) out[k] = v;
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const supabase = clientFrom(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { data } = await supabase
    .from("user_memory")
    .select("explicit, implicit, enabled, implicit_enabled, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  // Defaults for a user who has never opened this screen: memory on, implicit off.
  return NextResponse.json(
    {
      enabled: data?.enabled ?? true,
      implicit_enabled: data?.implicit_enabled ?? false,
      explicit: data?.explicit ?? {},
      implicit: data?.implicit ?? {},
      updated_at: data?.updated_at ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(req: NextRequest) {
  const supabase = clientFrom(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* {} */ }

  // Partial update: only touch the fields the caller sent. This lets "Clear
  // learned facts" wipe implicit without clobbering explicit, and the Save
  // button persist explicit + toggles without touching cron-written facts.
  const row: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };
  if (typeof body.enabled === "boolean") row.enabled = body.enabled;
  if (typeof body.implicit_enabled === "boolean") row.implicit_enabled = body.implicit_enabled;
  if ("explicit" in body) row.explicit = cleanExplicit(body.explicit);
  if (body.clearImplicit === true) row.implicit = {};

  const { error } = await supabase.from("user_memory").upsert(row, { onConflict: "user_id" });
  if (error) {
    console.error("[me/memory PUT]", error.message);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
