// Thin conversation helpers for SIGNED-IN users. As of P6b Phase 6 the `messages`
// table is RETIRED — conversation turns live in questions + model_runs (the source
// of truth, read via lib/thread.ts and written by the /converse backend).
// appendMessage is now a no-op stub (kept so the app-page call sites need no
// change); the live piece here is bumpConversation, which keeps the thin
// `conversations` header fresh for recents ordering. ConvMessage is the shape
// lib/thread.ts returns for toFollowups.

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type MessageRole = "user" | "assistant_single" | "assistant_comparison";

export interface ConvMessage {
  turn: number;
  role: MessageRole;
  model_id: string | null;
  content: string | null;
  // The Result blob for assistant_comparison turns — kept `unknown` to avoid a
  // circular import with app/app/page.tsx. Cast at the call site.
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

// P6b Phase 6: no-op. Follow-up turns are persisted by the /converse backend into
// questions + model_runs; the messages dual-write is retired. Kept as a stub so
// the app-page call sites need no change.
export async function appendMessage(_conversationId: string, _msg: AppendMessageInput): Promise<void> {
  return;
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
