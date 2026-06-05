// Per-TAB session id for analytics.
//
// Unlike the anon id (lib/anon-id, localStorage = a PERSISTENT visitor id), this
// lives in sessionStorage: it lasts for one browser-tab session and resets when
// the tab/window closes. Forwarded on /api/ask as x-aggrai-session-id so the
// backend tracking log can count sessions + asks-per-session (visitor → session
// → ask). NOT identity — no personal data.

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

/** Stable id for this browser-tab session, creating + persisting one on first use. */
export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
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
