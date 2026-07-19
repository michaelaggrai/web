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
// Tier policy (matches the in-app continue gate): a comparison built entirely
// from Free-tier models can be continued by an account-less GUEST — we mint an
// anonymous Supabase session so they own + continue a fork with NO signup. If
// any model is above Free (`allFree` false), continuing needs a paid account,
// so we skip the guest mint and route to sign-in rather than fork a throwaway
// anon user into the app's upgrade gate. Either way /converse re-gates each
// follow-up against the viewer's plan, so this is UX, not the security boundary.
export function ShareContinue({
  id,
  models,
  snapshot,
  allFree = false,
  label = "Continue in aggrai →",
  className = DEFAULT_CTA_CLASS,
}: {
  id: string;
  models: string[];
  snapshot: ShareSnapshot;
  /** Every model is Free-tier → an account-less guest may continue (no signup). */
  allFree?: boolean;
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
    // Only a comparison root forks into a continuable thread (a direct answer has
    // no models to continue with).
    const forkable = !!root && root.kind === "compare" && models.length > 0;

    // Resolve auth authoritatively at click time — the effect may not have
    // resolved yet, and we don't want a fast click to mis-route a signed-in viewer.
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

    if (!forkable) {
      router.push(handoffHref);
      return;
    }

    setBusy(true);
    // Guest continuation (Free-tier conversations only): account-less viewers get
    // an anonymous Supabase session so they can own + continue a fork WITHOUT
    // signing up. Requires "anonymous sign-ins" enabled on the project; if it's
    // off, signInAnonymously errors and we fall back to signup (?next auto-forks
    // on return — no dead-end). For a conversation with above-Free models we skip
    // this entirely: a guest couldn't continue it anyway, so we send them to
    // sign-in rather than mint a throwaway anon user + a fork they'd hit the
    // upgrade gate on.
    if (!authed && isSupabaseConfigured && allFree) {
      try {
        const { data, error } = await createClient().auth.signInAnonymously();
        if (!error && data?.user) authed = true;
      } catch {
        /* anonymous sign-ins disabled — fall through to signup */
      }
    }
    if (!authed) {
      router.push(`/signin?next=${encodeURIComponent(`/app?fork=${id}`)}`);
      return;
    }

    try {
      const res = await fetch(`/api/share/${encodeURIComponent(id)}/fork`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.conversationId === "string") {
        router.push(`/app/c/${data.conversationId}`);
      } else if (res.status === 401) {
        // Session lapsed between the client check and the server → sign in first.
        router.push(`/signin?next=${encodeURIComponent(`/app?fork=${id}`)}`);
      } else {
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
