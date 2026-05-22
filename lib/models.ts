export type ModelClass = "basic" | "flagship"
export type Tier = "free" | "pro" | "premium"

export type ModelEntry = {
  id: string
  label: string
  provider: string
  class: ModelClass
}

// Fallback catalog used until /api/models responds (or if it fails).
export const FALLBACK_MODELS: ModelEntry[] = [
  { id: "anthropic/claude-sonnet-4-6",              label: "Claude Sonnet 4.6", provider: "Anthropic", class: "flagship" },
  { id: "anthropic/claude-haiku-4-5",               label: "Claude Haiku 4.5",  provider: "Anthropic", class: "basic" },
  { id: "openai/gpt-4o",                            label: "GPT-4o",            provider: "OpenAI",    class: "flagship" },
  { id: "openai/gpt-4o-mini",                       label: "GPT-4o Mini",       provider: "OpenAI",    class: "basic" },
  { id: "google/gemini-2.5-flash",                  label: "Gemini 2.5 Flash",  provider: "Google",    class: "basic" },
  { id: "google/gemini-2.5-pro",                    label: "Gemini 2.5 Pro",    provider: "Google",    class: "flagship" },
  { id: "mistralai/mistral-small-3.2-24b-instruct", label: "Mistral Small",     provider: "Mistral",   class: "basic" },
  { id: "mistralai/mistral-large-2411",             label: "Mistral Large",     provider: "Mistral",   class: "flagship" },
  { id: "meta-llama/llama-3.1-8b-instruct",         label: "Llama 3.1 8B",      provider: "Meta",      class: "basic" },
  { id: "meta-llama/llama-3.3-70b-instruct",        label: "Llama 3.3 70B",     provider: "Meta",      class: "flagship" },
]

// Cumulative tiers — mirror of the backend. The backend is the source of
// truth and enforces; this is only for shaping the UI.
export const TIERS: Record<Tier, { maxModels: number; catalog: "basic" | "full"; label: string }> = {
  free:    { maxModels: 3, catalog: "basic", label: "Free" },
  pro:     { maxModels: 3, catalog: "full",  label: "Pro" },
  premium: { maxModels: 5, catalog: "full",  label: "Premium" },
}

// Default model selection per tier.
export const TIER_DEFAULTS: Record<Tier, string[]> = {
  free:    ["anthropic/claude-haiku-4-5", "openai/gpt-4o-mini", "google/gemini-2.5-flash"],
  pro:     ["anthropic/claude-sonnet-4-6", "openai/gpt-4o", "google/gemini-2.5-pro"],
  premium: ["anthropic/claude-sonnet-4-6", "openai/gpt-4o", "google/gemini-2.5-pro",
            "mistralai/mistral-large-2411", "meta-llama/llama-3.3-70b-instruct"],
}

export function maxModelsForTier(tier: Tier): number {
  return (TIERS[tier] ?? TIERS.free).maxModels
}

// Model ids the tier may NOT use (flagship models for a basic-catalog tier).
export function lockedModelIds(tier: Tier, models: ModelEntry[]): Set<string> {
  const t = TIERS[tier] ?? TIERS.free
  if (t.catalog === "full") return new Set()
  return new Set(models.filter(m => m.class !== "basic").map(m => m.id))
}

// Parse a comma-separated `models` URL param into a Set.
export function parseModelsParam(raw: string | null): Set<string> | null {
  if (!raw) return null
  const ids = raw.split(",").map(s => s.trim()).filter(Boolean)
  return ids.length > 0 ? new Set(ids) : null
}
