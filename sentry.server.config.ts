import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://5f36c1a224eb799f05f0e43c5a8ed5c0@o4511430108905472.ingest.de.sentry.io/4511430125355088",
  // Errors only — no performance tracing
  tracesSampleRate: 0,
  // Don't ship local-dev errors to Sentry
  enabled: process.env.NODE_ENV === "production",
});
