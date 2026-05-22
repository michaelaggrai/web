import { createBrowserClient } from "@supabase/ssr"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// True only when the Supabase env vars are present. Components should guard
// on this so a missing env var degrades gracefully instead of white-screening.
export const isSupabaseConfigured = Boolean(url && key)

// Browser-side Supabase client for use in client components.
export function createClient() {
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured — missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY",
    )
  }
  return createBrowserClient(url, key)
}
