// AGG-pricing-rework (2026-05-26): added "premium" class so the most
// expensive reasoning + frontier models (Claude Opus 4.7, GPT-5.5 Pro,
// Grok-4.20, Qwen3 Max Thinking, etc.) are reserved for Premium tier.
// Pro tier still gets "basic" + "flagship" but NOT "premium".
export type ModelClass = "basic" | "flagship" | "premium"
export type ModelCategory = "fast" | "reasoning" | "coding" | "creative" | "multimodal" | "frontier"
export type Tier = "free" | "pro" | "premium"

export type ModelEntry = {
  id: string
  label: string
  provider: string
  class: ModelClass
  /** Optional for backwards compat with payloads from older backend builds. */
  category?: ModelCategory
  /**
   * Lifecycle: undefined / "active" = visible in pickers + ranked lists.
   * "deprecated" = hidden from picker UI but the id stays valid so old
   * URLs, cached comparisons, and result-card labels keep resolving.
   * Use this to retire a model without a code change rippling through
   * tier-gating, label lookups, and cache keys.
   */
  status?: "active" | "deprecated"
}

// Display metadata per category — used by ModelPicker tabs.
export const CATEGORIES: { id: ModelCategory; label: string; description: string }[] = [
  { id: "fast",       label: "Fast",       description: "Cheap, low-latency. Good first pick for general questions." },
  { id: "creative",   label: "Creative",   description: "Long-form writing, conversation, general-purpose flagships." },
  { id: "reasoning",  label: "Reasoning",  description: "Chain-of-thought, deep-think specialists." },
  { id: "coding",     label: "Coding",     description: "Code-tuned models. Great for software questions." },
  { id: "multimodal", label: "Multimodal", description: "Vision, audio, video-capable." },
  { id: "frontier",   label: "Frontier",   description: "Cutting edge / very large / experimental." },
]

// Display metadata per provider — used by ModelPicker when the user
// flips the Group-by toggle from Category → Provider. `id` must match
// the `provider` field on ModelEntry exactly (case-sensitive).
//
// Order is roughly "most familiar to a Western audience first" — the
// ordering also doubles as the tab strip's left-to-right order so
// Anthropic/OpenAI/Google lead.
export const PROVIDERS: { id: string; label: string; description: string }[] = [
  { id: "Anthropic", label: "Anthropic", description: "Claude family — careful, nuanced, hedge-leaning answers." },
  { id: "OpenAI",    label: "OpenAI",    description: "GPT family — confident, example-rich, broad coverage." },
  { id: "Google",    label: "Google",    description: "Gemini family — concise, strong multimodal." },
  { id: "Meta",      label: "Meta",      description: "Llama family — open-weight, direct, no hedging." },
  { id: "Mistral",   label: "Mistral",   description: "European, fast and to the point." },
  { id: "DeepSeek",  label: "DeepSeek",  description: "Strong reasoning specialist." },
  { id: "Qwen",      label: "Qwen",      description: "Alibaba, multilingual + reasoning." },
  { id: "xAI",       label: "xAI",       description: "Grok, frontier multi-agent experiments." },
  { id: "Moonshot",  label: "Moonshot",  description: "Kimi family — long-context deep reasoning." },
  { id: "Zhipu",     label: "Zhipu",     description: "GLM family — frontier reasoning, open-weight." },
  { id: "MiniMax",   label: "MiniMax",   description: "Long-context reasoning, very low cost." },
]

// Display metadata per tier — used by ModelPicker when grouping by tier.
// `id` is the model CLASS each tab shows; labels use the plan names users
// know (class basic → Free tab, flagship → Pro, premium → Premium).
export const TIER_GROUPS: { id: ModelClass; label: string; description: string }[] = [
  { id: "basic",    label: "Free",    description: "Fast, lightweight models — available to everyone, no account needed." },
  { id: "flagship", label: "Pro",     description: "Every flagship model from the major labs, unlocked with Pro." },
  { id: "premium",  label: "Premium", description: "Deep-think research specialists, exclusive to Premium." },
]

// Fallback catalog used until /api/models responds (or if it fails).
// Mirrors the backend MODEL_CATALOG in api/server.js. Every ID was
// live-verified against OpenRouter on 2026-05-23.
export const FALLBACK_MODELS: ModelEntry[] = [
  // Fast (basic = Free tier)
  { id: "anthropic/claude-haiku-4-5",               label: "Claude Haiku 4.5",     provider: "Anthropic", class: "basic",    category: "fast" },
  { id: "openai/gpt-4o-mini",                       label: "GPT-4o Mini",          provider: "OpenAI",    class: "basic",    category: "fast" },
  { id: "google/gemini-2.5-flash",                  label: "Gemini 2.5 Flash",     provider: "Google",    class: "basic",    category: "fast" },
  { id: "mistralai/mistral-small-3.2-24b-instruct", label: "Mistral Small",        provider: "Mistral",   class: "basic",    category: "fast" },
  { id: "meta-llama/llama-3.1-8b-instruct",         label: "Llama 3.1 8B",         provider: "Meta",      class: "basic",    category: "fast" },
  { id: "deepseek/deepseek-v3.2",                   label: "DeepSeek v3.2",        provider: "DeepSeek",  class: "basic",    category: "fast" },
  // Re-classed to "basic" 2026-05-26: priced in the same ballpark as the
  // other basic models, no reason to gate. See backend MODEL_CATALOG.
  { id: "openai/gpt-5.4-mini",                      label: "GPT-5.4 Mini",         provider: "OpenAI",    class: "basic",    category: "fast" },
  { id: "google/gemini-3.1-flash-lite",             label: "Gemini 3.1 Flash Lite",provider: "Google",    class: "basic",    category: "fast" },

  // Creative
  { id: "anthropic/claude-sonnet-4-6",              label: "Claude Sonnet 4.6",    provider: "Anthropic", class: "flagship", category: "creative" },
  { id: "openai/gpt-4o",                            label: "GPT-4o",               provider: "OpenAI",    class: "flagship", category: "creative" },
  // GPT-5.4 deprecated 2026-05-29 — 5.5 supersedes it; having both as full
  // models in the Creative tab confused users. 5.4 Mini stays in Free.
  { id: "openai/gpt-5.4",                           label: "GPT-5.4",              provider: "OpenAI",    class: "flagship", category: "creative", status: "deprecated" },
  { id: "openai/gpt-5.5",                           label: "GPT-5.5",              provider: "OpenAI",    class: "flagship", category: "creative" },
  { id: "mistralai/mistral-large-2512",             label: "Mistral Large",        provider: "Mistral",   class: "flagship", category: "creative" },

  // Reasoning — Opus 4.7 is general-purpose flagship (Pro). The 4
  // explicit deep-think specialists stay Premium.
  { id: "openai/gpt-5.4-pro",                       label: "GPT-5.4 Pro",          provider: "OpenAI",    class: "premium",  category: "reasoning", status: "deprecated" },
  { id: "openai/gpt-5.5-pro",                       label: "GPT-5.5 Pro",          provider: "OpenAI",    class: "premium",  category: "reasoning" },
  // Fable 5 launched 2026-06: Anthropic's tier above Opus ($10/$50 per 1M —
  // 2× Opus 4.8). First Anthropic model in the Premium class.
  { id: "anthropic/claude-fable-5",                 label: "Claude Fable 5",       provider: "Anthropic", class: "premium",  category: "reasoning" },
  // Opus 4.8 launched 2026-05-27. Same price as 4.7, pure upgrade.
  { id: "anthropic/claude-opus-4.8",                label: "Claude Opus 4.8",      provider: "Anthropic", class: "flagship", category: "reasoning" },
  { id: "anthropic/claude-opus-4.7",                label: "Claude Opus 4.7",      provider: "Anthropic", class: "flagship", category: "reasoning", status: "deprecated" },
  { id: "deepseek/deepseek-v4-pro",                 label: "DeepSeek v4 Pro",      provider: "DeepSeek",  class: "premium",  category: "reasoning" },
  { id: "qwen/qwen3-max-thinking",                  label: "Qwen3 Max Thinking",   provider: "Qwen",      class: "premium",  category: "reasoning" },
  // 2026-06-11: three more Premium deep-thinkers from new providers (Moonshot,
  // Zhipu, MiniMax). All reasoning-class, all far cheaper than GPT-5.5 Pro.
  // Mirror of backend MODEL_CATALOG.
  { id: "moonshotai/kimi-k2-thinking",              label: "Kimi K2 Thinking",     provider: "Moonshot",  class: "premium",  category: "reasoning" },
  { id: "z-ai/glm-5.1",                             label: "GLM-5.1",              provider: "Zhipu",     class: "premium",  category: "reasoning" },
  { id: "minimax/minimax-m2.5",                     label: "MiniMax M2.5",         provider: "MiniMax",   class: "premium",  category: "reasoning" },

  // Coding
  { id: "openai/gpt-5.3-codex",                     label: "GPT-5.3 Codex",        provider: "OpenAI",    class: "flagship", category: "coding" },
  { id: "openai/gpt-5.1-codex-mini",                label: "GPT-5.1 Codex Mini",   provider: "OpenAI",    class: "flagship", category: "coding" },
  { id: "mistralai/devstral-2512",                  label: "Devstral",             provider: "Mistral",   class: "flagship", category: "coding" },
  { id: "qwen/qwen3-coder-next",                    label: "Qwen3 Coder",          provider: "Qwen",      class: "flagship", category: "coding" },

  // Multimodal
  { id: "google/gemini-2.5-pro",                    label: "Gemini 2.5 Pro",       provider: "Google",    class: "flagship", category: "multimodal" },
  { id: "google/gemini-3.5-flash",                  label: "Gemini 3.5 Flash",     provider: "Google",    class: "flagship", category: "multimodal" },
  { id: "google/gemini-3.1-pro-preview",            label: "Gemini 3.1 Pro",       provider: "Google",    class: "flagship", category: "multimodal" },
  { id: "google/gemini-3-flash-preview",            label: "Gemini 3 Flash",       provider: "Google",    class: "flagship", category: "multimodal" },

  // Frontier — only Grok Multi-Agent (experimental agentic mode) stays
  // Premium. Opus 4.x Fast, Grok 4.20 base, and Llama 3.3 70B are Pro.
  { id: "anthropic/claude-opus-4.8-fast",           label: "Claude Opus 4.8 Fast", provider: "Anthropic", class: "flagship", category: "frontier" },
  { id: "anthropic/claude-opus-4.7-fast",           label: "Claude Opus 4.7 Fast", provider: "Anthropic", class: "flagship", category: "frontier", status: "deprecated" },
  { id: "x-ai/grok-4.20",                           label: "Grok 4.20",            provider: "xAI",       class: "flagship", category: "frontier" },
  { id: "x-ai/grok-4.20-multi-agent",               label: "Grok 4.20 Multi-Agent",provider: "xAI",       class: "premium",  category: "frontier" },
  { id: "meta-llama/llama-3.3-70b-instruct",        label: "Llama 3.3 70B",        provider: "Meta",      class: "flagship", category: "frontier" },
]

// Cumulative tiers — mirror of the backend. The backend is the source of
// truth and enforces; this is only for shaping the UI.
// catalog: "basic" (Free) | "standard" (Pro: basic + flagship, no premium)
//        | "full" (Premium: everything)
export const TIERS: Record<Tier, { maxModels: number; catalog: "basic" | "standard" | "full"; label: string }> = {
  free:    { maxModels: 3, catalog: "basic",    label: "Free" },
  pro:     { maxModels: 3, catalog: "standard", label: "Pro" },
  premium: { maxModels: 5, catalog: "full",     label: "Premium" },
}

// Default model selection per tier. MUST mirror TIER_DEFAULTS in the backend
// (api/server.js). Gemini 2.5 Pro was swapped out of the Pro/Premium defaults
// for Gemini 3.5 Flash — same provider, flagship-class, but far faster (2.5 Pro
// p50 ~20s / tail ~140s dragged every default comparison). 2.5 Pro is still in
// the catalog and selectable; it's just no longer auto-selected.
// 2026-06-11: Premium defaults are now all Premium-class deep-thinkers, and the
// cheap ones — the five cheapest Premium models, one per provider (~$0.10 per
// compare vs $1.47 for GPT-5.5 Pro alone). The old defaults leaned on flagship
// generals (Sonnet, GPT-4o, Gemini Flash) that aren't Premium-class. The pricey
// premiums (GPT-5.5 Pro, Fable 5, Grok Multi-Agent) stay selectable in catalog.
export const TIER_DEFAULTS: Record<Tier, string[]> = {
  free:    ["anthropic/claude-haiku-4-5", "openai/gpt-4o-mini", "google/gemini-2.5-flash"],
  pro:     ["anthropic/claude-sonnet-4-6", "openai/gpt-4o", "google/gemini-3.5-flash"],
  premium: ["deepseek/deepseek-v4-pro", "minimax/minimax-m2.5", "moonshotai/kimi-k2-thinking",
            "z-ai/glm-5.1", "qwen/qwen3-max-thinking"],
}

export function maxModelsForTier(tier: Tier): number {
  return (TIERS[tier] ?? TIERS.free).maxModels
}

// Model ids the tier may NOT use.
//   Free (catalog="basic")    → flagship + premium are locked
//   Pro  (catalog="standard") → premium-only are locked
//   Premium (catalog="full")  → nothing locked
export function lockedModelIds(tier: Tier, models: ModelEntry[]): Set<string> {
  const t = TIERS[tier] ?? TIERS.free
  if (t.catalog === "full") return new Set()
  if (t.catalog === "standard") {
    return new Set(models.filter(m => m.class === "premium").map(m => m.id))
  }
  // basic
  return new Set(models.filter(m => m.class !== "basic").map(m => m.id))
}

// Parse a comma-separated `models` URL param into a Set.
export function parseModelsParam(raw: string | null): Set<string> | null {
  if (!raw) return null
  const ids = raw.split(",").map(s => s.trim()).filter(Boolean)
  return ids.length > 0 ? new Set(ids) : null
}

// Strip retired models from anything user-facing (picker, /models page).
// Keep them in the underlying catalog for label lookups + cache-hit results,
// but never offer them as a NEW selection.
export function pickableModels(models: ModelEntry[]): ModelEntry[] {
  return models.filter(m => m.status !== "deprecated")
}
