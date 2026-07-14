// Persistent conversation turns for SIGNED-IN users (Phase 5a, AGG-29).
//
// A conversation (lib/history.ts, table `conversations`) is the thread header;
// each turn is a row here in `messages`. Roles:
//   • user                 — the person's question for that turn
//   • assistant_comparison — a multi-model turn; the full Result blob in `result`
//   • assistant_single     — a single-model continuation; the answer in `content`
//
// Owner-only RLS, best-effort (a failed write never breaks a comparison), and a
// no-op for anonymous users / unconfigured Supabase. Anonymous visitors keep the
// sessionStorage path (lib/conv-id.ts) and can't continue a thread.

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type MessageRole = "user" | "assistant_single" | "assistant_comparison";

export interface ConvMessage {
  turn: number;
  role: MessageRole;
  model_id: string | null;
  content: string | null;
  // The Result blob for assistant_comparison turns — kept `unknown` to avoid a
  // circular import with app/app/page.tsx (same reason as lib/history.ts). Cast
  // at the call site.
  result: unknown;
  created_at?: string;
}

export interface AppendMessageInput {
  turn: number;
  role: MessageRole;
  model_id?: string | null;
  question_id?: string | null;
  content?: string | null;
  result?: unknown;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  cost_usd?: number | null;
  latency_ms?: number | null;
}

async function uid(): Promise<string | null> {
  try {
    const { data } = await createClient().auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

// Append one turn. Idempotent on (conversation_id, turn, role) — a retry or a
// double-fire won't duplicate. No-op for anonymous / unconfigured. Best-effort.
export async function appendMessage(conversationId: string, msg: AppendMessageInput): Promise<void> {
  if (!isSupabaseConfigured || !conversationId) return;
  try {
    const user_id = await uid();
    if (!user_id) return;
    const row: Record<string, unknown> = {
      conversation_id: conversationId,
      user_id,
      turn: msg.turn,
      role: msg.role,
      model_id: msg.model_id ?? null,
      question_id: msg.question_id ?? null,
      content: msg.content ?? null,
      result: msg.result ?? null,
      prompt_tokens: msg.prompt_tokens ?? null,
      completion_tokens: msg.completion_tokens ?? null,
      cost_usd: msg.cost_usd ?? null,
      latency_ms: msg.latency_ms ?? null,
    };
    await createClient().from("messages").upsert(row, { onConflict: "conversation_id,turn,role" });
  } catch {
    /* history is non-critical — never surface */
  }
}

// All turns of a conversation, ordered (RLS ensures it's the caller's own).
export async function listMessages(conversationId: string): Promise<ConvMessage[]> {
  if (!isSupabaseConfigured || !conversationId) return [];
  try {
    const { data, error } = await createClient()
      .from("messages")
      .select("turn, role, model_id, content, result, created_at")
      .eq("conversation_id", conversationId)
      .order("turn", { ascending: true });
    if (error || !data) return [];
    return data as ConvMessage[];
  } catch {
    return [];
  }
}

// Mark a conversation as freshly active — floats it to the top of recents and
// records how many turns it holds. Called after a continuation lands.
export async function bumpConversation(conversationId: string, turnCount: number): Promise<void> {
  if (!isSupabaseConfigured || !conversationId) return;
  try {
    await createClient()
      .from("conversations")
      .update({ last_message_at: new Date().toISOString(), turn_count: turnCount })
      .eq("id", conversationId);
  } catch {
    /* non-critical */
  }
}
