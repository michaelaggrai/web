"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Lock, ShieldCheck, CreditCard } from "lucide-react";
import { HomeLink } from "@/components/home-link";
import { useTier } from "@/lib/use-tier";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { startDemoBilling } from "@/lib/billing-demo";
import {
  planByKey, priceFor, isTier, isCycle, TIER_RANK, type Cycle, type Tier,
} from "@/lib/plans";

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547]" />}>
      <Checkout />
    </Suspense>
  );
}

function Checkout() {
  const router = useRouter();
  const params = useSearchParams();
  const { tier: currentTier, resolved } = useTier();

  const planKeyParam = params.get("plan");
  const cycleParam = params.get("cycle");
  const planKey: Tier = isTier(planKeyParam) && planKeyParam !== "free" ? planKeyParam : "pro";
  const plan = planByKey(planKey);

  const [cycle, setCycle] = useState<Cycle>(isCycle(cycleParam) ? cycleParam : "monthly");
  // Seed from the stable module constant so we never setState synchronously in
  // the effect: with no Supabase wired (local/dev) the page is already "checked"
  // and shows a placeholder email.
  const [email, setEmail] = useState<string | null>(isSupabaseConfigured ? null : "you@example.com");
  const [authChecked, setAuthChecked] = useState(!isSupabaseConfigured);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const selfHref = `/checkout?plan=${planKey}&cycle=${cycle}`;

  // Auth gate: must be signed in to reach a paid checkout. setState only ever
  // runs inside the async resolver, never synchronously in the effect body.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace(`/signin?reason=upgrade&next=${encodeURIComponent(selfHref)}`);
        return;
      }
      setEmail(data.user.email ?? null);
      setAuthChecked(true);
    });
    // selfHref intentionally omitted — we only want the initial auth check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the viewer already holds this plan (or higher), there's nothing to buy —
  // send them to manage it instead. Only act once the tier has resolved.
  useEffect(() => {
    if (resolved && TIER_RANK[currentTier] >= TIER_RANK[planKey]) {
      router.replace("/settings");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, currentTier, planKey]);

  const price = priceFor(plan, cycle);
  const Icon = plan.icon;

  async function pay() {
    if (processing) return;
    setProcessing(true);
    setError("");
    try {
      // ── Stripe integration goes here later. ──────────────────────────────
      // For now this is a visual demo: pause briefly to show the processing
      // state, then flip the real tier via the existing endpoint and record
      // the chosen billing cycle locally so Settings can show a coherent
      // subscription. No card data is collected or transmitted.
      await new Promise((r) => setTimeout(r, 1100));
      const res = await fetch("/api/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: planKey }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error ?? "Payment could not be completed");
      }
      startDemoBilling(planKey, cycle);
      router.push(`/checkout/success?plan=${planKey}&cycle=${cycle}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setProcessing(false);
    }
  }

  if (!authChecked) {
    return <div className="min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547]" />;
  }

  const accent = planKey === "premium" ? "amber" : "teal";
  const payBtn =
    accent === "amber"
      ? "bg-gradient-to-r from-amber-400 to-amber-300 text-navy hover:from-amber-300 hover:to-amber-200 shadow-lg shadow-amber-500/20"
      : "bg-gradient-to-r from-teal-500 to-teal-400 text-white hover:from-teal-400 hover:to-teal-400 shadow-lg shadow-teal-500/20";

  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547] px-4 py-10 overflow-hidden">
      <div className="pointer-events-none absolute top-24 left-1/4 w-[480px] h-[480px] bg-teal-500/10 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[110px]" />

      <div className="relative z-10 mx-auto max-w-5xl">
        {/* Top bar */}
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link href="/upgrade" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to plans
          </Link>
          <HomeLink height={24} gradientId="checkout-logo" className="opacity-70 hover:opacity-100 transition-opacity" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight mb-1">Checkout</h1>
        <p className="text-sm text-white/45 mb-8">You&apos;re upgrading to <span className="text-white/80 font-medium">{plan.name}</span>. Cancel anytime.</p>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-6 items-start">
          {/* ── Order summary ───────────────────────────────────────────── */}
          <section aria-label="Order summary" className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center gap-2 mb-5">
              <Icon className={`w-5 h-5 ${plan.iconColor}`} aria-hidden="true" />
              <span className="font-semibold text-white">aggrai {plan.name}</span>
            </div>

            {/* Billing-cycle toggle */}
            <div role="radiogroup" aria-label="Billing cycle" className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
              {(["monthly", "annual"] as Cycle[]).map((c) => {
                const on = cycle === c;
                const pv = priceFor(plan, c);
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setCycle(c)}
                    className={`relative rounded-lg px-3 py-2 text-sm font-medium transition ${
                      on ? "bg-white/10 text-white shadow-sm" : "text-white/55 hover:text-white/80"
                    }`}
                  >
                    {c === "monthly" ? "Monthly" : "Annual"}
                    {c === "annual" && pv.savePctLabel && (
                      <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${on ? "bg-teal-400/20 text-teal-200" : "bg-teal-400/10 text-teal-300/80"}`}>
                        {pv.savePctLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Price headline */}
            <div className="flex items-end justify-between gap-3 mb-1">
              <div>
                <span className="text-4xl font-bold text-white">{price.amountLabel}</span>
                <span className="text-white/40 text-sm ml-1">{price.unit}</span>
              </div>
              {cycle === "annual" && (
                <span className="text-xs text-teal-300/90 mb-1.5">{price.perMonthLabel}/mo effective</span>
              )}
            </div>
            <p className="text-xs text-white/40 mb-5 capitalize">{price.billed}</p>

            <ul className="space-y-2 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                  <Check className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>

            {/* Totals */}
            <div className="border-t border-white/10 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-white/55">
                <span>{plan.name} · {cycle === "annual" ? "1 year" : "1 month"}</span>
                <span className="tabular-nums">{price.amountLabel}</span>
              </div>
              {cycle === "annual" && price.saveAmount > 0 && (
                <div className="flex justify-between text-teal-300/90">
                  <span>Annual saving</span>
                  <span className="tabular-nums">−{price.saveAmountLabel}/yr</span>
                </div>
              )}
              <div className="flex justify-between text-white/40">
                <span>Tax</span>
                <span>Calculated at payment</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-white/10 text-white font-semibold">
                <span>Total due today</span>
                <span className="tabular-nums">{price.amountLabel}</span>
              </div>
            </div>
          </section>

          {/* ── Payment panel (mock Stripe Payment Element) ─────────────── */}
          <section aria-label="Payment details" className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-white/60" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-white">Payment details</h2>
            </div>

            {/* Honest demo banner */}
            <div className="mb-5 rounded-xl border border-amber-400/25 bg-amber-400/[0.08] px-3.5 py-2.5 text-xs text-amber-100/90 leading-relaxed">
              <strong className="text-amber-200">Demo checkout.</strong> Payments aren&apos;t live yet — no card is charged and nothing is stored. This is where Stripe&apos;s secure payment form will appear.
            </div>

            <div className="space-y-3.5">
              <Field label="Email">
                <input
                  type="email"
                  value={email ?? ""}
                  readOnly
                  className="w-full rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2.5 text-sm text-white/85 outline-none"
                />
              </Field>

              <Field label="Card information">
                <div className="rounded-lg border border-white/12 bg-white/[0.04] divide-y divide-white/10">
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <input
                      readOnly
                      value="4242 4242 4242 4242"
                      aria-label="Card number"
                      className="flex-1 bg-transparent text-sm text-white/45 outline-none tracking-wider"
                    />
                    <div className="flex gap-1 shrink-0" aria-hidden="true">
                      <span className="h-4 w-6 rounded bg-white/15" />
                      <span className="h-4 w-6 rounded bg-white/10" />
                    </div>
                  </div>
                  <div className="flex">
                    <input readOnly value="12 / 29" aria-label="Expiry" className="w-1/2 bg-transparent px-3 py-2.5 text-sm text-white/45 outline-none" />
                    <input readOnly value="•••" aria-label="CVC" className="w-1/2 border-l border-white/10 bg-transparent px-3 py-2.5 text-sm text-white/45 outline-none" />
                  </div>
                </div>
              </Field>

              <Field label="Name on card">
                <input readOnly value="" placeholder="As shown on card" className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2.5 text-sm text-white/45 placeholder:text-white/30 outline-none" />
              </Field>

              <Field label="Country">
                <div className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2.5 text-sm text-white/45">United Kingdom</div>
              </Field>
            </div>

            {error && (
              <div role="alert" className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={pay}
              disabled={processing}
              className={`mt-5 w-full rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${payBtn}`}
            >
              {processing ? "Processing…" : `Pay ${price.amountLabel}${price.isFree ? "" : cycle === "annual" ? " / year" : " / month"}`}
            </button>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-white/35">
              <Lock className="w-3 h-3" aria-hidden="true" />
              <span>Secured by</span>
              <span className="font-semibold text-white/55">Stripe</span>
              <span className="text-white/20">·</span>
              <ShieldCheck className="w-3 h-3" aria-hidden="true" />
              <span>Cancel anytime</span>
            </div>
          </section>
        </div>

        <p className="mt-8 text-center text-xs text-white/30">
          By subscribing you agree to our{" "}
          <Link href="/terms" className="text-white/50 hover:text-white underline underline-offset-2">Terms</Link>{" "}and{" "}
          <Link href="/privacy" className="text-white/50 hover:text-white underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-white/55">{label}</span>
      {children}
    </label>
  );
}
