import Link from "next/link"
import { PlanCta } from "@/components/pricing-cta"
import { PlanCard } from "@/components/plan-card"
import { PLANS, priceFor } from "@/lib/plans"

// Anonymous CTA per plan for the marketing section. Free drops straight into
// the app; paid plans route through signup and return to /app (the softer
// marketing flow — the /pricing page routes to checkout instead). Plan content
// comes from lib/plans.ts (single source of truth) — this section used to keep
// a hand-mirrored copy that drifted from the real prices/features.
function anonCta(key: "free" | "pro" | "premium"): { href: string; label: string } {
  if (key === "free") return { href: "/app", label: "Start free" }
  const label = key === "pro" ? "Get Pro" : "Get Premium"
  return { href: `/signin?mode=signup&reason=upgrade&plan=${key}&next=/app`, label }
}

export function Pricing() {
  return (
    <section
      id="pricing"
      className="relative py-24 sm:py-28 bg-navy scroll-mt-20 overflow-hidden"
    >
      {/* Soft accent orbs — same vocabulary as Hero + Features */}
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/12 rounded-full blur-[140px]" />
      <div className="pointer-events-none absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/8 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
            Simple, honest pricing
          </h2>
          <p className="mt-3 text-white/55">
            Free forever for casual use. Upgrade when you want flagship models or more
            models per comparison.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {PLANS.map(plan => {
            const m = priceFor(plan, "monthly")
            const a = priceFor(plan, "annual")
            const cta = anonCta(plan.key)
            return (
              <PlanCard
                key={plan.key}
                plan={plan}
                price={m}
                badge={plan.highlight ? "Most popular" : null}
                subline={m.isFree ? undefined : `or ${a.amountLabel}/yr — ${a.savePctLabel.toLowerCase()}`}
              >
                <PlanCta
                  planTier={plan.key}
                  name={plan.name}
                  anonHref={cta.href}
                  anonLabel={cta.label}
                  highlight={!!plan.highlight}
                />
              </PlanCard>
            )
          })}
        </div>

        <p className="text-center text-sm text-white/55 mt-10">
          No credit card required. Cancel anytime.{" "}
          <Link href="/models" className="text-teal-300 hover:text-teal-200 underline-offset-2 hover:underline">
            See the full model catalog →
          </Link>
        </p>
      </div>
    </section>
  )
}
