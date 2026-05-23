"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Tier = "free" | "pro" | "premium";
const TIER_LABEL: Record<Tier, string> = { free: "Free", pro: "Pro", premium: "Premium" };
const TIER_STYLE: Record<Tier, string> = {
  free: "border-white/15 bg-white/5 text-white/60",
  pro: "border-teal-400/30 bg-teal-400/10 text-teal-300",
  premium: "border-amber-300/30 bg-amber-300/10 text-amber-200",
};

export function AccountMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier>("free");
  const [loaded, setLoaded] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoaded(true);
      return;
    }
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        setEmail(user?.email ?? null);
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("tier")
            .eq("id", user.id)
            .single();
          if (profile?.tier === "pro" || profile?.tier === "premium") {
            setTier(profile.tier);
          }
        }
      } catch {
        /* swallow — anonymous fallthrough */
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  async function signOut() {
    if (!isSupabaseConfigured || signingOut) return;
    setSigningOut(true);
    try {
      await createClient().auth.signOut();
    } catch {
      /* even if Supabase errored, force a reload so cookies clear server-side */
    }
    // Hard reload to the landing page — guarantees the server-side proxy
    // re-evaluates the (now empty) session and every component re-mounts
    // without a stale user. router.push() alone leaves cached client state.
    window.location.assign("/");
  }

  // Auth not configured, or still resolving — render nothing to avoid a flash.
  if (!isSupabaseConfigured || !loaded) return null;

  // Anonymous — nothing to show (header handles sign-up, sidebar handles log-in)
  if (!email) return null;

  // Signed in
  if (email) {
    return (
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 flex items-center gap-1.5">
          <span className="text-xs text-white/40 truncate">
            {email}
          </span>
          <span
            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TIER_STYLE[tier]}`}
            title={`Current plan: ${TIER_LABEL[tier]}`}
          >
            {TIER_LABEL[tier]}
          </span>
        </div>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 transition hover:text-white hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogOut className="w-3.5 h-3.5" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    );
  }

}
