import Link from "next/link";
import { Check, Sparkles, Zap, Crown } from "lucide-react";
import { HomeLink } from "@/components/home-link";
import { AccountMenu } from "@/components/account-menu";

export const metadata = {
  title: "Pricing — aggrai",
  description: "Free, Pro, and Premium plans for aggrai.",
};

const PLANS = [
  {
    name: "Free",
    price: "£0",
    period: "forever",
    icon: Sparkles,
    iconColor: "text-white/40",
    description: "Get started instantly, no account needed.",
    features: [
      "6 basic AI models",
      "Up to 3 models per comparison",
      "Quality scores & metrics",
      "Aggrai's combined answer",
    ],
    cta: { href: "/app", label: "Start free" },
    highlight: false,
  },
  {
    name: "Pro",
    price: "£9",
    period: "per month",
    icon: Zap,
    iconColor: "text-teal-300",
    description: "Flagship models — GPT-4o, Sonnet 4.6, Gemini Pro and more.",
    features: [
      "Everything in Free, plus…",
      "15 flagship models: GPT-4o, Claude Sonnet 4.6, Gemini 2.5/3.x Pro, Codex, Devstral, Qwen3 Coder…",
      "Creative, coding & multimodal categories unlocked",
      "Up to 3 models per comparison",
    ],
    cta: { href: "/signin?mode=signup&reason=upgrade&plan=pro&next=/app", label: "Get Pro" },
    highlight: true,
  },
  {
    name: "Premium",
    price: "£19",
    period: "per month",
    icon: Crown,
    iconColor: "text-amber-300",
    description: "Adds reasoning + frontier models, and 5-model comparisons.",
    features: [
      "Everything in Pro, plus…",
      "9 reasoning + frontier models: Claude Opus 4.7, GPT-5.4/5.5 Pro, Grok 4.20 (incl. multi-agent), DeepSeek v4 Pro, Qwen3 Max Thinking, Llama 3.3 70B",
      "Up to 5 models per comparison",
      "Priority for new model launches",
    ],
    cta: { href: "/signin?mode=signup&reason=upgrade&plan=premium&next=/app", label: "Get Premium" },
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547] px-4 py-16 overflow-hidden">
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/15 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-4xl">
        {/* Top bar — logo + account menu, then the centered hero below */}
        <div className="mb-12 flex items-center justify-between gap-3">
          <HomeLink height={28} gradientId="pricing-logo" className="opacity-80 hover:opacity-100 transition-opacity" />
          <AccountMenu variant="topbar" />
        </div>

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

                <Link
                  href={plan.cta.href}
                  className={`w-full text-center rounded-xl py-2.5 text-sm font-medium transition-all ${
                    plan.highlight
                      ? "bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-400 text-white shadow-lg shadow-teal-500/20"
                      : "border border-white/20 bg-white/5 hover:bg-white/10 text-white"
                  }`}
                >
                  {plan.cta.label}
                </Link>
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
          Questions? <a href="mailto:hello@aggrai.com" className="text-white/50 hover:text-white underline underline-offset-2">hello@aggrai.com</a> · <Link href="/terms" className="text-white/40 hover:text-white">Terms</Link> · <Link href="/privacy" className="text-white/40 hover:text-white">Privacy</Link>
        </p>
      </div>
    </div>
  );
}
