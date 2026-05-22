"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { AccountMenu } from "@/components/account-menu";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type RecentItem = { id: string; question: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onNewComparison: () => void;
  recents?: RecentItem[];
  activeId?: string | null;
  onSelectRecent?: (id: string) => void;
};

export function AppSidebar({
  open,
  onClose,
  onNewComparison,
  recents = [],
  activeId = null,
  onSelectRecent,
}: Props) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    createClient().auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          aria-hidden
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col
          border-r border-white/5 bg-navy/90 backdrop-blur-xl transition-transform duration-200
          lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/5">
          <Link href="/app" aria-label="aggrai">
            <Logo height={28} gradientId="sidebar-logo" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden text-white/40 hover:text-white transition"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* New comparison */}
        <div className="p-3">
          <button
            type="button"
            onClick={onNewComparison}
            className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5
              px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <Plus className="h-4 w-4" />
            New comparison
          </button>
        </div>

        {/* Recents */}
        <div className="flex-1 overflow-y-auto px-3">
          <p className="px-1 py-2 text-[11px] font-semibold uppercase tracking-wider text-white/30">
            Recents
          </p>
          {recents.length === 0 ? (
            <p className="px-1 text-xs leading-relaxed text-white/30">
              Your past comparisons will appear here.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {recents.map(r => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onSelectRecent?.(r.id)}
                    className={`w-full truncate rounded-md px-2 py-1.5 text-left text-xs transition ${
                      r.id === activeId
                        ? "bg-white/10 text-white"
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    }`}
                    title={r.question}
                  >
                    {r.question}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upgrade — only for signed-in users */}
        {signedIn && (
          <div className="px-3 pb-2">
            <Link
              href="/upgrade"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-teal-400/20 bg-teal-400/10 px-3 py-2 text-xs font-medium text-teal-300 transition hover:bg-teal-400/15 hover:text-teal-200"
            >
              Upgrade plan
            </Link>
          </div>
        )}

        {/* Account */}
        <div className="border-t border-white/5 p-3">
          <AccountMenu />
        </div>
      </aside>
    </>
  );
}
