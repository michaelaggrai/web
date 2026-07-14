// Per-TAB session id for analytics.
//
// Unlike the anon id (lib/anon-id, localStorage = a PERSISTENT visitor id), this
// lives in sessionStorage: it lasts for one browser-tab session and resets when
// the tab/window closes. Forwarded on /api/ask as x-aggrai-session-id so the
// backend tracking log can count sessions + asks-per-session (visitor → session
// → ask). NOT identity — no personal data.
//
// GDPR/PECR (Phase 4b): session-counting is analytics, not strictly necessary, so
// like the anon id this is consent-gated — a session id is issued ONLY after the
// user Accepts. On no-choice/Reject we store nothing, return null, and clear any
// leftover value. Reject therefore sends zero analytics identifiers.

import { analyticsAllowed } from "@/lib/consent";

const KEY = "aggrai_session_id";

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

/** Stable id for this browser-tab session, creating one on first use — but only
 *  with analytics consent (see file header). Without it: return null and remove
 *  any previously-stored id. */
export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    if (!analyticsAllowed()) {
      window.sessionStorage.removeItem(KEY);
      return null;
    }
    let id = window.sessionStorage.getItem(KEY);
    if (!id) {
      id = freshId();
      window.sessionStorage.setItem(KEY, id);
    }
    // Match the backend's allowed charset; never send anything unexpected.
    return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null;
  } catch {
    return null; // storage disabled / private mode — backend just records null
  }
}
