import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { rateLimitOk, clientIpKey } from "@/lib/rate-limit";
import type { ShareSnapshot, ShareTurn, ShareScores } from "@/lib/share";

// AGG-44: fork a shared conversation — ALL turns — into the signed-in viewer's
// own thread so they can continue it with full context. The root seeds the
// `conversations` header (question + the Result the app renders); each follow-up
// turn seeds a `questions` row at its odd assistant-turn N (3, 5, 7, …) plus its
// `model_runs` answers, in the exact shape /converse (loadConversationMessages)
// and the app (lib/thread.ts listThread) read back. Service-role because those
// tables are backend-written — the client has no RLS INSERT. Anonymous viewers
// have no account to own a fork, so the client hands them off instead.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function newConvId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

// The app's Answer.scores wants the 5 numeric dims (0-5) + optional critique.
// New snapshots carry them; legacy (headline-only) snapshots → null (no rail).
function dims(s: ShareScores | null | undefined) {
  if (!s || typeof s.accuracy !== "number") return null;
  return {
    accuracy: s.accuracy,
    completeness: s.completeness ?? 0,
    calibration: s.calibration ?? 0,
    clarity: s.clarity ?? 0,
    insight: s.insight ?? 0,
    ...(s.strengths?.length ? { strengths: s.strengths } : {}),
    ...(s.weaknesses?.length ? { weaknesses: s.weaknesses } : {}),
  };
}

// Rebuild the compare Result the app renders for the root turn (turns[0]).
function rootResult(turn: Extract<ShareTurn, { kind: "compare" }>) {
  return {
    type: "compare",
    question: turn.question,
    summary: turn.summary,
    answers: turn.answers.map((a) => ({
      model: a.model,
      answer: a.answer,
      runtime_ms: a.runtime_ms ?? 0,
      tokens: a.tokens ?? 0,
      cost_usd: null,
      truncated: a.truncated ?? false,
      scores: dims(a.scores),
    })),
    contributions: turn.contributions ?? null,
    ...(turn.sources && turn.sources.length ? { search: { ok: true, sources: turn.sources } } : {}),
  };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await rateLimitOk(`fork:${clientIpKey(req)}`, 30, 3600))) {
    return NextResponse.json({ error: "Too many. Try again shortly." }, { status: 429 });
  }

  // Fork is signed-in only — the thread is owned, RLS-scoped history.
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} },
  });
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });

  const admin = createAdminClient();
  const { data: share } = await admin
    .from("conversation_shares")
    .select("snapshot, models, title, revoked")
    .eq("id", id)
    .maybeSingle();
  if (!share || share.revoked) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const snapshot = share.snapshot as ShareSnapshot;
  const turns: ShareTurn[] = Array.isArray(snapshot?.turns) ? snapshot.turns : [];
  const root = turns[0];
  if (!root || root.kind !== "compare") {
    // A direct/single root has no model comparison to continue from.
    return NextResponse.json({ error: "not_forkable" }, { status: 422 });
  }
  const models: string[] = (share.models as string[]) ?? snapshot.models ?? [];
  const newId = newConvId();
  const now = new Date().toISOString();

  // 1. Root turn → conversations header (turns 0/1 — read by loadConversationRoot
  //    for context + loadConversation for the app's render).
  const { error: convErr } = await admin.from("conversations").insert({
    id: newId,
    user_id: userId,
    title: String(share.title || root.question || "aggrai comparison").slice(0, 200),
    question: root.question,
    models,
    result: rootResult(root),
    created_at: now,
    updated_at: now,
    last_message_at: now,
  });
  if (convErr) {
    console.error("[fork] conversations insert failed", convErr.message);
    return NextResponse.json({ error: "fork_failed" }, { status: 500 });
  }

  // 2. Follow-up turns → questions (odd assistant-turn N) + model_runs answers.
  //    Turn numbering mirrors submitContinuation: first follow-up = turn 3, then
  //    5, 7, … (the question rides the assistant turn; the user turn is N-1, which
  //    the readers derive). A compare turn stores its aggregate in questions.result
  //    (summary + contributions) with per-model answers in model_runs; a single
  //    turn stores just the one answer run.
  const followups = turns.slice(1);
  const qRows: Record<string, unknown>[] = [];
  const runRows: Record<string, unknown>[] = [];
  followups.forEach((turn, i) => {
    const dbTurn = 2 * i + 3;
    const qid = crypto.randomUUID();
    qRows.push({
      id: qid,
      conversation_id: newId,
      user_id: userId,
      turn: dbTurn,
      question: turn.question,
      result: turn.kind === "compare" ? { summary: turn.summary, contributions: turn.contributions ?? null } : null,
      type: "converse",
      ts: now,
    });
    if (turn.kind === "compare") {
      for (const a of turn.answers) {
        runRows.push({
          question_id: qid,
          role: "answer",
          model: a.model,
          answer: a.answer,
          scores: dims(a.scores),
          runtime_ms: a.runtime_ms ?? null,
          total_tokens: a.tokens ?? null,
          truncated: a.truncated ?? false,
        });
      }
    } else if (turn.kind === "single") {
      runRows.push({ question_id: qid, role: "answer", model: turn.model, answer: turn.answer });
    }
  });

  // questions FIRST — model_runs FK to them.
  if (qRows.length) {
    const { error } = await admin.from("questions").insert(qRows);
    if (error) console.error("[fork] questions insert failed", error.message);
  }
  if (runRows.length) {
    const { error } = await admin.from("model_runs").insert(runRows);
    if (error) console.error("[fork] model_runs insert failed", error.message);
  }

  // Reflect the thread length so recents order + the app's turn counter are sane.
  const lastTurn = followups.length ? 2 * (followups.length - 1) + 3 : 1;
  await admin.from("conversations").update({ turn_count: lastTurn + 1, last_message_at: now }).eq("id", newId);

  return NextResponse.json({ conversationId: newId });
}
