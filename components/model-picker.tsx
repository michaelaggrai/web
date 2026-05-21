"use client"

import { Plus, X, Check } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { useState } from "react"

export type ModelEntry = { id: string; label: string; provider: string; default?: boolean }

type Props = {
  all: ModelEntry[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  max?: number
}

function groupBy<T, K extends string>(arr: T[], fn: (t: T) => K): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const k = fn(item)
    ;(acc[k] ??= []).push(item)
    return acc
  }, {} as Record<K, T[]>)
}

export function ModelPicker({ all, selected, onChange, max = 5 }: Props) {
  const [open, setOpen] = useState(false)
  const limitReached = selected.size >= max
  const byProvider = groupBy(all, m => m.provider)

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) {
      if (next.size > 1) next.delete(id) // keep at least one selected
    } else {
      if (next.size >= max) return
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
          className="inline-flex items-center gap-1.5 rounded-full bg-white/15 text-white border border-white/20 pl-3 pr-1.5 py-1 text-xs font-medium"
        >
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
            disabled={limitReached}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border border-white/15 bg-white/5 text-white/70 hover:text-white hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-3 h-3" />
            {limitReached ? `${selected.size}/${max} selected` : "Add model"}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-72 bg-navy/95 backdrop-blur-xl border-white/10 text-white p-2"
        >
          <div className="flex items-center justify-between px-2 py-1.5 mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
            <span>Models</span>
            <span className={selected.size >= max ? "text-teal-300" : "text-white/40"}>
              {selected.size}/{max}
            </span>
          </div>
          <div className="max-h-80 overflow-y-auto pr-1">
            {(Object.keys(byProvider) as string[]).map(provider => (
              <div key={provider} className="mb-2 last:mb-0">
                <div className="text-[10px] uppercase tracking-wider text-white/30 px-2 py-1">{provider}</div>
                <ul>
                  {byProvider[provider].map(m => {
                    const isSelected = selected.has(m.id)
                    const disabled = !isSelected && limitReached
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => toggle(m.id)}
                          disabled={disabled}
                          className={`w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs text-left transition-colors ${
                            isSelected
                              ? "bg-teal-400/15 text-teal-100"
                              : disabled
                                ? "text-white/30 cursor-not-allowed"
                                : "text-white/80 hover:bg-white/5"
                          }`}
                        >
                          <span className="truncate">{m.label}</span>
                          {isSelected ? <Check className="w-3.5 h-3.5 text-teal-300 shrink-0" /> : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
          {limitReached && (
            <div className="mt-2 px-2 py-1.5 rounded-md bg-amber-400/10 border border-amber-400/20 text-[10px] text-amber-200">
              Max {max} models — remove one to swap.
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
