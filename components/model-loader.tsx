"use client"

import { ProviderLogo, providerOf } from "@/components/brand-icons"

const BRAND_COLORS: Record<string, string> = {
  Anthropic: "#D97757",
  OpenAI: "#10A37F",
  Google: "#4285F4",
  Mistral: "#FF7000",
  Meta: "#0467DF",
}

export function ModelLoader({ modelId, size = 28, label }: { modelId: string; size?: number; label?: string }) {
  const provider = providerOf(modelId)
  const color = BRAND_COLORS[provider] ?? "#A0A0A0"
  // Google's logo is multicolor; don't override its fills via currentColor
  const isMulticolor = provider === "Google"
  return (
    <div
      className="brand-pulse"
      style={{ color: isMulticolor ? undefined : color }}
      role="status"
      aria-label={label ? `Loading ${label} answer` : `Loading ${provider} answer`}
    >
      <ProviderLogo provider={provider} style={{ width: size, height: size }} aria-hidden="true" />
    </div>
  )
}
