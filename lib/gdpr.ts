import type { SupabaseClient } from "@supabase/supabase-js";

// Single source of truth for the tables that hold a user's personal data, used
// by BOTH the export and delete endpoints. When Phase 5 lands (messages,
// user_memory) or any new user-keyed table is added, extend this file ONLY —
// so export/delete can never silently drift out of sync with the schema.
//
// Linkage today:
//   profiles       — id      = auth.users.id
//   questions      — user_id = auth.users.id   (anon rows, user_id NULL, are NOT this user's identified data)
//   events         — user_id = auth.users.id
//   conversations  — user_id = auth.users.id
//   model_runs     — question_id → the user's questions
//   usage_events   — question_id → the user's questions

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export interface UserDataExport {
  profile: Record<string, unknown> | null;
  questions: Record<string, unknown>[];
  model_runs: Record<string, unknown>[];
  usage_events: Record<string, unknown>[];
  events: Record<string, unknown>[];
  conversations: Record<string, unknown>[];
}

// Gather every row of the user's personal data for a GDPR Article-15/20 export.
export async function gatherUserData(admin: SupabaseClient, userId: string): Promise<UserDataExport> {
  const [profile, questions, events, conversations] = await Promise.all([
    admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
    admin.from("questions").select("*").eq("user_id", userId),
    admin.from("events").select("*").eq("user_id", userId),
    admin.from("conversations").select("*").eq("user_id", userId),
  ]);
  const qids = (questions.data ?? []).map((q) => q.id as string);
  const model_runs: Record<string, unknown>[] = [];
  const usage_events: Record<string, unknown>[] = [];
  // Batch the question-linked tables so a heavy user can't blow the IN() limit.
  for (const c of chunk(qids, 200)) {
    const [mr, ue] = await Promise.all([
      admin.from("model_runs").select("*").in("question_id", c),
      admin.from("usage_events").select("*").in("question_id", c),
    ]);
    model_runs.push(...(mr.data ?? []));
    usage_events.push(...(ue.data ?? []));
  }
  return {
    profile: profile.data ?? null,
    questions: questions.data ?? [],
    model_runs,
    usage_events,
    events: events.data ?? [],
    conversations: conversations.data ?? [],
  };
}

// Hard-delete every row of the user's personal data, then the auth user itself.
// Explicit per-table deletes (not FK-cascade-dependent) so deletion is guaranteed
// regardless of the FK config, and auditable. Returns the deleteUser result.
export async function deleteUserData(admin: SupabaseClient, userId: string) {
  const qids = ((await admin.from("questions").select("id").eq("user_id", userId)).data ?? []).map((q) => q.id as string);
  for (const c of chunk(qids, 200)) {
    await admin.from("model_runs").delete().in("question_id", c);
    await admin.from("usage_events").delete().in("question_id", c);
  }
  await admin.from("questions").delete().eq("user_id", userId);
  await admin.from("events").delete().eq("user_id", userId);
  await admin.from("conversations").delete().eq("user_id", userId);
  await admin.from("profiles").delete().eq("id", userId);
  // Finally remove the auth user (cascades anything user_id-FK'd we might miss).
  return admin.auth.admin.deleteUser(userId);
}
