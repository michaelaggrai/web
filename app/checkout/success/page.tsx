"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, Sparkles, ArrowRight, Settings as SettingsIcon } from "lucide-react";
import { HomeLink } from "@/components/home-link";
import { getDemoBilling } from "@/lib/billing-demo";
import {
  planByKey, priceFor, isTier, isCycle, renewalDate, formatDate,
  type Cycle, type Tier,
} from "@/lib/plans";

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547]" />}>
      <Success />
    </Suspense>
  );
}

function Success() {
  const params = useSearchParams();
  const planKey: Tier = isTier(params.get("plan")) ? (params.get("plan") as Tier) : "pro";
  const cycleParam = params.get("cycle");
  const plan = planByKey(planKey);
  const Icon = plan.icon;

  // Cycle comes from the URL (SSR-safe). The renewal date is client-only
  // (Date math + localStorage), so it's computed off the render path — inside a
  // resolved promise so setState never runs synchronously in the effect body
  // (avoids a hydration mismatch and the set-state-in-effect rule).
  const cycle: Cycle = isCycle(cycleParam) ? cycleParam : "monthly";
  const [renews, setRenews] = useState<string>("");

  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => {
      if (!alive) return;
      const demo = getDemoBilling();
      const startedAt = demo?.startedAt ?? Date.now();
      setRenews(formatDate(renewalDate(startedAt, demo?.cycle ?? cycle)));
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const price = priceFor(plan, cycle);

  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center bg-gradient-to-b from-navy via-navy to-[#252547] px-4 py-16 overflow-hidden">
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[520px] h-[520px] bg-teal-500/15 rounded-full blur-[130px]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <HomeLink height={26} gradientId="success-logo" className="opacity-70 hover:opacity-100 transition-opacity" />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
          {/* Success mark */}
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-teal-400/15 ring-1 ring-teal-400/30">
            <Check className="h-7 w-7 text-teal-300" aria-hidden="true" />
          </div>

          <h1 className="text-2xl font-semibold text-white tracking-tight">You&apos;re on {plan.name} 🎉</h1>
          <p className="mt-2 text-sm text-white/50 leading-relaxed">
            Payment confirmed. Your upgrade is active right away and a receipt is on its way to your inbox.
          </p>

          {/* Receipt summary */}
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm">
            <Line label="Plan">
              <span className="inline-flex items-center gap-1.5">
                <Icon className={`w-4 h-4 ${plan.iconColor}`} aria-hidden="true" />
                <span className="text-white/90 font-medium">aggrai {plan.name}</span>
              </span>
            </Line>
            <Line label="Billing">
              <span className="text-white/80 capitalize">{cycle}</span>
            </Line>
            <Line label="Amount">
              <span className="text-white/80 tabular-nums">{price.amountLabel}{price.unit}</span>
            </Line>
            <Line label="Renews">
              <span className="text-white/80">{renews || "—"}</span>
            </Line>
          </div>

          {/* Unlocked highlight */}
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-teal-400/20 bg-teal-400/[0.06] px-3.5 py-2.5 text-left">
            <Sparkles className="w-4 h-4 text-teal-300 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-xs text-teal-100/90 leading-relaxed">{plan.tagline} — unlocked.</p>
          </div>

          {/* CTAs. The app link is a real anchor (full navigation) so useTier
              and the model picker pick up the new tier on a fresh load. */}
          <a
            href="/app?upgraded=1"
            className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-500/20 transition hover:from-teal-400 hover:to-teal-400"
          >
            Start comparing
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
          <Link
            href="/settings"
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] py-2.5 text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white"
          >
            <SettingsIcon className="w-4 h-4" aria-hidden="true" />
            Manage subscription
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-white/30">
          Need help? <Link href="/contact" className="text-white/50 hover:text-white underline underline-offset-2">Contact us</Link>
        </p>
      </div>
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs uppercase tracking-wider text-white/40">{label}</span>
      {children}
    </div>
  );
}
