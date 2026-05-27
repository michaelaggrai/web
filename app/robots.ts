// AGG-40: robots.txt served from this file at /robots.txt.
//
// Allow crawlers on the public marketing pages. Disallow /api (no value
// for crawlers, just API noise), /app and /settings (auth-only), and
// /login (the V1 password gate — also NOINDEXed per-page).

import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aggrai.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/app", "/settings", "/login"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
