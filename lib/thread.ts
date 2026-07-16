// Reconstruct a conversation thread from the raw source-of-truth tables
// (questions + model_runs) — the Model-B reader that replaces lib/messages.ts's
// listMessages (Phase 4 of the raw-model collapse). Returns the SAME ConvMessage[]
// shape, so toFollowups + all downstream rendering in app/app/page.tsx are
// unchanged; the call site just swaps listMessages(id) -> listThread(id).
//
// Owner-only via RLS (questions_select_own + model_runs_select_own); a no-op for
// anonymous users / unconfigured Supabase, mirroring lib/messages.ts. The answer
// text + result blob it reads exist only for signed-in asks (the V1 privacy
// contract) — which is exactly the owner reading their own thread.
//
// Grain mapping: one questions row is an ask stamped at its odd assistant-turn N.
// It becomes TWO ConvMessages — a `user` turn (N-1, the question text) and the
// assistant turn (N). The assistant turn is assistant_comparison when the row
// carries a compare `result` ("ask all again"), else assistant_single (the single
// model_runs answer). The root (turn 1) is skipped — it's rendered from the
// conversations header via loadConversation, exactly as before.

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { ConvMessage } from "@/lib/messages";

type QRow = { id: string; turn: number; question: string | null; result: Record<string, unknown> | null };
type RunRow = {
  question_id: string;
  model: string;
  answer: string | null;
  runtime_ms: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  truncated: boolean | null;
  scores: Record<string, unknown> | null;
};

export async function listThread(conversationId: string): Promise<ConvMessage[]> {
  if (!isSupabaseConfigured || !conversationId) return [];
  try {
    const supa = createClient();
    // Follow-up asks only (turn >= 2). Roots are turn 1, rendered from the header.
    const { data: qData, error: qErr } = await supa
      .from("questions")
      .select("id, turn, question, result")
      .eq("conversation_id", conversationId)
      .gte("turn", 2)
      .order("turn", { ascending: true });
    if (qErr || !qData || qData.length === 0) return [];
    const qs = qData as QRow[];

    const ids = qs.map((q) => q.id);
    const { data: rData, error: rErr } = await supa
      .from("model_runs")
      .select("question_id, model, answer, runtime_ms, total_tokens, cost_usd, truncated, scores")
      .in("question_id", ids)
      .eq("role", "answer");
    if (rErr) return [];
    const runsByQ = new Map<string, RunRow[]>();
    for (const r of (rData ?? []) as RunRow[]) {
      const arr = runsByQ.get(r.question_id);
      if (arr) arr.push(r);
      else runsByQ.set(r.question_id, [r]);
    }

    const out: ConvMessage[] = [];
    for (const q of qs) {
      const runs = runsByQ.get(q.id) ?? [];
      // The user's question for this turn (message-row grain: even turn N-1).
      out.push({ turn: q.turn - 1, role: "user", model_id: null, content: q.question ?? "", result: null });
      if (q.result) {
        // "Ask all again" compare turn — rebuild the full Result blob.
        out.push({ turn: q.turn, role: "assistant_comparison", model_id: null, content: null, result: buildResult(q, runs) });
      } else {
        // Single-model continuation — one answer run.
        const r = runs[0];
        out.push({ turn: q.turn, role: "assistant_single", model_id: r?.model ?? null, content: r?.answer ?? "", result: null });
      }
    }
    return out;
  } catch {
    return [];
  }
}

// Rebuild the compare Result (the shape app/app/page.tsx renders) from the
// normalized pieces: questions.result holds the aggregation (summary /
// contributions / attributions), model_runs holds the per-model answers + scores.
function buildResult(q: QRow, runs: RunRow[]): unknown {
  const res = (q.result ?? {}) as Record<string, unknown>;
  return {
    type: "compare",
    question: q.question ?? "",
    summary: (res.summary as string) ?? "",
    answers: runs.map((r) => {
      const s = r.scores;
      return {
        model: r.model,
        answer: r.answer ?? "",
        runtime_ms: r.runtime_ms ?? 0,
        tokens: r.total_tokens ?? 0,
        cost_usd: r.cost_usd,
        truncated: r.truncated ?? false,
        scores: s
          ? {
              accuracy: s.accuracy as number,
              completeness: s.completeness as number,
              calibration: s.calibration as number,
              clarity: s.clarity as number,
              insight: s.insight as number,
              strengths: (s.strengths as string[]) ?? [],
              weaknesses: (s.weaknesses as string[]) ?? [],
            }
          : null,
      };
    }),
    contributions: (res.contributions as unknown) ?? null,
    section_attributions: (res.section_attributions as unknown) ?? null,
    failed: (res.failed as unknown) ?? undefined,
    recencyWarning: (res.recencyWarning as boolean) ?? undefined,
  };
}
