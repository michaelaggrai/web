// Client-side Stripe loader. Safe to import from client components — it only
// reads the PUBLISHABLE key (NEXT_PUBLIC_*), never the secret. Loaded once and
// memoised so Stripe.js isn't re-fetched on every checkout mount. Resolves to
// null if the key is unset (billing not configured) so callers can degrade.
import { loadStripe, type Stripe } from "@stripe/stripe-js";

let _promise: Promise<Stripe | null> | null = null;

export function getStripeClient(): Promise<Stripe | null> {
  if (!_promise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    _promise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return _promise;
}
