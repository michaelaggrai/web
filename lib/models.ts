export type ModelClass = "basic" | "flagship"
export type ModelCategory = "fast" | "reasoning" | "coding" | "creative" | "multimodal" | "frontier"
export type Tier = "free" | "pro" | "premium"

export type ModelEntry = {
  id: string
  label: string
  provider: string
  class: ModelClass
  /** Optional for backwards compat with payloads from older backend builds. */
  category?: ModelCategory
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
  { id: "openai/gpt-5.4-mini",                      label: "GPT-5.4 Mini",         provider: "OpenAI",    class: "flagship", category: "fast" },
  { id: "google/gemini-3.1-flash-lite",             label: "Gemini 3.1 Flash Lite",provider: "Google",    class: "flagship", category: "fast" },

  // Creative
  { id: "anthropic/claude-sonnet-4-6",              label: "Claude Sonnet 4.6",    provider: "Anthropic", class: "flagship", category: "creative" },
  { id: "openai/gpt-4o",                            label: "GPT-4o",               provider: "OpenAI",    class: "flagship", category: "creative" },
  { id: "openai/gpt-5.4",                           label: "GPT-5.4",              provider: "OpenAI",    class: "flagship", category: "creative" },
  { id: "openai/gpt-5.5",                           label: "GPT-5.5",              provider: "OpenAI",    class: "flagship", category: "creative" },
  { id: "mistralai/mistral-large-2512",             label: "Mistral Large",        provider: "Mistral",   class: "flagship", category: "creative" },

  // Reasoning
  { id: "openai/gpt-5.4-pro",                       label: "GPT-5.4 Pro",          provider: "OpenAI",    class: "flagship", category: "reasoning" },
  { id: "openai/gpt-5.5-pro",                       label: "GPT-5.5 Pro",          provider: "OpenAI",    class: "flagship", category: "reasoning" },
  { id: "anthropic/claude-opus-4.7",                label: "Claude Opus 4.7",      provider: "Anthropic", class: "flagship", category: "reasoning" },
  { id: "deepseek/deepseek-v4-pro",                 label: "DeepSeek v4 Pro",      provider: "DeepSeek",  class: "flagship", category: "reasoning" },
  { id: "qwen/qwen3-max-thinking",                  label: "Qwen3 Max Thinking",   provider: "Qwen",      class: "flagship", category: "reasoning" },

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

  // Frontier
  { id: "anthropic/claude-opus-4.7-fast",           label: "Claude Opus 4.7 Fast", provider: "Anthropic", class: "flagship", category: "frontier" },
  { id: "x-ai/grok-4.20",                           label: "Grok 4.20",            provider: "xAI",       class: "flagship", category: "frontier" },
  { id: "x-ai/grok-4.20-multi-agent",               label: "Grok 4.20 Multi-Agent",provider: "xAI",       class: "flagship", category: "frontier" },
  { id: "meta-llama/llama-3.3-70b-instruct",        label: "Llama 3.3 70B",        provider: "Meta",      class: "flagship", category: "frontier" },
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
            "anthropic/claude-opus-4.7", "x-ai/grok-4.20"],
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
