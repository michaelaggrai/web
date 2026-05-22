"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function AccountMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    createClient().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    if (!isSupabaseConfigured) return;
    await createClient().auth.signOut();
    router.push("/signin");
    router.refresh();
  }

  // Auth not configured — render nothing rather than crash the page.
  if (!isSupabaseConfigured) return null;

  return (
    <div className="flex items-center gap-3">
      {email && (
        <span className="hidden sm:inline text-xs text-white/40 max-w-[180px] truncate">
          {email}
        </span>
      )}
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
