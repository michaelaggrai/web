"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function AccountMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();

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
    if (!isSupabaseConfigured) return;
    await createClient().auth.signOut();
    router.push("/signin");
    router.refresh();
  }

  // Auth not configured, or still resolving — render nothing to avoid a flash.
  if (!isSupabaseConfigured || !loaded) return null;

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
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 transition hover:text-white hover:border-white/20"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    );
  }

  // Anonymous — invite to sign up (not mandatory)
  return (
    <Link
      href="/signin"
      className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-xs font-medium text-white/70 transition hover:text-white hover:border-white/20"
    >
      Sign up
    </Link>
  );
}
