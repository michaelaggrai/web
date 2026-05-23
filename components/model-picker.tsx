"use client"

import { Plus, X, Check, Lock } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { ProviderLogo } from "@/components/brand-icons"
import { useMemo, useState } from "react"
import Link from "next/link"
import { CATEGORIES, type ModelCategory, type ModelEntry } from "@/lib/models"

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

export function ModelPicker({ all, selected, onChange, max = 5, lockedIds }: Props) {
  const [open, setOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<ModelCategory>("fast")
  // Brief in-popover toast "Swapped X for Y" when at-max swap fires.
  const [swapNotice, setSwapNotice] = useState<string | null>(null)
  const locked = lockedIds ?? new Set<string>()
  const limitReached = selected.size >= max

  // Group models by category once per render. Only categories that have
  // at least one model are shown as tabs — keeps the UI honest if the
  // backend ever returns a slimmed-down catalog.
  const byCategory = useMemo(() => {
    const map = new Map<ModelCategory, ModelEntry[]>()
    for (const m of all) {
      const cat = (m.category ?? "fast") as ModelCategory
      ;(map.get(cat) ?? map.set(cat, []).get(cat)!).push(m)
    }
    return map
  }, [all])

  const visibleCategories = CATEGORIES.filter(c => byCategory.has(c.id))
  const activeList = byCategory.get(activeCategory) ?? []

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
          className="inline-flex items-center gap-1.5 rounded-full bg-white/15 text-white border border-white/20 pl-2.5 pr-1.5 py-1 text-xs font-medium"
        >
          <ProviderLogo provider={m.provider} className="w-3.5 h-3.5 shrink-0" />
          {m.label}
          <button
            type="button"
            onClick={() => remove(m.id)}
            disabled={selected.size <= 1}
            aria-label={`Remove ${m.label}`}
            className="rounded-full p-0.5 hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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

          {/* Category tabs — horizontal scroll on narrow viewports */}
          <div className="flex gap-0.5 px-2 border-b border-white/5 overflow-x-auto scrollbar-none">
            {visibleCategories.map(c => {
              const isActive = c.id === activeCategory
              const count = byCategory.get(c.id)?.length ?? 0
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategory(c.id)}
                  className={`shrink-0 px-2.5 py-1.5 text-[11px] font-medium rounded-t-md transition-colors border-b-2 ${
                    isActive
                      ? "border-teal-400 text-white bg-white/[0.04]"
                      : "border-transparent text-white/50 hover:text-white/80"
                  }`}
                >
                  {c.label}
                  <span className="ml-1 text-[10px] text-white/30">{count}</span>
                </button>
              )
            })}
          </div>

          {/* Category description */}
          <p className="px-3 py-2 text-[10px] leading-snug text-white/40 border-b border-white/5">
            {CATEGORIES.find(c => c.id === activeCategory)?.description}
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
                      className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left transition-colors ${
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
                        <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-amber-400/15 text-amber-200/90 border border-amber-400/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                          <Lock className="w-2.5 h-2.5" /> Pro
                        </span>
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
