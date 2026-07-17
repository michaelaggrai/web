"use client";

// The real Stripe Payment Element checkout (Phase 8, gated on BILLING_LIVE).
// Flow: create an incomplete subscription on the server (→ clientSecret), render
// the Payment Element against it, and confirm the first payment in the browser.
// The webhook flips entitlement once payment actually succeeds — this component
// never grants a tier. Recreates the subscription when the billing cycle changes
// so the clientSecret always matches the price being shown (abandoned incomplete
// subscriptions expire on their own).
import { useEffect, useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { Lock, ShieldCheck, Loader2 } from "lucide-react";
import { getStripeClient } from "@/lib/stripe/client";
import type { Cycle, Tier } from "@/lib/plans";

const stripePromise = getStripeClient();

// Match the dark navy UI. Stripe's "night" base + our teal accent.
const appearance: StripeElementsOptions["appearance"] = {
  theme: "night",
  variables: {
    colorPrimary: "#2dd4bf",
    colorBackground: "#131327",
    colorText: "#e7e7f0",
    colorDanger: "#f87171",
    borderRadius: "10px",
    fontSizeBase: "14px",
  },
};

type Props = {
  planKey: Exclude<Tier, "free">;
  cycle: Cycle;
  email: string | null;
  payLabel: string;
  accent: "teal" | "amber";
};

export function StripePayment({ planKey, cycle, email, payLabel, accent }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Create the incomplete subscription on mount → clientSecret. The parent keys
  // this component by `${planKey}-${cycle}`, so a cycle change REMOUNTS it with
  // fresh state (no synchronous reset needed) and this effect refetches. The
  // `ignore` flag drops a stale response if the component unmounts mid-flight.
  useEffect(() => {
    let ignore = false;
    fetch("/api/billing/create-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: planKey, cycle }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.error ?? "Could not start checkout");
        return d as { clientSecret?: string };
      })
      .then((d) => {
        if (ignore) return;
        if (d.clientSecret) setClientSecret(d.clientSecret);
        else setError("Payment could not be initialised. Please try again.");
      })
      .catch((e) => { if (!ignore) setError(e instanceof Error ? e.message : "Could not start checkout"); });
    return () => { ignore = true; };
  }, [planKey, cycle]);

  if (error && !clientSecret) {
    return (
      <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {error}
      </div>
    );
  }
  if (!clientSecret) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/50">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        Preparing secure payment…
      </div>
    );
  }

  // Key on clientSecret so <Elements> remounts cleanly when the cycle changes.
  return (
    <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret, appearance }}>
      <PayForm planKey={planKey} cycle={cycle} email={email} payLabel={payLabel} accent={accent} />
    </Elements>
  );
}

function PayForm({ planKey, cycle, email, payLabel, accent }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const payBtn =
    accent === "amber"
      ? "bg-gradient-to-r from-amber-400 to-amber-300 text-navy hover:from-amber-300 hover:to-amber-200 shadow-lg shadow-amber-500/20"
      : "bg-gradient-to-r from-teal-500 to-teal-400 text-white hover:from-teal-400 hover:to-teal-400 shadow-lg shadow-teal-500/20";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || processing) return;
    setProcessing(true);
    setError("");
    // On success Stripe redirects to return_url; the webhook grants the tier.
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success?plan=${planKey}&cycle=${cycle}`,
      },
    });
    // We only get here if confirmation failed (validation / card decline) —
    // a success navigates away before this resolves.
    setError(err?.message ?? "Payment could not be completed. Please try again.");
    setProcessing(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <PaymentElement options={{ defaultValues: { billingDetails: { email: email ?? undefined } } }} />

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className={`w-full rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${payBtn}`}
      >
        {processing ? "Processing…" : payLabel}
      </button>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/35">
        <Lock className="w-3 h-3" aria-hidden="true" />
        <span>Secured by</span>
        <span className="font-semibold text-white/55">Stripe</span>
        <span className="text-white/20">·</span>
        <ShieldCheck className="w-3 h-3" aria-hidden="true" />
        <span>Cancel anytime</span>
      </div>
    </form>
  );
}
