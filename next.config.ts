import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  silent: true,
  // Source-map upload needs SENTRY_AUTH_TOKEN + org/project slugs.
  // Disabled for now — errors are still captured, just with minified
  // stack traces. Add the token and remove this to get readable traces.
  sourcemaps: { disable: true },
});
