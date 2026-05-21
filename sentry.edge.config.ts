import * as Sentry from "@sentry/nextjs";

// Edge runtime — used by the streaming /api/ask route
Sentry.init({
  dsn: "https://5f36c1a224eb799f05f0e43c5a8ed5c0@o4511430108905472.ingest.de.sentry.io/4511430125355088",
  tracesSampleRate: 0,
  enabled: process.env.NODE_ENV === "production",
});
