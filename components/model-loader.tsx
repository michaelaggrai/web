"use client"

import { ProviderLogo } from "@/components/brand-icons"

// Provider derived from the model-id prefix — covers every model from a
// given provider, not just a hardcoded list.
const PROVIDER_BY_PREFIX: Record<string, string> = {
  "anthropic": "Anthropic",
  "openai": "OpenAI",
  "google": "Google",
  "mistralai": "Mistral",
  "meta-llama": "Meta",
}

const BRAND_COLORS: Record<string, string> = {
  Anthropic: "#D97757",
  OpenAI: "#10A37F",
  Google: "#4285F4",
  Mistral: "#FF7000",
  Meta: "#0467DF",
}

function providerOf(modelId: string): string {
  return PROVIDER_BY_PREFIX[modelId.split("/")[0]] ?? "Anthropic"
}

export function ModelLoader({ modelId, size = 28 }: { modelId: string; size?: number }) {
  const provider = providerOf(modelId)
  const color = BRAND_COLORS[provider] ?? "#A0A0A0"
  // Google's logo is multicolor; don't override its fills via currentColor
  const isMulticolor = provider === "Google"
  return (
    <div className="brand-pulse" style={{ color: isMulticolor ? undefined : color }}>
      <ProviderLogo provider={provider} style={{ width: size, height: size }} />
    </div>
  )
}
