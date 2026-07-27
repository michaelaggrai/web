import { analyticsAllowed } from "@/lib/consent";

// GDPR: browser error monitoring (Sentry) is a NON-ESSENTIAL / analytics
// collector, so it only runs once the user has accepted cookies.
//
// Perf: we ALSO dynamic-import the SDK (instead of a static top-level import),
// so the ~large Sentry bundle is downloaded + parsed ONLY after consent — a
// first-time or declining visitor's initial load never pays for code that will
// never run (a meaningful win on mobile, where JS parse is CPU-bound). Accepting
// in the banner reloads the page, so this re-runs with consent === "accepted"
// and the chunk loads then.
let sentry: typeof import("@sentry/nextjs") | null = null;

if (analyticsAllowed()) {
  import("@sentry/nextjs")
    .then((mod) => {
      sentry = mod;
      mod.init({
        dsn: "https://5f36c1a224eb799f05f0e43c5a8ed5c0@o4511430108905472.ingest.de.sentry.io/4511430125355088",
        // Errors only — no performance tracing, no session replay.
        tracesSampleRate: 0,
        enabled: process.env.NODE_ENV === "production",
        // Drop benign fetch cancellations (Stop button, navigating away
        // mid-stream, closing the tab, an aborted route prefetch) so they don't
        // trip the high-priority alert. Matched by type so it covers every
        // browser's message. The trailing entries are browser-EXTENSION noise
        // attributed to our page but never our code — mirrors the backend
        // foreign-noise filter in api/instrument.js.
        ignoreErrors: [
          "AbortError",
          "The user aborted a request",
          "has no method",
          "updateFrom",
          "Test Issue",
        ],
        // Drop anything thrown from a browser extension / injected script.
        denyUrls: [
          /extensions\//i,
          /^chrome(-extension)?:\/\//i,
          /^moz-extension:\/\//i,
          /^safari-(web-)?extension:\/\//i,
          /\/views\.js/i,
        ],
      });
    })
    .catch(() => {
      /* monitoring is best-effort — a failed SDK load must never affect the app */
    });
}

// Next calls this on every client-side router transition. Forward to Sentry once
// the chunk has loaded; a no-op before consent (or while it's still loading).
export function onRouterTransitionStart(
  ...args: Parameters<typeof import("@sentry/nextjs").captureRouterTransitionStart>
): void {
  sentry?.captureRouterTransitionStart(...args);
}
