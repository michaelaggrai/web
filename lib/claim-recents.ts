// Round-2 #9: carry an anonymous user's in-browser recents into their account
// on sign-in, so the asks they made before signing up aren't stranded in
// sessionStorage. Best-effort + idempotent: saveConversation upserts by the
// same conv id, so re-running on a later sign-in is a no-op, and a blocked
// sessionStorage just means nothing to claim.
//
// Single-browser scope for V2 (only convs in THIS browser's sessionStorage) —
// a cross-device anon_id -> user_id identity map is the later multi-device fix.

import { loadConv } from "@/lib/conv-id";
import { saveConversation } from "@/lib/history";

const KEY_PREFIX = "aggrai-conv-";

/** Push every sessionStorage conv into the signed-in user's Supabase history.
 *  Returns how many were claimed (for an optional "added N" hint). */
export async function claimAnonRecents(): Promise<number> {
  if (typeof window === "undefined") return 0;
  let ids: string[] = [];
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(KEY_PREFIX)) ids.push(k.slice(KEY_PREFIX.length));
    }
  } catch {
    return 0; // sessionStorage blocked (private mode) — nothing to claim
  }
  let claimed = 0;
  for (const id of ids) {
    const conv = loadConv(id);
    if (!conv || !conv.question.trim()) continue;
    // saveConversation is a no-op for anon / unconfigured Supabase and RLS-scoped
    // to the caller, so it only writes once the user is actually signed in.
    await saveConversation(id, { question: conv.question, models: conv.models, result: conv.result });
    claimed++;
  }
  return claimed;
}
