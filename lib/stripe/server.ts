// Server-only Stripe helpers. NEVER import this from a client component — it
// reads the secret key. Init is lazy so a missing key doesn't break the build
// in shadow mode; it only throws when a billing route is actually invoked
// without a key configured.
import Stripe from "stripe";
import type { Cycle, Tier } from "@/lib/plans";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  _stripe = new Stripe(key);
  return _stripe;
}

export type PaidTier = Exclude<Tier, "free">;

// (tier, cycle) → Stripe price id, sourced from env so flipping test→live is
// just an env swap. Create the four products/prices in Stripe and set:
//   STRIPE_PRICE_PRO_MONTHLY      STRIPE_PRICE_PRO_ANNUAL
//   STRIPE_PRICE_PREMIUM_MONTHLY  STRIPE_PRICE_PREMIUM_ANNUAL
export function priceIdFor(tier: PaidTier, cycle: Cycle): string | undefined {
  const ids: Record<PaidTier, Record<Cycle, string | undefined>> = {
    pro: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
      annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
    },
    premium: {
      monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY,
      annual: process.env.STRIPE_PRICE_PREMIUM_ANNUAL,
    },
  };
  return ids[tier][cycle];
}

// Reverse lookup: Stripe price id → the (tier, cycle) it represents. Fallback
// for webhook events that don't carry our metadata.
export function planForPriceId(priceId: string): { tier: PaidTier; cycle: Cycle } | null {
  const pairs: Array<[PaidTier, Cycle, string | undefined]> = [
    ["pro", "monthly", process.env.STRIPE_PRICE_PRO_MONTHLY],
    ["pro", "annual", process.env.STRIPE_PRICE_PRO_ANNUAL],
    ["premium", "monthly", process.env.STRIPE_PRICE_PREMIUM_MONTHLY],
    ["premium", "annual", process.env.STRIPE_PRICE_PREMIUM_ANNUAL],
  ];
  for (const [tier, cycle, id] of pairs) {
    if (id && id === priceId) return { tier, cycle };
  }
  return null;
}
