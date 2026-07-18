// AGG-44: shareable conversation snapshots.
//
// A snapshot is a FROZEN, PUBLIC, self-contained copy of a conversation —
// internal/sensitive fields (runtime, tokens, cost, user identity) are stripped
// at build time. It's what /share/{id} renders; it never reads the live
// conversation, so turns added after sharing can't leak into an already-public
// link. Versioned (`v`) so the renderer can evolve without breaking old links.

import { FALLBACK_MODELS, type Tier } from "@/lib/models";

export type ShareScores = {
  overall: number;
  accuracy?: number;
  completeness?: number;
  calibration?: number;
  clarity?: number;
  insight?: number;
};

export type ShareAnswer = {
  model: string;
  answer: string;
  scores?: ShareScores | null;
  truncated?: boolean;
};

export type ShareSource = { title: string; url: string };

export type ShareTurn =
  | {
      kind: "compare";
      question: string;
      summary: string;
      contributions?: { model: string; pct: number }[] | null;
      answers: ShareAnswer[];
      sources?: ShareSource[] | null;
    }
  | { kind: "single"; question: string; model: string; answer: string }
  | { kind: "direct"; question: string; answer: string };

export type ShareSnapshot = {
  v: 1;
  createdAt: string;
  /** Root-question models — drives the "continue if same tier" gate + display. */
  models: string[];
  turns: ShareTurn[];
};

/** Stored-size cap — a public unauthenticated write, so bound the jsonb. */
export const SHARE_SNAPSHOT_MAX_BYTES = 400_000;

/** URL-safe short slug — crypto-random, 11 base62 chars (~65 bits). */
export function newShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(11));
  const a = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  for (const b of bytes) out += a[b % 62];
  return out;
}

/** Longer opaque token returned once on create so an anon sharer can unshare. */
export function newRevokeToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const CLASS_TIER: Record<string, Tier> = { basic: "free", flagship: "pro", premium: "premium" };
const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, premium: 2 };

/**
 * Lowest tier that can continue with ALL of `models` — i.e. the highest tier
 * any single model requires. Used for the /share "continue" hint; the actual
 * per-model gate is the app's existing lockedModelIds when the viewer forks it.
 */
export function minTierForModels(models: string[]): Tier {
  let best: Tier = "free";
  for (const id of models) {
    const m = FALLBACK_MODELS.find((x) => x.id === id);
    const t = m ? CLASS_TIER[m.class] ?? "free" : "free";
    if (TIER_RANK[t] > TIER_RANK[best]) best = t;
  }
  return best;
}
