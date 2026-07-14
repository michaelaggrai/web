// Persistent comparison history for SIGNED-IN users — the cross-device layer.
//
// Mirrors each /app/c/{id} comparison into Supabase (table `conversations`,
// owner-only RLS) so a user sees their past questions + answers on any device.
// Anonymous users keep the sessionStorage path (lib/conv-id.ts) untouched.
//
// The full rendered result blob is stored as JSONB and kept `unknown` here —
// the `Result` shape lives in app/app/page.tsx; typing it here would create a
// circular import (same reason conv-id.ts keeps it opaque). The caller casts.
//
// Everything is best-effort: history is non-critical, so a failed write never
// breaks a comparison. All calls no-op when Supabase isn't configured or the
// user isn't signed in (RLS would reject anyway).

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export interface ConvRow {
  id: string;
  title: string;
  question: string;
  created_at: string;
}

export interface ConvFull {
  question: string;
  models: string[];
  result: unknown;
}

/** A compact, human-readable title from the question. */
function titleFor(question: string): string {
  const t = question.trim().replace(/\s+/g, " ");
  if (!t) return "Untitled";
  return t.length <= 70 ? t : t.slice(0, 69) + "…";
}

async function uid(): Promise<string | null> {
  try {
    const { data } = await createClient().auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Upsert a comparison into the signed-in user's history (keyed by the /app/c
 * short id). Pass `result` once the comparison completes to fill it in. No-op
 * for anonymous users / unconfigured Supabase. Best-effort.
 */
export async function saveConversation(
  id: string,
  data: { question: string; models: string[]; result?: unknown },
): Promise<void> {
  if (!isSupabaseConfigured || !id) return;
  try {
    const user_id = await uid();
    if (!user_id) return;
    const row: Record<string, unknown> = {
      id,
      user_id,
      title: titleFor(data.question),
      question: data.question,
      models: data.models,
      updated_at: new Date().toISOString(),
      // Recents sort by conversation activity (Phase 5a) — set on the root turn
      // so a new comparison floats to the top; bumpConversation() updates it as
      // follow-ups land.
      last_message_at: new Date().toISOString(),
    };
    if (data.result !== undefined) row.result = data.result;
    await createClient().from("conversations").upsert(row, { onConflict: "id" });
  } catch {
    /* history is non-critical — never surface */
  }
}

/** The signed-in user's most recent conversations (RLS scopes to them). */
export async function listConversations(limit = 30): Promise<ConvRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await createClient()
      .from("conversations")
      .select("id, title, question, created_at")
      .order("last_message_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as ConvRow[];
  } catch {
    return [];
  }
}

/** Load one conversation by id (RLS ensures it's the caller's own). */
export async function loadConversation(id: string): Promise<ConvFull | null> {
  if (!isSupabaseConfigured || !id) return null;
  try {
    const { data, error } = await createClient()
      .from("conversations")
      .select("question, models, result")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return {
      question: typeof data.question === "string" ? data.question : "",
      models: Array.isArray(data.models) ? (data.models as string[]) : [],
      result: data.result ?? null,
    };
  } catch {
    return null;
  }
}

export async function deleteConversation(id: string): Promise<void> {
  if (!isSupabaseConfigured || !id) return;
  try {
    await createClient().from("conversations").delete().eq("id", id);
  } catch {
    /* non-critical */
  }
}
