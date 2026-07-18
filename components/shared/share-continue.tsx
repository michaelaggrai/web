"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { ShareSnapshot } from "@/lib/share";

const DEFAULT_CTA_CLASS =
  "mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 px-5 py-2.5 text-sm font-semibold text-navy hover:from-teal-400 hover:to-teal-400 transition shadow-lg shadow-teal-500/20 disabled:opacity-70";

// AGG-44 continue: fork a shared conversation into the VIEWER's own thread so they
// can actually continue it (not just land on a blank /app). A signed-in viewer
// POSTs to /api/share/[id]/fork, which seeds a new /app/c/{id} they own with ALL
// turns (root + follow-ups); /converse then reads that thread for full context.
//
// Anyone can continue regardless of tier: the link is public and /converse
// re-gates each follow-up model against the viewer's plan, so gating here would
// be redundant (and free-tier shares pass anyway). Anon viewers have no account
// to own a fork, so they fall back to the models-only handoff (and during closed
// beta hit the login gate on /app regardless).
export function ShareContinue({
  id,
  models,
  snapshot,
  label = "Continue in aggrai →",
  className = DEFAULT_CTA_CLASS,
}: {
  id: string;
  models: string[];
  snapshot: ShareSnapshot;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    if (!isSupabaseConfigured) {
      setSignedIn(false);
      return;
    }
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (alive) setSignedIn(!!data.user);
      })
      .catch(() => {
        if (alive) setSignedIn(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const handoffHref = models.length
    ? `/app?models=${encodeURIComponent(models.join(","))}`
    : "/app";

  async function onContinue() {
    if (busy) return;
    const root = snapshot.turns[0];

    // Resolve auth authoritatively at click time — the effect may not have
    // resolved yet, and we don't want a fast click to mis-route a signed-in
    // viewer to the anon handoff.
    let authed = signedIn;
    if (authed === null) {
      if (!isSupabaseConfigured) authed = false;
      else {
        try {
          const { data } = await createClient().auth.getUser();
          authed = !!data.user;
        } catch {
          authed = false;
        }
      }
    }

    // Only a comparison root can be forked into a continuable thread (a direct
    // answer has no models to continue with). Anon / anything else → the handoff.
    if (!authed || !root || root.kind !== "compare" || models.length === 0) {
      router.push(handoffHref);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/share/${encodeURIComponent(id)}/fork`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.conversationId === "string") {
        router.push(`/app/c/${data.conversationId}`);
      } else {
        // Not signed in server-side / not forkable / error → never dead-end.
        router.push(handoffHref);
      }
    } catch {
      router.push(handoffHref);
    }
  }

  return (
    <button type="button" onClick={onContinue} disabled={busy} className={className}>
      {busy ? "Setting up…" : label}
    </button>
  );
}
