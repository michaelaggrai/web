"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { HomeLink } from "@/components/home-link";
import { AccountMenu } from "@/components/account-menu";
import { ProviderLogo, providerOf } from "@/components/brand-icons";
import {
  FALLBACK_MODELS,
  CATEGORIES,
  PROVIDERS,
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

// Map a model's `class` to the lowest tier that can use it.
//   basic    → Free  (everyone)
//   flagship → Pro   (Pro and Premium)
//   premium  → Premium (Premium only — reasoning + frontier)
function lowestTier(model: ModelEntry): Tier {
  if (model.class === "basic") return "free";
  if (model.class === "premium") return "premium";
  return "pro";
}

type GroupBy = "category" | "provider";
const ALL_TIERS: Tier[] = ["free", "pro", "premium"];
const GROUP_BY_KEY  = "aggrai_catalog_group_by_v1";
const TIER_FILTER_KEY = "aggrai_catalog_tier_filter_v1";

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

  // Group-by toggle (Category | Provider). Persisted in localStorage so a
  // user's preference sticks across visits. Mirrors the existing pattern in
  // ModelPicker (aggrai_picker_group_by_v1).
  const [groupBy, setGroupBy] = useState<GroupBy>("category");
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GROUP_BY_KEY);
      if (stored === "category" || stored === "provider") setGroupBy(stored);
    } catch { /* private mode */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(GROUP_BY_KEY, groupBy); } catch { /* ignore */ }
  }, [groupBy]);

  // Tier filter — three independent toggles. Default = show everything.
  // Stored as a JSON array of Tier strings.
  const [visibleTiers, setVisibleTiers] = useState<Set<Tier>>(new Set(ALL_TIERS));
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TIER_FILTER_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const restored = parsed.filter((t): t is Tier =>
        t === "free" || t === "pro" || t === "premium"
      );
      // Guard against an empty filter being persisted somehow — would
      // render an empty page on next load with no obvious way out.
      if (restored.length > 0) setVisibleTiers(new Set(restored));
    } catch { /* malformed JSON / private mode */ }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(TIER_FILTER_KEY, JSON.stringify([...visibleTiers]));
    } catch { /* ignore */ }
  }, [visibleTiers]);

  function toggleTier(tier: Tier) {
    setVisibleTiers(prev => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      // Don't allow the user to deselect everything — at least one tier
      // must stay visible or the page goes blank. Snap back to a useful
      // default if they tried.
      if (next.size === 0) return new Set(ALL_TIERS);
      return next;
    });
  }

  // Filtered set the rest of the page renders from.
  const filtered = models.filter(m => visibleTiers.has(lowestTier(m)));

  // Build grouping based on the active groupBy mode. Each group is a list
  // of models in the order they appear in the underlying catalog (which is
  // already the order we want for visual consistency).
  type Group = { id: string; label: string; description: string; models: ModelEntry[] };
  let groups: Group[];
  if (groupBy === "category") {
    const byCategory = new Map<ModelCategory, ModelEntry[]>();
    for (const m of filtered) {
      const cat = (m.category ?? "fast") as ModelCategory;
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(m);
    }
    groups = CATEGORIES.map(c => ({
      id: c.id,
      label: c.label,
      description: c.description,
      models: byCategory.get(c.id) ?? [],
    }));
  } else {
    const byProvider = new Map<string, ModelEntry[]>();
    for (const m of filtered) {
      if (!byProvider.has(m.provider)) byProvider.set(m.provider, []);
      byProvider.get(m.provider)!.push(m);
    }
    groups = PROVIDERS.map(p => ({
      id: p.id,
      label: p.label,
      description: p.description,
      models: byProvider.get(p.id) ?? [],
    }));
    // Catch any providers in the catalog that aren't in PROVIDERS metadata
    // (defensive — if a new provider's models are added on the backend
    // before the frontend metadata catches up). Append at the end.
    for (const [providerId, ms] of byProvider) {
      if (!PROVIDERS.find(p => p.id === providerId)) {
        groups.push({
          id: providerId,
          label: providerId,
          description: "",
          models: ms,
        });
      }
    }
  }

  const totalCount = models.length;
  const providerCount = new Set(models.map(m => m.provider)).size;
  const filteredCount = filtered.length;
  const filterActive = visibleTiers.size < ALL_TIERS.length;

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
            <HomeLink height={26} gradientId="models-logo" className="opacity-70 hover:opacity-100 transition-opacity" />
            <AccountMenu variant="topbar" />
          </div>
        </div>

        {/* Hero */}
        <div className="mb-10 max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
            The full model catalog
          </h1>
          <p className="mt-3 text-white/55 text-base leading-relaxed">
            {totalCount} models from {providerCount} providers, organised by what
            they&apos;re best at — or browse by company. Pick any combination on
            the comparison page.
          </p>
        </div>

        {/* Controls bar — tier filter (left) + group-by (right). On
            narrow viewports they stack with the tier filter first because
            it's the more frequently used control. */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-5 py-3.5">
          {/* Tier filter — each pill is a toggle. Clicking turns a tier
              on/off; at least one must stay on (auto-resets to all if the
              user deselects everything). */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-white/30 shrink-0">Show</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {ALL_TIERS.map(tier => {
                const active = visibleTiers.has(tier);
                const badge = TIER_BADGES[tier];
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => toggleTier(tier)}
                    aria-pressed={active}
                    title={active ? `Hide ${badge.label} models` : `Show ${badge.label} models`}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all ${
                      active
                        ? badge.classes
                        : "border-white/10 bg-transparent text-white/30 hover:text-white/50 hover:border-white/20"
                    }`}
                  >
                    {tier !== "free" && <Lock className="w-2.5 h-2.5" />}
                    {badge.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group-by toggle — Category (what each model is best at) vs
              Provider (which company built it). Mirrors the same control
              in ModelPicker so the muscle memory transfers. */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-white/30 mr-1">Group by</span>
            <div className="inline-flex items-center rounded-md bg-white/5 p-0.5">
              {(["category", "provider"] as const).map(mode => {
                const isActive = groupBy === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setGroupBy(mode)}
                    aria-pressed={isActive}
                    className={`px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    {mode === "category" ? "Category" : "Provider"}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sub-header showing what the user is actually looking at. Helps
            them notice when a filter is silently hiding a chunk of the
            catalog (e.g. "showing 9 of 30"). */}
        <p className="mb-6 text-xs text-white/40">
          {filterActive ? (
            <>Showing <span className="text-white/70">{filteredCount}</span> of {totalCount} models</>
          ) : (
            <>{totalCount} models · {providerCount} providers</>
          )}
        </p>

        {/* Groups — same shape whether by category or provider */}
        <div className="space-y-12">
          {groups.map(g => {
            if (g.models.length === 0) return null;
            return (
              <section key={g.id}>
                <div className="mb-4 flex items-baseline justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      {/* When grouping by provider, lead with the brand
                          glyph so the visual scan is "logo + name". */}
                      {groupBy === "provider" && (
                        <ProviderLogo provider={g.id} className="w-4 h-4 shrink-0" />
                      )}
                      {g.label}
                    </h2>
                    {g.description && (
                      <p className="text-sm text-white/45 mt-0.5">{g.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-white/30 shrink-0">
                    {g.models.length} model{g.models.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {g.models.map(m => (
                    <ModelCard key={m.id} model={m} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Empty state — only reachable if the API returned models but the
            filter happens to hide all of them in the current grouping
            (shouldn't happen since toggleTier guards against empty
            filters, but defensive). */}
        {filteredCount === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
            <p className="text-sm text-white/60">No models match the current filter.</p>
            <button
              type="button"
              onClick={() => setVisibleTiers(new Set(ALL_TIERS))}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 transition"
            >
              Reset filter
            </button>
          </div>
        )}

        {/* Tier legend — moved below the catalog so the hero stays clean.
            Useful reference for anyone scanning the badges and wondering
            what they mean. */}
        <div className="mt-12 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/60">
          <TierLegend tier="free" />
          <TierLegend tier="pro" />
          <TierLegend tier="premium" />
        </div>

        {/* CTAs */}
        <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 text-center">
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
