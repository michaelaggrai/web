"use client"

import { useEffect, useState } from "react"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Tier } from "@/lib/models"

// Resolves the current user's tier. Anonymous users (and anyone whose
// profile says 'free') are 'free'. Updates once the Supabase lookup returns.
export function useTier(): Tier {
  const [tier, setTier] = useState<Tier>("free")

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return // anonymous → free
      const { data: profile } = await supabase
        .from("profiles")
        .select("tier")
        .eq("id", data.user.id)
        .single()
      if (profile?.tier === "pro" || profile?.tier === "premium") {
        setTier(profile.tier)
      }
    }).catch(() => { /* stay on free */ })
  }, [])

  return tier
}
