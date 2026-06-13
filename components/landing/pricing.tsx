import Link from "next/link"
import { Check, Sparkles, Zap, Crown } from "lucide-react"
import { cn } from "@/lib/utils"
import { PlanCta } from "@/components/pricing-cta"
import type { Tier } from "@/lib/models"

// Content mirrors /pricing/page.tsx (the source of truth). When that page
// changes, update here too.
interface PricingTier {
  name: string
  tier: Tier
  price: string
  period: string
  description: string
  features: string[]
  highlighted?: boolean
  buttonText: string
  buttonHref: string
  Icon: typeof Sparkles
  iconColor: string
}

const tiers: PricingTier[] = [
  {
    name: "Free",
    tier: "free",
    price: "£0",
    period: "forever",
    description: "Get started instantly, no account needed.",
    Icon: Sparkles,
    iconColor: "text-white/40",
    features: [
      "8 basic models",
      "Up to 3 models per comparison",
      "Quality scores & metrics",
      "Aggrai's combined answer",
    ],
    buttonText: "Start free",
    buttonHref: "/app",
  },
  {
    name: "Pro",
    tier: "pro",
    price: "£11",
    period: "per month",
    description: "Every flagship model from every major lab.",
    Icon: Zap,
    iconColor: "text-teal-300",
    features: [
      "16 advanced models",
      "Up to 3 models per comparison",
      "Opus 4.8 Fast, Sonnet 4.6, GPT-4o, GPT-5.5, Gemini Pro, Grok…",
      "Everything in Free",
    ],
    highlighted: true,
    buttonText: "Get Pro",
    buttonHref: "/signin?mode=signup&reason=upgrade&plan=pro&next=/app",
  },
  {
    name: "Premium",
    tier: "premium",
    price: "£19",
    period: "per month",
    description: "For deep research. Reasoning specialists and 5-model comparisons.",
    Icon: Crown,
    iconColor: "text-amber-300",
    features: [
      "9 research models",
      "Up to 5 models per comparison",
      "Claude Opus 4.8, GPT-5.5 Pro, Qwen3 Max Thinking…",
      "Everything in Pro",
    ],
    buttonText: "Get Premium",
    buttonHref: "/signin?mode=signup&reason=upgrade&plan=premium&next=/app",
  },
]

export function Pricing() {
  return (
    <section
      id="pricing"
      className="relative py-24 sm:py-28 bg-gradient-to-b from-navy via-navy to-[#252547] scroll-mt-20 overflow-hidden"
    >
      {/* Soft accent orbs — same vocabulary as Hero + Features */}
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/12 rounded-full blur-[140px]" />
      <div className="pointer-events-none absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/8 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
            Simple, honest pricing
          </h2>
          <p className="mt-3 text-white/50">
            Free forever for casual use. Upgrade when you want flagship models or more
            models per comparison.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {tiers.map(tier => {
            const Icon = tier.Icon
            return (
              <div
                key={tier.name}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-6 transition-all",
                  tier.highlighted
                    ? "border-teal-400/40 bg-teal-400/[0.06] shadow-lg shadow-teal-500/10"
                    : "border-white/10 bg-white/[0.04]"
                )}
              >
                {tier.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-teal-400/20 border border-teal-400/30 px-3 py-0.5 text-[11px] font-semibold text-teal-300 uppercase tracking-wider">
                    Most popular
                  </span>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <Icon className={cn("w-5 h-5", tier.iconColor)} />
                  <span className="font-semibold text-white">{tier.name}</span>
                </div>

                <div className="mb-1">
                  <span className="text-3xl font-bold text-white">{tier.price}</span>
                  <span className="text-white/40 text-sm ml-1">{tier.period}</span>
                </div>

                <p className="text-sm text-white/40 mb-6">{tier.description}</p>

                <ul className="space-y-2 mb-8 flex-1">
                  {tier.features.map(feature => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-white/70">
                      <Check className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <PlanCta
                  planTier={tier.tier}
                  name={tier.name}
                  anonHref={tier.buttonHref}
                  anonLabel={tier.buttonText}
                  highlight={!!tier.highlighted}
                />
              </div>
            )
          })}
        </div>

        <p className="text-center text-sm text-white/40 mt-10">
          No credit card required. Cancel anytime.{" "}
          <Link href="/models" className="text-teal-300 hover:text-teal-200 underline-offset-2 hover:underline">
            See the full model catalog →
          </Link>
        </p>
      </div>
    </section>
  )
}
