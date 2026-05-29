import Link from "next/link";
import { Check, Sparkles, Zap, Crown } from "lucide-react";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { PlanCta } from "@/components/pricing-cta";
import type { Tier } from "@/lib/models";

export const metadata = {
  title: "Pricing — aggrai",
  description: "Free, Pro, and Premium plans for aggrai.",
};

const PLANS = [
  {
    name: "Free",
    tier: "free" as Tier,
    price: "£0",
    period: "forever",
    icon: Sparkles,
    iconColor: "text-white/40",
    description: "The basics. Try every fast model. No account needed.",
    features: [
      "8 basic models",
      "Up to 3 models per comparison",
      "Quality scores & metrics",
      "Aggrai's combined answer",
    ],
    cta: { href: "/app", label: "Start free" },
    highlight: false,
  },
  {
    name: "Pro",
    tier: "pro" as Tier,
    price: "£11",
    period: "per month",
    icon: Zap,
    iconColor: "text-teal-300",
    description: "Every flagship model from every major lab.",
    features: [
      "16 advanced models",
      "Up to 3 models per comparison",
      "Opus 4.8, Sonnet 4.6, GPT-4o, GPT-5.5, Gemini Pro, Grok 4.20…",
      "Everything in Free",
    ],
    cta: { href: "/signin?mode=signup&reason=upgrade&plan=pro&next=/app", label: "Get Pro" },
    highlight: true,
  },
  {
    name: "Premium",
    tier: "premium" as Tier,
    price: "£19",
    period: "per month",
    icon: Crown,
    iconColor: "text-amber-300",
    description: "For deep research. Reasoning specialists and 5-model comparisons.",
    features: [
      "4 research models",
      "Up to 5 models per comparison",
      "GPT-5.5 Pro, Qwen3 Max Thinking, Grok Multi-Agent…",
      "Everything in Pro",
    ],
    cta: { href: "/signin?mode=signup&reason=upgrade&plan=premium&next=/app", label: "Get Premium" },
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547] px-4 pt-24 overflow-hidden">
      <Navbar />
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/15 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-4xl">
        {/* Centered hero */}
        <div className="flex flex-col items-center text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
            Simple, honest pricing
          </h1>
          <p className="mt-3 text-white/50 max-w-md">
            Free forever for casual use. Upgrade when you want flagship models or
            more models per comparison.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {PLANS.map(plan => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
                  plan.highlight
                    ? "border-teal-400/40 bg-teal-400/[0.06] shadow-lg shadow-teal-500/10"
                    : "border-white/10 bg-white/[0.04]"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-teal-400/20 border border-teal-400/30 px-3 py-0.5 text-[11px] font-semibold text-teal-300 uppercase tracking-wider">
                    Most popular
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

                <PlanCta
                  planTier={plan.tier}
                  name={plan.name}
                  anonHref={plan.cta.href}
                  anonLabel={plan.cta.label}
                  highlight={plan.highlight}
                />
              </div>
            );
          })}
        </div>

        {/* Bridge to the full catalog so users curious about "which models exactly?" don't bounce */}
        <div className="mt-8 text-center">
          <Link
            href="/models"
            className="inline-flex items-center gap-1.5 text-sm text-teal-300 hover:text-teal-200 underline-offset-2 hover:underline"
          >
            See the full model catalog →
          </Link>
        </div>

        {/* FAQ-lite */}
        <div className="mt-16 grid sm:grid-cols-2 gap-6 text-sm">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <p className="font-medium text-white mb-1.5">Can I change plans?</p>
            <p className="text-white/50 leading-relaxed">
              Yes, any time. Changes take effect immediately; cancellations end
              at the current billing period.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <p className="font-medium text-white mb-1.5">Do I need an account for Free?</p>
            <p className="text-white/50 leading-relaxed">
              No. Anyone can use Free without signing up. Accounts are only
              needed to upgrade.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <p className="font-medium text-white mb-1.5">What about refunds?</p>
            <p className="text-white/50 leading-relaxed">
              Cancel any time, no charges for future periods. We don&apos;t refund
              partial months — see the <Link href="/terms" className="text-teal-300 hover:underline">Terms</Link>.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <p className="font-medium text-white mb-1.5">Where do model costs go?</p>
            <p className="text-white/50 leading-relaxed">
              We pay the underlying providers (OpenAI, Anthropic, Google, etc.)
              for every request. Your plan covers that and the rest of running
              the service.
            </p>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-white/30">
          Questions? <Link href="/contact" className="text-white/50 hover:text-white underline underline-offset-2">Contact</Link> · <Link href="/terms" className="text-white/40 hover:text-white">Terms</Link> · <Link href="/privacy" className="text-white/40 hover:text-white">Privacy</Link>
        </p>
      </div>
      <div className="relative z-10 -mx-4 mt-16"><Footer /></div>
    </div>
  );
}
