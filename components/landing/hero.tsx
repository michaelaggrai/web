"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Sparkles, Shuffle, Globe } from "lucide-react"
import { ModelPicker } from "@/components/model-picker"
import { FALLBACK_MODELS, TIER_DEFAULTS, maxModelsForTier, lockedModelIds, type ModelEntry } from "@/lib/models"
import { useTier } from "@/lib/use-tier"
import { generateConvId, storeConv } from "@/lib/conv-id"

// Static fallback — used until /api/prompts responds with the live pool,
// and as the displayed prompts if the API is unreachable.
const FALLBACK_POOL = [
  "Why do recessions hurt the poor more?",
  "Can democracy survive extreme wealth inequality?",
  "How does GPS actually work?",
]

const VISIBLE_COUNT = 3

// Fisher-Yates partial shuffle: returns N random items from arr.
function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, Math.min(n, copy.length))
}

export function Hero() {
  const [query, setQuery] = useState("")
  // `pool` is the full set of available prompts (loaded from /api/prompts).
  // `examples` is the VISIBLE_COUNT-sized subset currently shown. Shuffle
  // picks a new subset from `pool`. We keep both so Shuffle is instant —
  // no network roundtrip per click.
  const [pool, setPool] = useState<string[]>(FALLBACK_POOL)
  const [examples, setExamples] = useState<string[]>(() => pickN(FALLBACK_POOL, VISIBLE_COUNT))
  // D8: current-events tier — a small set of "ask the news, compared live"
  // questions, refreshed + web-search-grounded daily by the backend. Empty until
  // /api/prompts loads; empty stays hidden (best-effort, so a landing with no
  // topical questions just shows the evergreen chips as before).
  const [topical, setTopical] = useState<string[]>([])
  const [allModels, setAllModels] = useState<ModelEntry[]>(FALLBACK_MODELS)
  const [selected, setSelected] = useState<Set<string>>(new Set(TIER_DEFAULTS.free))
  const router = useRouter()
  const { tier } = useTier()

  const maxModels = maxModelsForTier(tier)
  const lockedIds = lockedModelIds(tier, allModels)

  useEffect(() => {
    fetch("/api/models")
      .then(r => r.json())
      .then((d: { models?: ModelEntry[] }) => {
        if (Array.isArray(d.models) && d.models.length > 0) setAllModels(d.models)
      })
      .catch(() => {})
    // Load the full pool so the Shuffle button has more than 6 options to draw
    // from. Falls back silently to the static FALLBACK_POOL on error.
    fetch("/api/prompts?all=1")
      .then(r => r.json())
      .then((d: { prompts?: string[]; topical?: string[] }) => {
        if (Array.isArray(d.prompts) && d.prompts.length >= VISIBLE_COUNT) {
          setPool(d.prompts)
          setExamples(pickN(d.prompts, VISIBLE_COUNT))
        }
        // Show up to 4 topical chips (the tier is ~5; keep the row compact).
        if (Array.isArray(d.topical) && d.topical.length > 0) setTopical(d.topical.slice(0, 4))
      })
      .catch(() => {})
  }, [])

  function shuffle() {
    // Avoid showing exactly the same 6 twice in a row when the pool is large
    // enough to make that statistically unlikely anyway, but the user clicked
    // Shuffle so they should see *something* change.
    if (pool.length <= VISIBLE_COUNT) {
      setExamples(pickN(pool, VISIBLE_COUNT))
      return
    }
    let next = pickN(pool, VISIBLE_COUNT)
    let attempts = 0
    while (attempts < 5 && next.every(p => examples.includes(p))) {
      next = pickN(pool, VISIBLE_COUNT)
      attempts++
    }
    setExamples(next)
  }

  // Navigate to /app carrying both the question and the model selection.
  //
  // We generate an opaque short id, stash the {question, models} in
  // sessionStorage, and use a clean /app/c/{id} URL so the user's
  // question + model selection don't end up in the address bar (or
  // anyone's screen-share). The /app/c/[id] route reads sessionStorage
  // and auto-submits.
  //
  // Falls back to the legacy ?q= / ?models= query-string URL when:
  //   - no prompt was typed (the user just wants to go to the empty
  //     /app to pick models manually), or
  //   - sessionStorage isn't available (rare — disabled cookies, some
  //     privacy modes). The empty-prompt case in particular never
  //     produced a useful conversation id anyway.
  function goToApp(prompt: string) {
    const trimmed = prompt.trim()
    const modelsArr = [...selected]
    if (trimmed) {
      const id = generateConvId()
      storeConv(id, { question: trimmed, models: modelsArr })
      router.push(`/app/c/${id}`)
      return
    }
    // Empty prompt → no conversation id; jump straight to /app with
    // models so the picker is pre-populated.
    router.push(`/app?models=${encodeURIComponent(modelsArr.join(","))}`)
  }

  return (
    <section className="relative min-h-[92svh] flex items-center bg-gradient-to-b from-navy via-navy to-[#252547] overflow-hidden">
      {/* Soft gradient orbs */}
      <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/5 rounded-full blur-[150px]" />
      
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20 w-full">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 mb-8">
            <Sparkles className="w-4 h-4 text-teal-300" />
            <span className="text-sm text-white/80 font-medium">Compare AI models instantly</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-white tracking-tight leading-[1.15]">
            Get answers from
            <br />
            <span className="bg-gradient-to-r from-teal-300 to-teal-200 bg-clip-text text-transparent">every perspective</span>
          </h1>
          <p className="mt-6 text-lg text-white/50 max-w-lg mx-auto leading-relaxed">
            Ask once, compare many. See how different AI models think about your questions.
          </p>
          
          {/* Chat input */}
          <div className="mt-10 max-w-xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                goToApp(query)
              }}
              className="relative"
            >
              <div className="flex items-center bg-white/[0.08] backdrop-blur-xl rounded-2xl border border-white/10 hover:border-white/20 transition-colors shadow-2xl shadow-black/20">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What would you like to know?"
                  aria-label="Ask a question"
                  className="flex-1 bg-transparent text-white placeholder:text-white/30 px-6 py-5 text-base focus:outline-none rounded-2xl"
                />
                <button
                  type="submit"
                  className="m-2 bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-400 text-white p-3.5 rounded-xl transition-all shadow-lg shadow-teal-500/25"
                  aria-label="Submit query"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              {/* Model selector */}
              <div className="mt-4 flex justify-center">
                <ModelPicker
                  all={allModels}
                  selected={selected}
                  onChange={setSelected}
                  max={maxModels}
                  lockedIds={lockedIds}
                />
              </div>

              {/* D8: topical "in the news" row — a live, web-search-grounded
                  hook, visually distinct (teal + globe + pulse) from the muted
                  evergreen chips below. Hidden entirely when the tier is empty. */}
              {topical.length > 0 && (
                <div className="mt-6 flex flex-col items-center gap-2.5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-300/80">
                    <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400/70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-400" />
                    </span>
                    In the news · compared live
                  </div>
                  <div className="flex flex-wrap justify-center items-center gap-2">
                    {topical.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => goToApp(prompt)}
                        className="inline-flex items-center gap-1.5 text-sm text-teal-100/80 hover:text-white px-4 py-2 rounded-full bg-teal-400/10 hover:bg-teal-400/20 border border-teal-300/20 hover:border-teal-300/40 transition-all"
                      >
                        <Globe className="w-3.5 h-3.5 shrink-0 text-teal-300/70" aria-hidden="true" />
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Example prompts + Shuffle */}
              <div className="mt-5 flex flex-wrap justify-center items-center gap-2">
                {examples.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => goToApp(prompt)}
                    className="text-sm text-white/40 hover:text-white/70 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all"
                  >
                    {prompt}
                  </button>
                ))}
                {pool.length > VISIBLE_COUNT && (
                  <button
                    type="button"
                    onClick={shuffle}
                    aria-label="Show different example questions"
                    className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-teal-300 px-3 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    Shuffle
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
