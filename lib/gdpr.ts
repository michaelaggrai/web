import type { SupabaseClient } from "@supabase/supabase-js";

// Single source of truth for the tables that hold a user's personal data, used by
// BOTH the export and delete endpoints. When a new user-keyed table is added,
// extend this file ONLY — so export/delete can never silently drift out of sync
// with the schema.
//
// Linkage today (P6b Phase 6 — `messages` + `usage_events` are RETIRED; their data
// now lives in questions + model_runs):
//   profiles       — id      = auth.users.id
//   questions      — user_id = auth.users.id   (anon rows, user_id NULL, are NOT this user's identified data)
//   events         — user_id = auth.users.id
//   conversations  — user_id = auth.users.id   (thread headers)
//   user_memory    — user_id = auth.users.id
//   profile_events — user_id = auth.users.id   (account-lifecycle log)
//   model_runs     — question_id → the user's questions (answer + summariser + classifier rows)

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export interface UserDataExport {
  profile: Record<string, unknown> | null;
  questions: Record<string, unknown>[];
  model_runs: Record<string, unknown>[];
  events: Record<string, unknown>[];
  conversations: Record<string, unknown>[];
  user_memory: Record<string, unknown> | null;
  profile_events: Record<string, unknown>[];
}

// Gather every row of the user's personal data for a GDPR Article-15/20 export.
export async function gatherUserData(admin: SupabaseClient, userId: string): Promise<UserDataExport> {
  const [profile, questions, events, conversations, userMemory, profileEvents] = await Promise.all([
    admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
    admin.from("questions").select("*").eq("user_id", userId),
    admin.from("events").select("*").eq("user_id", userId),
    admin.from("conversations").select("*").eq("user_id", userId),
    admin.from("user_memory").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("profile_events").select("*").eq("user_id", userId),
  ]);
  const qids = (questions.data ?? []).map((q) => q.id as string);
  const model_runs: Record<string, unknown>[] = [];
  // Batch the question-linked model_runs so a heavy user can't blow the IN() limit.
  for (const c of chunk(qids, 200)) {
    const mr = await admin.from("model_runs").select("*").in("question_id", c);
    model_runs.push(...(mr.data ?? []));
  }
  return {
    profile: profile.data ?? null,
    questions: questions.data ?? [],
    model_runs,
    events: events.data ?? [],
    conversations: conversations.data ?? [],
    user_memory: userMemory.data ?? null,
    profile_events: profileEvents.data ?? [],
  };
}

// Hard-delete every row of the user's personal data, then the auth user itself.
// Explicit per-table deletes (not FK-cascade-dependent) so deletion is guaranteed
// regardless of the FK config, and auditable. Returns the deleteUser result.
export async function deleteUserData(admin: SupabaseClient, userId: string) {
  const qids = ((await admin.from("questions").select("id").eq("user_id", userId)).data ?? []).map((q) => q.id as string);
  for (const c of chunk(qids, 200)) {
    await admin.from("model_runs").delete().in("question_id", c);
  }
  await admin.from("user_memory").delete().eq("user_id", userId);
  await admin.from("profile_events").delete().eq("user_id", userId);
  await admin.from("questions").delete().eq("user_id", userId);
  await admin.from("events").delete().eq("user_id", userId);
  await admin.from("conversations").delete().eq("user_id", userId);
  await admin.from("profiles").delete().eq("id", userId);
  // Finally remove the auth user (cascades anything user_id-FK'd we might miss).
  return admin.auth.admin.deleteUser(userId);
}
