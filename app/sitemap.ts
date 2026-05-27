// AGG-40: sitemap.xml served from this file at /sitemap.xml.
//
// Lists every publicly-discoverable route. /app, /settings and /login are
// deliberately omitted — /app and /settings require authentication, /login
// is the V1 password gate (NOINDEXed via its own page metadata too). The
// proxy.ts middleware bypasses /sitemap.xml so crawlers can read this even
// while the V1 password gate is still in front of everything else.

import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aggrai.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}`,         lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/models`,  lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${SITE_URL}/docs`,    lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/help`,    lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/about`,   lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/status`,  lastModified: now, changeFrequency: "daily",   priority: 0.5 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/upgrade`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/signin`,  lastModified: now, changeFrequency: "yearly",  priority: 0.4 },
    { url: `${SITE_URL}/terms`,   lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
  ];
}
