"use client"

import { Plus, X, Check, Lock } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { ProviderLogo } from "@/components/brand-icons"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CATEGORIES, PROVIDERS, type ModelCategory, type ModelEntry } from "@/lib/models"

export type { ModelEntry }

type Props = {
  all: ModelEntry[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  max?: number
  // Model ids the current tier may not use — shown locked with an upgrade hint.
  lockedIds?: Set<string>
}

// Top-tier cap. When the user's `max` is below this, we show a hint that
// Premium unlocks more slots.
const PREMIUM_MAX = 5

type GroupBy = "category" | "provider"

const GROUP_BY_PERSIST_KEY = "aggrai_picker_group_by_v1"

export function ModelPicker({ all, selected, onChange, max = 5, lockedIds }: Props) {
  const [open, setOpen] = useState(false)
  // Which axis we're grouping the tabs by. Defaults to category (the
  // original behaviour); persists per-browser so the user's preference
  // sticks across navigations.
  const [groupBy, setGroupBy] = useState<GroupBy>("category")
  const [activeCategory, setActiveCategory] = useState<ModelCategory>("fast")
  // activeProvider starts empty and gets set to the first visible
  // provider after the byProvider memo runs (see effect below). Keeping
  // category + provider as separate state means flipping the toggle
  // doesn't lose the user's previous tab pick on the other axis.
  const [activeProvider, setActiveProvider] = useState<string>("")
  // Brief in-popover toast "Swapped X for Y" when at-max swap fires.
  const [swapNotice, setSwapNotice] = useState<string | null>(null)
  const locked = lockedIds ?? new Set<string>()
  const limitReached = selected.size >= max

  // Restore persisted groupBy preference on first mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GROUP_BY_PERSIST_KEY)
      if (stored === "category" || stored === "provider") setGroupBy(stored)
    } catch { /* private mode — ignore */ }
  }, [])

  // Persist any change.
  useEffect(() => {
    try { localStorage.setItem(GROUP_BY_PERSIST_KEY, groupBy) } catch { /* ignore */ }
  }, [groupBy])

  // `all` includes deprecated entries so the selected-pill row can still
  // render labels for legacy URLs (e.g. ?models=anthropic/claude-opus-4.7).
  // The popover itself (tabs + lists) only offers pickable models — users
  // can't NEWLY select a retired model.
  const pickable = useMemo(() => all.filter(m => m.status !== "deprecated"), [all])

  // Group models by category once per render. Only categories that have
  // at least one model are shown as tabs — keeps the UI honest if the
  // backend ever returns a slimmed-down catalog.
  const byCategory = useMemo(() => {
    const map = new Map<ModelCategory, ModelEntry[]>()
    for (const m of pickable) {
      const cat = (m.category ?? "fast") as ModelCategory
      ;(map.get(cat) ?? map.set(cat, []).get(cat)!).push(m)
    }
    return map
  }, [pickable])

  // Same shape but keyed by provider for the provider grouping.
  const byProvider = useMemo(() => {
    const map = new Map<string, ModelEntry[]>()
    for (const m of pickable) {
      ;(map.get(m.provider) ?? map.set(m.provider, []).get(m.provider)!).push(m)
    }
    return map
  }, [pickable])

  const visibleCategories = CATEGORIES.filter(c => byCategory.has(c.id))
  const visibleProviders = PROVIDERS.filter(p => byProvider.has(p.id))

  // Initialise / re-anchor activeProvider when the catalog resolves.
  // Picks the first visible provider so the popover never shows an
  // empty tab strip in provider mode.
  useEffect(() => {
    if (visibleProviders.length === 0) return
    if (!activeProvider || !visibleProviders.find(p => p.id === activeProvider)) {
      setActiveProvider(visibleProviders[0].id)
    }
  }, [activeProvider, visibleProviders])

  // Unify the two groupings behind a single `groups` array so the tab
  // strip renderer doesn't have to branch on groupBy.
  type GroupTab = { id: string; label: string; description: string; count: number; active: boolean; onSelect: () => void }
  const groups: GroupTab[] = groupBy === "category"
    ? visibleCategories.map(c => ({
        id: c.id,
        label: c.label,
        description: c.description,
        count: byCategory.get(c.id)?.length ?? 0,
        active: c.id === activeCategory,
        onSelect: () => setActiveCategory(c.id),
      }))
    : visibleProviders.map(p => ({
        id: p.id,
        label: p.label,
        description: p.description,
        count: byProvider.get(p.id)?.length ?? 0,
        active: p.id === activeProvider,
        onSelect: () => setActiveProvider(p.id),
      }))

  const activeGroup = groups.find(g => g.active) ?? groups[0]
  const activeList = groupBy === "category"
    ? (byCategory.get(activeCategory) ?? [])
    : (byProvider.get(activeProvider) ?? [])

  function toggle(id: string) {
    if (locked.has(id)) return
    const next = new Set(selected)
    if (next.has(id)) {
      if (next.size > 1) next.delete(id) // keep at least one selected
    } else {
      // At max: auto-swap by dropping the leftmost (catalog-order) selection
      // instead of refusing the click. Old behaviour made users hunt for an
      // X button before they could try another model — high friction.
      if (next.size >= max) {
        const swappedOut = all.find(m => selected.has(m.id))
        const newPick = all.find(m => m.id === id)
        if (swappedOut) {
          next.delete(swappedOut.id)
          if (newPick) {
            setSwapNotice(`Swapped ${swappedOut.label} → ${newPick.label}`)
            setTimeout(() => setSwapNotice(null), 1800)
          }
        }
      }
      next.add(id)
    }
    onChange(next)
  }

  function remove(id: string) {
    if (selected.size <= 1) return
    const next = new Set(selected)
    next.delete(id)
    onChange(next)
  }

  // Order chips so they always render in catalog order, not selection order
  const orderedSelected = all.filter(m => selected.has(m.id))

  return (
    <div className="flex flex-wrap items-center gap-2">
      {orderedSelected.map(m => (
        <span
          key={m.id}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/15 text-white border border-white/20 pl-2.5 pr-1 py-1 text-xs font-medium"
        >
          <ProviderLogo provider={m.provider} className="w-3.5 h-3.5 shrink-0" />
          {m.label}
          <button
            type="button"
            onClick={() => remove(m.id)}
            disabled={selected.size <= 1}
            aria-label={`Remove ${m.label}`}
            className="inline-flex items-center justify-center min-w-[28px] min-h-[28px] rounded-full p-1.5 hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border border-white/15 bg-white/5 text-white/70 hover:text-white hover:border-white/30 transition-colors"
          >
            <Plus className="w-3 h-3" />
            {limitReached ? `Change models (${selected.size}/${max})` : "Add model"}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[340px] bg-navy/95 backdrop-blur-xl border-white/10 text-white p-0"
        >
          {/* Header: selection count + Premium upsell */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
            <span>Models</span>
            <span className={selected.size >= max ? "text-teal-300" : "text-white/40"}>
              {selected.size}/{max}
              {max < PREMIUM_MAX && (
                <span className="ml-1 text-white/25 normal-case tracking-normal font-medium">
                  · {PREMIUM_MAX} w/ Premium
                </span>
              )}
            </span>
          </div>

          {/* Group-by segmented toggle. Lets the user flip the tab strip
              between the curated category buckets (Fast / Creative / …)
              and a raw provider split (Anthropic / OpenAI / …). The
              choice persists in localStorage. */}
          <div className="flex items-center gap-1 px-3 pb-2 -mt-1">
            <span className="text-[10px] uppercase tracking-wider text-white/30 mr-1.5">Group by</span>
            {(["category", "provider"] as const).map(mode => {
              const isActive = groupBy === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGroupBy(mode)}
                  aria-pressed={isActive}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {mode === "category" ? "Category" : "Provider"}
                </button>
              )
            })}
          </div>

          {/* Tab strip — horizontal scroll on narrow viewports. Shape is
              the same whether we're showing categories or providers. */}
          <div className="flex gap-0.5 px-2 border-b border-white/5 overflow-x-auto scrollbar-none">
            {groups.map(g => (
              <button
                key={g.id}
                type="button"
                onClick={g.onSelect}
                aria-pressed={g.active}
                className={`shrink-0 px-3 py-2.5 text-[11px] font-medium rounded-t-md transition-colors border-b-2 min-h-[36px] ${
                  g.active
                    ? "border-teal-400 text-white bg-white/[0.04]"
                    : "border-transparent text-white/50 hover:text-white/80"
                }`}
              >
                {g.label}
                <span className="ml-1 text-[10px] text-white/30">{g.count}</span>
              </button>
            ))}
          </div>

          {/* Description of the active group (category or provider). */}
          <p className="px-3 py-2 text-[10px] leading-snug text-white/40 border-b border-white/5">
            {activeGroup?.description}
          </p>

          {/* Model list for the active category */}
          <div className="max-h-72 overflow-y-auto px-2 py-2">
            <ul>
              {activeList.map(m => {
                const isSelected = selected.has(m.id)
                const isLocked = locked.has(m.id)
                // !isSelected + limitReached now allowed — it auto-swaps.
                const disabled = isLocked
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => toggle(m.id)}
                      disabled={disabled}
                      className={`w-full flex items-center gap-2 rounded-md px-2 py-2.5 text-xs text-left transition-colors min-h-[36px] ${
                        isSelected
                          ? "bg-teal-400/15 text-teal-100"
                          : disabled
                            ? "text-white/30 cursor-not-allowed"
                            : "text-white/80 hover:bg-white/5"
                      }`}
                    >
                      <ProviderLogo provider={m.provider} className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate flex-1">{m.label}</span>
                      <span className="text-[10px] text-white/30 shrink-0">{m.provider}</span>
                      {isLocked ? (
                        // Premium-class models always show a Premium badge.
                        // Flagship models locked-for-Free show Pro. Lets a
                        // Pro user see at a glance which models are still
                        // locked to them vs which they already get.
                        m.class === "premium" ? (
                          <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-amber-300/15 text-amber-200/90 border border-amber-300/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                            <Lock className="w-2.5 h-2.5" /> Premium
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-teal-400/15 text-teal-200/90 border border-teal-400/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                            <Lock className="w-2.5 h-2.5" /> Pro
                          </span>
                        )
                      ) : isSelected ? (
                        <Check className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                      ) : null}
                    </button>
                  </li>
                )
              })}
              {activeList.length === 0 && (
                <li className="px-2 py-3 text-xs text-white/40 text-center">
                  No models in this category yet.
                </li>
              )}
            </ul>
          </div>

          {/* Footer hints + swap notice */}
          <div className="px-2 pb-2 space-y-1.5">
            {locked.size > 0 && (
              <div className="px-2 py-1.5 rounded-md bg-amber-400/10 border border-amber-400/20 text-[10px] text-amber-200 flex items-center justify-between gap-2">
                <span>Flagship models need a Pro plan.</span>
                <Link
                  href="/upgrade"
                  className="shrink-0 font-semibold underline underline-offset-2 hover:text-amber-100"
                >
                  Upgrade
                </Link>
              </div>
            )}
            {max < PREMIUM_MAX && (
              <div className="px-2 py-1.5 rounded-md bg-teal-400/10 border border-teal-400/20 text-[10px] text-teal-200 flex items-center justify-between gap-2">
                <span>Compare up to {PREMIUM_MAX} models with Premium.</span>
                <Link
                  href="/upgrade"
                  className="shrink-0 font-semibold underline underline-offset-2 hover:text-teal-100"
                >
                  Upgrade
                </Link>
              </div>
            )}
            {limitReached && !swapNotice && (
              <div className="px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-[10px] text-white/60">
                At {max} models. Tap another to swap automatically.
              </div>
            )}
            {swapNotice && (
              <div className="px-2 py-1.5 rounded-md bg-teal-400/10 border border-teal-400/20 text-[10px] text-teal-200">
                {swapNotice}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
