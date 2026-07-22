import { Sparkles, Zap, Crown, type LucideIcon } from "lucide-react";
import type { Tier } from "@/lib/models";

// Single source of truth for plans + pricing. Previously the plan list was
// hand-mirrored across /pricing, /upgrade and /settings (with a comment begging
// future editors to keep them in sync). Everything reads from here now, so a
// price or feature change happens in one place — including the monthly/annual
// split used by the checkout flow.

export type { Tier };
export type Cycle = "monthly" | "annual";

export interface Plan {
  key: Tier;
  name: string;
  /** GBP per month on the monthly plan. */
  monthly: number;
  /** GBP per year on the annual plan (0 for Free). */
  annual: number;
  /** One-line description for plan cards. */
  blurb: string;
  /** Compact one-liner for dense rows (Settings). */
  tagline: string;
  features: string[];
  icon: LucideIcon;
  iconColor: string;
  /** The "most popular" emphasis treatment. */
  highlight?: boolean;
}

export const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, premium: 2 };
export const TIER_LABEL: Record<Tier, string> = { free: "Free", pro: "Pro", premium: "Premium" };

// Annual = 12 months for the price of 10 (two months free), rounded to a clean
// figure: Pro £110/yr (~£9.17/mo), Premium £190/yr (~£15.83/mo). ~17% off.
export const PLANS: Plan[] = [
  {
    key: "free",
    name: "Free",
    monthly: 0,
    annual: 0,
    blurb: "The basics. Try every fast model. No account needed.",
    tagline: "8 basic models, up to 3 per comparison",
    features: [
      "8 basic models",
      "Up to 3 models per comparison",
      "Quality scores & metrics",
      "aggrai's combined answer",
    ],
    icon: Sparkles,
    iconColor: "text-white/55",
  },
  {
    key: "pro",
    name: "Pro",
    monthly: 11,
    annual: 110,
    blurb: "Every flagship model from every major lab.",
    tagline: "17 advanced models, up to 3 per comparison",
    features: [
      "17 advanced models",
      "Up to 3 models per comparison",
      "Sonnet 5, Kimi K3, Opus 4.8 Fast, GPT-4o, GPT-5.5, Gemini Pro, Grok 4.5…",
      "Everything in Free",
    ],
    icon: Zap,
    iconColor: "text-teal-300",
    highlight: true,
  },
  {
    key: "premium",
    name: "Premium",
    monthly: 19,
    annual: 190,
    blurb: "For deep research. Reasoning specialists and 5-model comparisons.",
    tagline: "9 research models, up to 5 per comparison",
    features: [
      "9 research models",
      "Up to 5 models per comparison",
      "Claude Opus 4.8, GPT-5.5 Pro, Qwen3 Max Thinking…",
      "Everything in Pro",
    ],
    icon: Crown,
    iconColor: "text-amber-300",
  },
];

export function planByKey(key: Tier): Plan {
  return PLANS.find((p) => p.key === key) ?? PLANS[0];
}

export function isCycle(v: unknown): v is Cycle {
  return v === "monthly" || v === "annual";
}

export function isTier(v: unknown): v is Tier {
  return v === "free" || v === "pro" || v === "premium";
}

/** Format a GBP amount: whole pounds plain (£11), fractional with 2dp (£9.17). */
export function gbp(n: number): string {
  return "£" + (Number.isInteger(n) ? String(n) : n.toFixed(2));
}

export interface PriceView {
  cycle: Cycle;
  isFree: boolean;
  /** Amount charged this billing period. */
  amount: number;
  amountLabel: string;
  /** "/mo" or "/yr" — the unit the headline amount is in. */
  unit: string;
  /** Effective per-month cost (annual ÷ 12). */
  perMonth: number;
  perMonthLabel: string;
  /** "billed monthly" / "billed annually". */
  billed: string;
  /** £ saved per year vs paying monthly (annual only, else 0). */
  saveAmount: number;
  saveAmountLabel: string;
  /** e.g. "Save 17%" (annual only, else ""). */
  savePctLabel: string;
}

export function priceFor(plan: Plan, cycle: Cycle): PriceView {
  const isFree = plan.monthly === 0 && plan.annual === 0;
  if (cycle === "annual") {
    const perMonth = plan.annual / 12;
    const saveAmount = plan.monthly * 12 - plan.annual;
    const savePct = plan.monthly > 0 ? Math.round((saveAmount / (plan.monthly * 12)) * 100) : 0;
    return {
      cycle,
      isFree,
      amount: plan.annual,
      amountLabel: gbp(plan.annual),
      unit: "/yr",
      perMonth,
      perMonthLabel: gbp(Math.round(perMonth * 100) / 100),
      billed: isFree ? "free forever" : "billed annually",
      saveAmount,
      saveAmountLabel: gbp(saveAmount),
      savePctLabel: savePct > 0 ? `Save ${savePct}%` : "",
    };
  }
  return {
    cycle,
    isFree,
    amount: plan.monthly,
    amountLabel: gbp(plan.monthly),
    unit: "/mo",
    perMonth: plan.monthly,
    perMonthLabel: gbp(plan.monthly),
    billed: isFree ? "free forever" : "billed monthly",
    saveAmount: 0,
    saveAmountLabel: gbp(0),
    savePctLabel: "",
  };
}

/** Renewal date for a mock subscription started at `startedAt` (ms epoch). */
export function renewalDate(startedAt: number, cycle: Cycle): Date {
  const d = new Date(startedAt);
  if (cycle === "annual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
