import * as Sentry from "@sentry/nextjs";
import { analyticsAllowed } from "@/lib/consent";

// GDPR: browser error monitoring is a NON-ESSENTIAL (analytics) collector, so
// Sentry only initialises once the user has accepted cookies. Accepting in the
// banner reloads the page, so this runs again with consent === "accepted".
// Until then Sentry is never init'd and captureRouterTransitionStart is a no-op.
if (analyticsAllowed()) {
Sentry.init({
  dsn: "https://5f36c1a224eb799f05f0e43c5a8ed5c0@o4511430108905472.ingest.de.sentry.io/4511430125355088",
  // Errors only — no performance tracing, no session replay
  tracesSampleRate: 0,
  enabled: process.env.NODE_ENV === "production",
  // Drop benign fetch cancellations. AbortError / DOMException code 20 fires
  // when a request is deliberately cancelled — the Stop button, navigating
  // away mid-stream, closing the tab, or a Next.js route prefetch being
  // aborted. Never a crash or data loss. The /api/ask catch already filters
  // these, but Sentry's automatic global handlers re-capture them; this stops
  // them tripping the "high priority" alert and drowning out real errors.
  // Matched by error type ("AbortError"), so it covers all browsers' messages.
  //
  // The trailing entries are browser-EXTENSION noise (e.g. a content script's
  // views.js calling a missing method) that gets attributed to our page but
  // isn't our code. Mirrors the backend foreign-noise filter in
  // api/instrument.js so neither Sentry project pages us on third-party junk.
  ignoreErrors: [
    "AbortError",
    "The user aborted a request",
    "has no method",
    "updateFrom",
    "Test Issue",
  ],
  // Drop anything thrown from a browser extension / injected script — these
  // originate from chrome-extension://, moz-extension://, a content script like
  // views.js, etc., never from our bundle, and are never actionable.
  denyUrls: [
    /extensions\//i,
    /^chrome(-extension)?:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-(web-)?extension:\/\//i,
    /\/views\.js/i,
  ],
});
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
