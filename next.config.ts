import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "aggrai",
  project: "aggrai-web",
  // Source-map upload (readable stack traces) runs when the
  // SENTRY_AUTH_TOKEN env var is present — set it in Vercel.
  // Builds without the token still succeed; upload is just skipped.
});
