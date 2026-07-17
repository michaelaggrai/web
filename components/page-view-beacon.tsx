"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getAnonId } from "@/lib/anon-id";
import { getSessionId } from "@/lib/session-id";

// AGG-21/AGG-27: the page-view beacon.
//
// The browser is the only tier that can see a page view, so it posts one to
// /api/events on first load and on every client-side route change. This is what
// gives analytics.funnel_daily its `landed` step.
//
// `from` (the previous in-app path) is the load-bearing bit: SPA navigations do
// NOT update document.referrer, so without it there's no way to tell whether
// someone reached /settings/analytics from the sidebar link or from the Settings
// section. It replaces a pile of would-be *_clicked event types — every
// navigation already produces a page_view, so the only thing missing was which
// link they came from.
//
// referrer + utm_* only describe the EXTERNAL entry to a session, so they're sent
// on the first view and omitted thereafter (a client-side nav keeps the original
// document.referrer, which would double-count the source).
//
// Identifiers come from getAnonId()/getSessionId(), which already return null
// without analytics consent; /api/events re-applies that gate server-side, so a
// forged body can't smuggle them back in. UTM is read from
// window.location.search rather than useSearchParams() so mounting this in the
// root layout doesn't opt every page out of static rendering.

export function PageViewBeacon() {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);
  const isFirst = useRef(true);

  useEffect(() => {
    if (!pathname) return;

    const from = prevPath.current; // null on the first view — no in-app predecessor
    prevPath.current = pathname;
    const first = isFirst.current;
    isFirst.current = false;

    let utm: Record<string, string | null> = {};
    let referrer: string | null = null;
    if (first) {
      try {
        const q = new URLSearchParams(window.location.search);
        utm = {
          utm_source: q.get("utm_source"),
          utm_medium: q.get("utm_medium"),
          utm_campaign: q.get("utm_campaign"),
        };
        referrer = document.referrer || null;
      } catch {
        /* ignore */
      }
    }

    try {
      const body = JSON.stringify({
        type: "page_view",
        anon_id: getAnonId(),
        session_id: getSessionId(),
        props: { path: pathname, from, referrer, ...utm },
      });
      // keepalive so the beacon survives an immediate navigation or unload.
      void fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        /* analytics must never break the page */
      });
    } catch {
      /* ignore */
    }
  }, [pathname]);

  return null;
}
