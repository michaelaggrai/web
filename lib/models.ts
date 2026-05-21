import type { ModelEntry } from "@/components/model-picker"

// Fallback catalog used until /api/models responds (or if it fails).
export const FALLBACK_MODELS: ModelEntry[] = [
  { id: "anthropic/claude-sonnet-4-6",              label: "Claude Sonnet 4.6", provider: "Anthropic", default: true },
  { id: "openai/gpt-4o",                            label: "GPT-4o",            provider: "OpenAI",    default: true },
  { id: "google/gemini-2.5-flash",                  label: "Gemini 2.5 Flash",  provider: "Google",    default: true },
  { id: "mistralai/mistral-small-3.2-24b-instruct", label: "Mistral Small",     provider: "Mistral",   default: true },
  { id: "meta-llama/llama-3.1-8b-instruct",         label: "Llama 3.1 8B",      provider: "Meta",      default: true },
]

export const FALLBACK_DEFAULTS = FALLBACK_MODELS.map(m => m.id)

export const MAX_MODELS_PER_TIER = 5

// Parse a comma-separated `models` URL param into a Set, capped at the tier limit.
export function parseModelsParam(raw: string | null): Set<string> | null {
  if (!raw) return null
  const ids = raw.split(",").map(s => s.trim()).filter(Boolean)
  return ids.length > 0 ? new Set(ids.slice(0, MAX_MODELS_PER_TIER)) : null
}
