"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function AccountMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoaded(true);
      return;
    }
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null))
      .catch(() => {})
      .finally(() => setLoaded(true));
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
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline text-xs text-white/40 max-w-[180px] truncate">
          {email}
        </span>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 transition hover:text-white hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogOut className="w-3.5 h-3.5" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    );
  }

}
