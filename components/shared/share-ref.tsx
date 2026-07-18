"use client";

import { useEffect } from "react";

// AGG-44 attribution: when someone opens a shared link, remember (first-touch)
// which share they came from, so a later ask can be attributed to it. Also
// counts the view. All best-effort — blocked cookies just mean no attribution.
export function ShareRef({ id }: { id: string }) {
  useEffect(() => {
    try {
      // First-touch: only set if they don't already carry a ref, so the FIRST
      // shared link that brought them in wins the attribution.
      const has = document.cookie.split("; ").some((c) => c.startsWith("aggrai_ref="));
      if (!has) {
        document.cookie = `aggrai_ref=share:${id}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
      }
      navigator.sendBeacon?.("/api/share/view", JSON.stringify({ id }));
    } catch {
      /* private mode / blocked — attribution is best-effort */
    }
  }, [id]);
  return null;
}
