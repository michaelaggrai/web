"use client"

import { useEffect, useState } from "react"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Tier } from "@/lib/models"

// Resolves the current user's tier. Anonymous users (and anyone whose
// profile says 'free') are 'free'.
//
// Returns `{ tier, resolved }` so callers that need to wait for the
// real tier before acting (e.g. auto-submit on /app?q=...) can gate
// on `resolved`. Without this flag, code reading `tier` immediately
// on mount sees the initial "free" — which is wrong for signed-in
// Pro/Premium users until the Supabase lookup completes. See AGG-37
// finding H10 for the auto-submit failure mode this fixes.
//
// `resolved` flips true once we know the answer is final:
//   - Supabase not configured → true (we'll never resolve, so callers
//     shouldn't block)
//   - User is anonymous → true (tier is "free", settled)
//   - User is signed in → true after the `profiles` row returns
export function useTier(): { tier: Tier; resolved: boolean } {
  const [tier, setTier] = useState<Tier>("free")
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setResolved(true)
      return
    }
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setResolved(true)
        return
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("tier")
        .eq("id", data.user.id)
        .single()
      if (profile?.tier === "pro" || profile?.tier === "premium") {
        setTier(profile.tier)
      }
      setResolved(true)
    }).catch(() => {
      // Stay on free, but still mark resolved so callers don't wait
      // forever on a network blip.
      setResolved(true)
    })
  }, [])

  return { tier, resolved }
}
