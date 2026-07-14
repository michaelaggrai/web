// GDPR cookie consent. Two categories:
//   • essential — always on (Supabase auth session cookies). Never gated; the
//     app can't function without them and they're exempt from consent.
//   • analytics — browser error monitoring (Sentry: collects browser context +
//     a session identifier). OFF until the user explicitly Accepts.
//
// Stored in a first-party cookie so it's readable BOTH before React boots
// (instrumentation-client.ts, which decides whether to init Sentry) and inside
// React components.

export const CONSENT_COOKIE = "aggrai_consent_v1";
export type ConsentValue = "accepted" | "rejected";

export function readConsent(): ConsentValue | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE}=([^;]+)`));
  const v = m?.[1];
  return v === "accepted" || v === "rejected" ? v : null;
}

export function writeConsent(v: ConsentValue) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365; // 12 months
  document.cookie = `${CONSENT_COOKIE}=${v}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

// True only after an explicit Accept — the gate for any non-essential collector.
export function analyticsAllowed(): boolean {
  return readConsent() === "accepted";
}
