import Link from "next/link";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { PlanCta } from "@/components/pricing-cta";
import { PlanCard } from "@/components/plan-card";
import { PLANS, priceFor } from "@/lib/plans";

export const metadata = {
  title: "Pricing — aggrai",
  description: "Free, Pro, and Premium plans for aggrai.",
};

// Anonymous CTA per plan. Free goes straight into the app; paid plans go
// through sign-in and land back on the paid checkout for that plan (the
// cycle can be switched at checkout).
function anonCta(key: "free" | "pro" | "premium"): { href: string; label: string } {
  if (key === "free") return { href: "/app", label: "Start free" };
  const next = encodeURIComponent(`/checkout?plan=${key}&cycle=monthly`);
  return { href: `/signin?reason=upgrade&next=${next}`, label: key === "pro" ? "Get Pro" : "Get Premium" };
}

export default function PricingPage() {
  return (
    <div className="relative min-h-dvh bg-navy px-4 pt-24 overflow-hidden">
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
            const m = priceFor(plan, "monthly");
            const a = priceFor(plan, "annual");
            const cta = anonCta(plan.key);
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
          <div className="rounded-xl border border-white/10 bg-surface-1 p-5">
            <p className="font-medium text-white mb-1.5">Can I change plans?</p>
            <p className="text-white/50 leading-relaxed">
              Yes, any time. Changes take effect immediately; cancellations end
              at the current billing period.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-surface-1 p-5">
            <p className="font-medium text-white mb-1.5">Do I need an account for Free?</p>
            <p className="text-white/50 leading-relaxed">
              No. Anyone can use Free without signing up. Accounts are only
              needed to upgrade.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-surface-1 p-5">
            <p className="font-medium text-white mb-1.5">What about refunds?</p>
            <p className="text-white/50 leading-relaxed">
              Cancel any time, no charges for future periods. We don&apos;t refund
              partial months — see the <Link href="/terms" className="text-teal-300 hover:underline">Terms</Link>.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-surface-1 p-5">
            <p className="font-medium text-white mb-1.5">Where do model costs go?</p>
            <p className="text-white/50 leading-relaxed">
              We pay the underlying providers (OpenAI, Anthropic, Google, etc.)
              for every request. Your plan covers that and the rest of running
              the service.
            </p>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-white/55">
          Questions? <Link href="/contact" className="text-white/50 hover:text-white underline underline-offset-2">Contact</Link> · <Link href="/terms" className="text-white/55 hover:text-white">Terms</Link> · <Link href="/privacy" className="text-white/55 hover:text-white">Privacy</Link>
        </p>
      </div>
      <div className="relative z-10 -mx-4 mt-16"><Footer /></div>
    </div>
  );
}
