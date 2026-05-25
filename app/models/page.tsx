"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { Logo } from "@/components/logo";
import { AccountMenu } from "@/components/account-menu";
import { ProviderLogo, providerOf } from "@/components/brand-icons";
import {
  FALLBACK_MODELS,
  CATEGORIES,
  TIERS,
  type ModelEntry,
  type ModelCategory,
  type Tier,
} from "@/lib/models";

// Tier badges match the sidebar tier-pill colours so the visual vocabulary
// is consistent across the app.
const TIER_BADGES: Record<Tier, { label: string; classes: string }> = {
  free:    { label: "FREE",    classes: "border-white/15 bg-white/5 text-white/60" },
  pro:     { label: "PRO",     classes: "border-teal-400/30 bg-teal-400/10 text-teal-300" },
  premium: { label: "PREMIUM", classes: "border-amber-300/30 bg-amber-300/10 text-amber-200" },
};

// Map a model's `class` (basic | flagship) to the lowest tier that can use it.
// 'basic' lives in Free; 'flagship' needs Pro+ (Premium also has it).
function lowestTier(model: ModelEntry): Tier {
  return model.class === "basic" ? "free" : "pro";
}

export default function ModelsPage() {
  // Try live catalog first; fall back to the static one so the page never
  // shows an empty state if the backend is down.
  const [models, setModels] = useState<ModelEntry[]>(FALLBACK_MODELS);
  useEffect(() => {
    fetch("/api/models")
      .then(r => r.json())
      .then((d: { models?: ModelEntry[] }) => {
        if (Array.isArray(d.models) && d.models.length > 0) setModels(d.models);
      })
      .catch(() => {});
  }, []);

  // Group models by category in the canonical CATEGORIES order
  const byCategory = new Map<ModelCategory, ModelEntry[]>();
  for (const m of models) {
    const cat = (m.category ?? "fast") as ModelCategory;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(m);
  }
  const totalCount = models.length;
  const providerCount = new Set(models.map(m => m.provider)).size;

  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547] px-4 py-12 overflow-hidden">
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/12 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-5xl">
        {/* Header bar */}
        <div className="mb-10 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="opacity-70 hover:opacity-100 transition-opacity">
              <Logo height={26} gradientId="models-logo" />
            </Link>
            <AccountMenu variant="topbar" />
          </div>
        </div>

        {/* Hero */}
        <div className="mb-12 max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
            The full model catalog
          </h1>
          <p className="mt-3 text-white/55 text-base leading-relaxed">
            {totalCount} models from {providerCount} providers, organised by what
            they&apos;re best at. Pick any combination on the comparison page.
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-xs text-white/60">
            <TierLegend tier="free" />
            <TierLegend tier="pro" />
            <TierLegend tier="premium" />
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-12">
          {CATEGORIES.map(cat => {
            const list = byCategory.get(cat.id) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={cat.id}>
                <div className="mb-4 flex items-baseline justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{cat.label}</h2>
                    <p className="text-sm text-white/45 mt-0.5">{cat.description}</p>
                  </div>
                  <span className="text-xs text-white/30 shrink-0">
                    {list.length} model{list.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {list.map(m => (
                    <ModelCard key={m.id} model={m} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* CTAs */}
        <div className="mt-16 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 text-center">
          <h3 className="text-lg font-semibold text-white">Compare them now</h3>
          <p className="mt-1.5 text-sm text-white/50">
            Pick 3 models and ask anything. Free for ever, no card needed.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 px-5 py-2.5 text-sm font-medium text-white hover:from-teal-400 hover:to-teal-400 transition shadow-lg shadow-teal-500/20"
            >
              Start a comparison
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition"
            >
              See pricing
            </Link>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-white/30">
          Models change as providers add and deprecate them — this list is
          updated alongside our backend catalog. Questions?{" "}
          <Link href="/contact" className="text-white/50 hover:text-white underline underline-offset-2">
            Get in touch
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function ModelCard({ model }: { model: ModelEntry }) {
  const tier = lowestTier(model);
  const badge = TIER_BADGES[tier];
  return (
    <div className="group rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.06] hover:border-white/20 transition-all p-4 flex items-center gap-3">
      <div className="shrink-0 w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
        <ProviderLogo provider={providerOf(model.id)} className="w-[18px] h-[18px] text-white/80" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate">{model.label}</p>
        <p className="text-[11px] text-white/40 truncate">{model.provider}</p>
      </div>
      <span
        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badge.classes}`}
        title={`Available on ${TIERS[tier].label} and up`}
      >
        {tier !== "free" && <Lock className="inline w-2.5 h-2.5 mr-0.5 mb-px" />}
        {badge.label}
      </span>
    </div>
  );
}

function TierLegend({ tier }: { tier: Tier }) {
  const badge = TIER_BADGES[tier];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badge.classes}`}>
        {badge.label}
      </span>
      <span className="text-white/50">
        {tier === "free" && "available without an account"}
        {tier === "pro" && "needs Pro plan"}
        {tier === "premium" && "needs Premium plan"}
      </span>
    </span>
  );
}
