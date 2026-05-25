"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Sparkles, Zap, Crown } from "lucide-react";
import { Logo } from "@/components/logo";
import { useTier } from "@/lib/use-tier";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

type Tier = "free" | "pro" | "premium";

const PLANS = [
  {
    key: "free" as Tier,
    name: "Free",
    price: "£0",
    period: "forever",
    icon: Sparkles,
    iconColor: "text-white/40",
    description: "Get started instantly, no account needed.",
    features: [
      "3 basic AI models",
      "Compare side-by-side",
      "Quality scores & metrics",
    ],
    cta: "Current plan",
    highlight: false,
  },
  {
    key: "pro" as Tier,
    name: "Pro",
    price: "£9",
    period: "per month",
    icon: Zap,
    iconColor: "text-teal-300",
    description: "Access flagship models for deeper comparisons.",
    features: [
      "3 models from the full catalog",
      "Flagship models (GPT-4o, Claude Sonnet, Gemini Pro…)",
      "Everything in Free",
    ],
    cta: "Upgrade to Pro",
    highlight: true,
  },
  {
    key: "premium" as Tier,
    name: "Premium",
    price: "£19",
    period: "per month",
    icon: Crown,
    iconColor: "text-amber-300",
    description: "Maximum models for the most thorough comparisons.",
    features: [
      "5 models simultaneously",
      "Full catalog access",
      "Everything in Pro",
    ],
    cta: "Upgrade to Premium",
    highlight: false,
  },
];

export default function UpgradePage() {
  const { tier: currentTier } = useTier();
  const router = useRouter();
  const [loading, setLoading] = useState<Tier | null>(null);
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) { setSignedIn(false); return; }
    createClient().auth.getUser().then(({ data }) => {
      setSignedIn(!!data.user);
    });
  }, []);

  async function upgrade(tier: Tier) {
    if (!signedIn) {
      router.push(`/signin?next=/upgrade&reason=upgrade`);
      return;
    }
    setLoading(tier);
    setError("");
    try {
      const res = await fetch("/api/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Upgrade failed");
      }
      // Hard reload — NOT router.push. The useTier hook (+ AccountMenu,
      // ModelPicker locked-IDs, /app tier validation) all read the user's
      // tier ONCE on mount and never refresh. router.push() preserves the
      // React tree so they stay stale. A full-page navigation is the only
      // way every consumer picks up the new tier reliably. See AGG-32 +
      // AGG-36 for the deeper diagnosis.
      window.location.assign("/app?upgraded=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(null);
    }
  }

  return (
    <div className="relative min-h-dvh flex flex-col items-center bg-gradient-to-b from-navy via-navy to-[#252547] px-4 py-16 overflow-hidden">
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/15 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px]" />

      <div className="relative z-10 w-full max-w-4xl">
        {/* Header */}
        <div className="mb-10 flex flex-col items-center text-center">
          <Link href="/app" className="mb-8 inline-block">
            <Logo height={36} gradientId="upgrade-logo" />
          </Link>
          <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
            Choose your plan
          </h1>
          <p className="mt-3 text-white/50 max-w-md">
            Unlock more models and compare AI at full depth.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300 text-center"
          >
            {error}
          </div>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {PLANS.map(plan => {
            const isCurrent = currentTier === plan.key;
            const isBelow = (
              (plan.key === "free") ||
              (plan.key === "pro" && currentTier === "premium")
            );
            const Icon = plan.icon;

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
                  <Icon className={`w-5 h-5 ${plan.iconColor}`} />
                  <span className="font-semibold text-white">{plan.name}</span>
                </div>

                <div className="mb-1">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-white/40 text-sm ml-1">{plan.period}</span>
                </div>

                <p className="text-sm text-white/40 mb-6">{plan.description}</p>

                <ul className="space-y-2 mb-8 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                      <Check className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" />
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
                    onClick={() => upgrade(plan.key)}
                    disabled={loading !== null}
                    className={`w-full rounded-xl py-2.5 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      plan.highlight
                        ? "bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-400 text-white shadow-lg shadow-teal-500/20"
                        : "border border-white/20 bg-white/5 hover:bg-white/10 text-white"
                    }`}
                  >
                    {loading === plan.key ? "Upgrading…" : signedIn === false ? "Sign up to upgrade" : plan.cta}
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
