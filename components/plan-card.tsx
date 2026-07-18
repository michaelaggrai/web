import { Check } from "lucide-react";
import type { ReactNode } from "react";
import type { Plan, PriceView } from "@/lib/plans";

// Canonical plan card, shared by the marketing pricing section, the /pricing
// page and the /upgrade page (P2 #12). Before this, each restated the same
// plans with slightly different anatomy, badges and CTA colours. The card
// shell — border/highlight, icon+name, price, blurb, feature list — lives here;
// only the three things that genuinely differ are props:
//   badge    — "Most popular" (marketing) vs "Current plan" (upgrade)
//   subline  — the small teal price note (annual split / per-month), site-specific
//   children — the CTA slot (PlanCta on marketing, tier-aware button on /upgrade)
export function PlanCard({
  plan,
  price,
  badge,
  subline,
  ring,
  children,
}: {
  plan: Plan;
  price: PriceView;
  /** Pill above the card, e.g. "Most popular" / "Current plan". */
  badge?: string | null;
  /** Small teal line under the price (annual/per-month note). */
  subline?: string;
  /** Extra emphasis ring (used for the user's current plan on /upgrade). */
  ring?: boolean;
  /** CTA slot rendered at the foot of the card. */
  children: ReactNode;
}) {
  const Icon = plan.icon;
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
        plan.highlight
          ? "border-teal-400/40 bg-teal-400/[0.06] shadow-lg shadow-teal-500/10"
          : "border-white/10 bg-surface-1"
      } ${ring ? "ring-2 ring-teal-400/30" : ""}`}
    >
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-teal-400/20 border border-teal-400/30 px-3 py-0.5 text-[11px] font-semibold text-teal-300 uppercase tracking-wider">
          {badge}
        </span>
      )}

      <div className="flex items-center gap-2 mb-4">
        <Icon className={`w-5 h-5 ${plan.iconColor}`} aria-hidden="true" />
        <span className="font-semibold text-white">{plan.name}</span>
      </div>

      <div className="mb-1 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold text-white">{price.amountLabel}</span>
        <span className="text-white/55 text-sm">{price.isFree ? "forever" : price.unit}</span>
      </div>
      <p className="mb-5 h-4 text-xs text-teal-300/80">{subline ?? " "}</p>

      <p className="text-sm text-white/55 mb-6">{plan.blurb}</p>

      <ul className="space-y-2 mb-8 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-white/70">
            <Check className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>

      {children}
    </div>
  );
}
