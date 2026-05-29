"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useTier } from "@/lib/use-tier";
import type { Tier } from "@/lib/models";

const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, premium: 2 };

const BASE = "w-full text-center rounded-xl py-2.5 text-sm font-medium transition-all";

function upgradeClasses(highlight: boolean) {
  return highlight
    ? "bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-400 text-white shadow-lg shadow-teal-500/20"
    : "border border-white/20 bg-white/5 hover:bg-white/10 text-white";
}

// Premium is the gold tier. An upgrade *to* Premium — the only upgrade a Pro
// user has left — gets gold instead of the generic teal/grey CTA.
const GOLD =
  "bg-gradient-to-r from-amber-400 to-amber-300 text-navy shadow-lg shadow-amber-500/20 hover:from-amber-300 hover:to-amber-200";

/**
 * Tier-aware CTA for a pricing plan card.
 *
 * The /pricing page is otherwise static marketing copy, so on its own it
 * always shows the signed-out CTAs ("Get Pro" etc.) — which is wrong for a
 * logged-in user who already holds (or out-ranks) that plan. This client
 * component resolves the viewer's plan and renders the right action:
 *
 *   - anonymous / still resolving → the marketing CTA (anonHref/anonLabel)
 *   - this IS their current plan   → "Current plan" (inert)
 *   - plan is below their tier     → "Included in your plan" (inert)
 *   - plan is above their tier      → "Upgrade to X" → /settings (where a
 *     logged-in user actually changes plan — NOT the /signin sign-up flow)
 */
export function PlanCta({
  planTier,
  name,
  anonHref,
  anonLabel,
  highlight,
}: {
  planTier: Tier;
  name: string;
  anonHref: string;
  anonLabel: string;
  highlight: boolean;
}) {
  const { tier, resolved, authenticated } = useTier();

  // Until we know they're signed in, show the marketing CTA — that's the
  // common (anonymous) case and matches what SSR rendered, so no flash of a
  // wrong "Current plan" state for visitors.
  if (!resolved || !authenticated) {
    return (
      <Link href={anonHref} className={`${BASE} ${upgradeClasses(highlight)}`}>
        {anonLabel}
      </Link>
    );
  }

  const planRank = TIER_RANK[planTier];
  const userRank = TIER_RANK[tier];

  if (planRank === userRank) {
    return (
      <span
        className={`${BASE} inline-flex items-center justify-center gap-1.5 border border-teal-400/30 bg-teal-400/10 text-teal-200 cursor-default`}
        aria-disabled="true"
      >
        <Check className="w-4 h-4" />
        Current plan
      </span>
    );
  }

  if (planRank < userRank) {
    return (
      <span
        className={`${BASE} border border-white/10 bg-white/[0.03] text-white/40 cursor-default`}
        aria-disabled="true"
      >
        Included in your plan
      </span>
    );
  }

  // Above their current plan → real upgrade. Logged-in users manage their
  // plan on /settings. Premium upgrades go gold.
  return (
    <Link href="/settings" className={`${BASE} ${planTier === "premium" ? GOLD : upgradeClasses(highlight)}`}>
      Upgrade to {name}
    </Link>
  );
}
