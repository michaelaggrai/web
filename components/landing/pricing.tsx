import { Button } from "@/components/ui/button"
import { Check, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface PricingTier {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  highlighted?: boolean
  buttonText: string
}

const tiers: PricingTier[] = [
  {
    name: "Free",
    price: "£0",
    period: "/month",
    description: "Perfect for getting started",
    features: [
      "10 queries per day",
      "3 basic models per query",
      "Starter model catalog",
      "Basic comparison view",
    ],
    buttonText: "Start free"
  },
  {
    name: "Pro",
    price: "£9",
    period: "/month",
    description: "For everyday productivity",
    features: [
      "Unlimited queries",
      "Any 3 models per query",
      "Full model catalog",
      "Advanced analytics",
      "Query history",
    ],
    highlighted: true,
    buttonText: "Get Pro"
  },
  {
    name: "Premium",
    price: "£19",
    period: "/month",
    description: "For teams and power users",
    features: [
      "Any 5 models per query",
      "API access",
      "Team collaboration",
      "Priority support",
      "Custom integrations"
    ],
    buttonText: "Get Premium"
  }
]

export function Pricing() {
  return (
    <section className="py-24 bg-muted/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-semibold text-foreground">
            Simple, transparent pricing
          </h2>
          <p className="mt-3 text-muted-foreground">
            Start free. Upgrade when you need more.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "relative rounded-3xl p-6 transition-all",
                tier.highlighted
                  ? "bg-gradient-to-b from-teal-500/10 to-teal-500/5 border-2 border-teal-500/20 shadow-xl shadow-teal-500/5"
                  : "bg-card border border-border hover:border-border/80"
              )}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-teal-500 to-teal-400 text-white text-xs font-medium shadow-lg">
                    <Sparkles className="w-3 h-3" />
                    Popular
                  </div>
                </div>
              )}

              <div className="pt-2">
                <h3 className="text-lg font-semibold text-foreground">{tier.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{tier.description}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold text-foreground">{tier.price}</span>
                  <span className="text-muted-foreground text-sm">{tier.period}</span>
                </div>
              </div>

              <Button
                className={cn(
                  "w-full mt-6 rounded-xl font-medium h-11",
                  tier.highlighted
                    ? "bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-400 text-white shadow-lg shadow-teal-500/25"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {tier.buttonText}
              </Button>

              <ul className="mt-6 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5">
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                      tier.highlighted ? "bg-teal-500/10" : "bg-muted"
                    )}>
                      <Check className={cn(
                        "w-3 h-3",
                        tier.highlighted ? "text-teal-500" : "text-muted-foreground"
                      )} />
                    </div>
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-10">
          No credit card required. Cancel anytime.
        </p>
      </div>
    </section>
  )
}
