// Pseudonymous per-browser id for anonymous visitors.
//
// This is NOT identity. It's a random id persisted in localStorage and sent on
// /api/ask so the backend tracking log can tell distinct anonymous browsers
// apart and follow a single anonymous session — with NO personal data. Clearing
// storage, or using another device / incognito window, yields a fresh id.
// Signed-in users are identified by their account, so this is ignored for them.
//
// GDPR/PECR (Phase 4b): a PERSISTENT visitor identifier is non-essential storage,
// so it is consent-gated. It exists ONLY after the user Accepts analytics; before
// a choice is made, or after Reject, we store nothing, return null, and clear any
// id left behind by a previous Accept. Enforcement is mirrored server-side.

import { analyticsAllowed } from "@/lib/consent";

const KEY = "aggrai_anon_id";

function freshId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Stable anon id for this browser, creating + persisting one on first use —
 *  but only with analytics consent (see file header). Without it: return null
 *  and remove any previously-stored id. */
export function getAnonId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    if (!analyticsAllowed()) {
      // No consent → no persistent identifier. Clear one left over from a prior Accept.
      window.localStorage.removeItem(KEY);
      return null;
    }
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = freshId();
      window.localStorage.setItem(KEY, id);
    }
    // Match the backend's allowed charset; never send anything unexpected.
    return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null;
  } catch {
    return null; // storage disabled / private mode — backend just records null
  }
}

/** AGG-44 attribution: the first-touch acquisition ref that /share writes as the
 *  `aggrai_ref` cookie (e.g. `share:<shareId>`; first link in wins, 30 days).
 *  Passed in the signup metadata so `handle_new_user()` can stamp `profiles.ref`
 *  and `log_profile_tier_event()` can echo it onto the signup + upgrade rows in
 *  `profile_events` — a direct share → signup → paid chain, instead of inferring
 *  it by matching `anon_id`. Consent-gated on the same signal as `getAnonId`:
 *  no analytics consent, no attribution. Charset mirrors the trigger's check. */
export function getShareRef(): string | null {
  if (typeof window === "undefined") return null;
  try {
    if (!analyticsAllowed()) return null;
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith("aggrai_ref="))
      ?.slice("aggrai_ref=".length);
    if (!raw) return null;
    const ref = decodeURIComponent(raw);
    return /^[A-Za-z0-9_:.-]{1,80}$/.test(ref) ? ref : null;
  } catch {
    return null; // cookies blocked — attribution is best-effort
  }
}
