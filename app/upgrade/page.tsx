"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { HomeLink } from "@/components/home-link";
import { AccountMenu } from "@/components/account-menu";
import { useTier } from "@/lib/use-tier";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { PLANS, priceFor, TIER_RANK, type Cycle, type Tier } from "@/lib/plans";

export default function UpgradePage() {
  const { tier: currentTier } = useTier();
  const router = useRouter();
  const [cycle, setCycle] = useState<Cycle>("monthly");
  // Seed from the stable module constant so setState only runs in the async
  // resolver, never synchronously in the effect body.
  const [signedIn, setSignedIn] = useState<boolean | null>(isSupabaseConfigured ? null : false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    createClient().auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  // Upgrades now go through the checkout flow instead of flipping the tier
  // instantly. Anonymous visitors sign in first, then land back on checkout.
  function choose(tier: Tier) {
    const dest = `/checkout?plan=${tier}&cycle=${cycle}`;
    if (signedIn) router.push(dest);
    else router.push(`/signin?reason=upgrade&next=${encodeURIComponent(dest)}`);
  }

  return (
    <div className="relative min-h-dvh flex flex-col items-center bg-gradient-to-b from-navy via-navy to-[#252547] px-4 py-16 overflow-hidden">
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/15 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px]" />

      <div className="relative z-10 w-full max-w-4xl">
        <div className="mb-10 flex items-center justify-between gap-3">
          <HomeLink height={28} gradientId="upgrade-logo" className="opacity-80 hover:opacity-100 transition-opacity" />
          <AccountMenu variant="topbar" />
        </div>

        <div className="mb-8 flex flex-col items-center text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">Choose your plan</h1>
          <p className="mt-3 text-white/50 max-w-md">Unlock more models and compare AI at full depth.</p>
        </div>

        {/* Billing-cycle toggle */}
        <div className="mb-9 flex flex-col items-center gap-2">
          <div role="radiogroup" aria-label="Billing cycle" className="inline-grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
            {(["monthly", "annual"] as Cycle[]).map((c) => {
              const on = cycle === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setCycle(c)}
                  className={`rounded-lg px-5 py-1.5 text-sm font-medium transition ${
                    on ? "bg-white/10 text-white shadow-sm" : "text-white/55 hover:text-white/80"
                  }`}
                >
                  {c === "monthly" ? "Monthly" : "Annual"}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-teal-300/80 h-4">{cycle === "annual" ? "2 months free — save ~17%" : " "}</p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {PLANS.map((plan) => {
            const isCurrent = currentTier === plan.key;
            const isBelow = TIER_RANK[plan.key] < TIER_RANK[currentTier];
            const Icon = plan.icon;
            const price = priceFor(plan, cycle);

            return (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
                  plan.highlight
                    ? "border-teal-400/40 bg-teal-400/[0.06] shadow-lg shadow-teal-500/10"
                    : "border-white/10 bg-white/[0.04]"
                } ${isCurrent ? "ring-2 ring-teal-400/30" : ""}`}
              >
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-teal-400/20 border border-teal-400/30 px-3 py-0.5 text-[11px] font-semibold text-teal-300 uppercase tracking-wider">
                    Current plan
                  </span>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <Icon className={`w-5 h-5 ${plan.iconColor}`} aria-hidden="true" />
                  <span className="font-semibold text-white">{plan.name}</span>
                </div>

                <div className="mb-1 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-white">{price.amountLabel}</span>
                  <span className="text-white/40 text-sm">{price.isFree ? "forever" : price.unit}</span>
                </div>
                <p className="mb-5 h-4 text-xs text-teal-300/80">
                  {cycle === "annual" && !price.isFree ? `${price.perMonthLabel}/mo · ${price.savePctLabel}` : " "}
                </p>

                <p className="text-sm text-white/40 mb-6">{plan.blurb}</p>

                <ul className="space-y-2 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                      <Check className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 py-2.5 text-center text-sm text-white/40">
                    Your current plan
                  </div>
                ) : isBelow ? (
                  <div className="rounded-xl border border-white/5 py-2.5 text-center text-sm text-white/30">
                    Already covered by your plan
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => choose(plan.key)}
                    className={`w-full rounded-xl py-2.5 text-sm font-medium transition-all ${
                      plan.key === "premium"
                        ? "bg-gradient-to-r from-amber-400 to-amber-300 text-navy hover:from-amber-300 hover:to-amber-200 shadow-lg shadow-amber-500/20"
                        : plan.highlight
                          ? "bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-400 text-white shadow-lg shadow-teal-500/20"
                          : "border border-white/20 bg-white/5 hover:bg-white/10 text-white"
                    }`}
                  >
                    {signedIn === false ? "Sign up to upgrade" : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-white/30">
          Need to downgrade?{" "}
          <Link href="/settings" className="text-white/60 hover:text-white underline underline-offset-2">
            Go to Settings → Plan
          </Link>
          .{" "}
          <Link href="/app" className="text-white/40 hover:text-white/70 underline underline-offset-2">
            Back to app
          </Link>
        </p>
      </div>
    </div>
  );
}
