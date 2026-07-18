"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { saveConversation } from "@/lib/history";
import { generateConvId, storeConv } from "@/lib/conv-id";
import type { ShareSnapshot } from "@/lib/share";

// AGG-44 continue: fork a shared snapshot into the VIEWER's own conversation so
// they can actually continue it (not just land on a blank /app with the models
// pre-selected). A signed-in viewer gets a real fork — a fresh /app/c/{id} they
// own, seeded with the root comparison. The backend /converse then reads THAT
// conversations row for thread context, so the follow-up is a true continuation.
//
// Anyone can continue regardless of tier: the link is public and /converse
// re-gates each follow-up model against the viewer's plan, so gating here would
// be redundant (and these free-tier shares would pass anyway). Anon viewers have
// no account to own a fork, so they fall back to the models-only handoff (during
// closed beta they hit the login gate on /app regardless).
const DEFAULT_CTA_CLASS =
  "mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 px-5 py-2.5 text-sm font-semibold text-navy hover:from-teal-400 hover:to-teal-400 transition shadow-lg shadow-teal-500/20 disabled:opacity-70";

export function ShareContinue({
  models,
  snapshot,
  label = "Continue in aggrai →",
  className = DEFAULT_CTA_CLASS,
}: {
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
    // answer has no models to continue with). Anything else → the handoff.
    if (!authed || !root || root.kind !== "compare" || models.length === 0) {
      router.push(handoffHref);
      return;
    }

    setBusy(true);
    try {
      // Rebuild a Result from the snapshot. New snapshots carry the full rubric,
      // so the forked root renders the same Aggr-Score radar as the app; old
      // (headline-only) snapshots fork without the rail. The backend only needs
      // result.summary for continuation context either way.
      const result = {
        type: "compare",
        question: root.question,
        summary: root.summary,
        answers: root.answers.map((a) => ({
          model: a.model,
          answer: a.answer,
          runtime_ms: a.runtime_ms ?? 0,
          tokens: a.tokens ?? 0,
          cost_usd: null,
          truncated: a.truncated ?? false,
          scores:
            a.scores && typeof a.scores.accuracy === "number"
              ? {
                  accuracy: a.scores.accuracy ?? 0,
                  completeness: a.scores.completeness ?? 0,
                  calibration: a.scores.calibration ?? 0,
                  clarity: a.scores.clarity ?? 0,
                  insight: a.scores.insight ?? 0,
                  strengths: a.scores.strengths,
                  weaknesses: a.scores.weaknesses,
                }
              : null,
        })),
        contributions: root.contributions ?? null,
        ...(root.sources && root.sources.length
          ? { search: { ok: true, sources: root.sources } }
          : {}),
      };
      const newId = generateConvId();
      // Persist the forked root so /converse can read it for context (owner-RLS
      // write), and seed sessionStorage so /app/c/{id} renders instantly on
      // arrival. Await the DB write so context exists before the first follow-up.
      await saveConversation(newId, { question: root.question, models, result });
      storeConv(newId, { question: root.question, models, result });
      router.push(`/app/c/${newId}`);
    } catch {
      // Fork failed (RLS / network) — never dead-end; fall back to the handoff.
      router.push(handoffHref);
    }
  }

  return (
    <button type="button" onClick={onContinue} disabled={busy} className={className}>
      {busy ? "Setting up…" : label}
    </button>
  );
}
