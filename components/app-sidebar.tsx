"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { Plus, X, Settings, BarChart3 } from "lucide-react";
import { Logo } from "@/components/logo";
import { AccountMenu } from "@/components/account-menu";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useTier } from "@/lib/use-tier";

export type RecentItem = { id: string; question: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onNewComparison: () => void;
  recents?: RecentItem[];
  activeId?: string | null;
  onSelectRecent?: (id: string) => void;
  /** Element to restore focus to when the mobile drawer closes (typically
   *  the menu button that opened it). */
  triggerRef?: RefObject<HTMLButtonElement | null>;
};

export function AppSidebar({
  open,
  onClose,
  onNewComparison,
  recents = [],
  activeId = null,
  onSelectRecent,
  triggerRef,
}: Props) {
  const [signedIn, setSignedIn] = useState(false);
  const { tier } = useTier();
  const canUpgrade = signedIn && tier !== "premium";

  // Track viewport so we only apply dialog semantics on mobile. On
  // lg+ the sidebar is a static panel — not a dialog, not modal,
  // never aria-hidden.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Where we want focus to land when the drawer opens (mobile). Close
  // button is a safe target — visible only on mobile, always in the
  // tab order, gets the user oriented inside the dialog.
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    createClient().auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  // Focus + Escape only kick in when the drawer is actually open AND
  // we're on mobile (where it functions as a dialog). On desktop these
  // are no-ops.
  useEffect(() => {
    if (!open || !isMobile) return;
    // Defer focus to next tick so the transform animation has started
    // and the close button is actually onscreen.
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, isMobile, onClose]);

  // Restore focus to the trigger when the drawer transitions closed.
  // Tracks previous `open` so we only fire on the open→close edge.
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current && !open && isMobile) {
      triggerRef?.current?.focus();
    }
    prevOpen.current = open;
  }, [open, isMobile, triggerRef]);

  // Mobile-only flags. On desktop, none of these apply — sidebar is
  // just part of the page layout.
  const isHiddenDrawer = isMobile && !open;
  const isModalOverlay = isMobile && open;

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
        id="app-sidebar"
        role={isMobile ? "dialog" : undefined}
        aria-modal={isModalOverlay || undefined}
        aria-label={isMobile ? "Main menu" : undefined}
        aria-hidden={isHiddenDrawer || undefined}
        /* `inert` blocks focus + pointer events when the drawer is
            translated off-screen on mobile so SR users can't tab into
            hidden content. React 19 accepts inert as a boolean prop. */
        inert={isHiddenDrawer || undefined}
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-64 shrink-0 flex-col
          border-r border-white/5 bg-navy/90 backdrop-blur-xl transition-transform duration-200
          lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Brand
            AGG-38 #2: safe-area-inset-top so the sidebar header doesn't
            sit under the notch on iOS landscape (sidebar is fixed at
            every viewport since AGG-38 #1 body-scroll refactor). */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/5 pt-[env(safe-area-inset-top)]">
          {signedIn ? (
            // Signed-in users are on /app, so a Link back to /app is a
            // no-op. Tap → reset to a new comparison (and the helper
            // already closes the sidebar on mobile).
            <button
              type="button"
              onClick={onNewComparison}
              aria-label="New comparison"
              className="inline-flex items-center"
            >
              <Logo height={28} gradientId="sidebar-logo" />
            </button>
          ) : (
            <Link href="/" aria-label="aggrai" className="inline-flex items-center">
              <Logo height={28} gradientId="sidebar-logo" />
            </Link>
          )}
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="lg:hidden inline-flex items-center justify-center p-2 -mr-1.5 rounded-lg text-white/55 hover:text-white hover:bg-white/5 transition"
            aria-label="Close menu"
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
          <p className="px-1 py-2 text-[11px] font-semibold uppercase tracking-wider text-white/55">
            Recents
          </p>
          {recents.length === 0 ? (
            <p className="px-1 text-xs leading-relaxed text-white/55">
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

        {/* Bottom section
            AGG-38 #2: safe-area-inset-bottom so the Sign-out / settings
            buttons clear the iOS home indicator on devices without a
            physical home button. */}
        {/* P3 #16: anonymous users use the header's Log in / Sign up pair —
            no duplicate sidebar login. Footer only renders when signed in. */}
        {signedIn && (
          <div className="border-t border-white/5 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
              {canUpgrade && (
                <Link
                  href="/upgrade"
                  className={`flex w-full items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    tier === "pro"
                      ? "border-amber-300/30 bg-amber-300/10 text-amber-200 hover:bg-amber-300/15 hover:text-amber-100"
                      : "border-teal-400/20 bg-teal-400/10 text-teal-300 hover:bg-teal-400/15 hover:text-teal-200"
                  }`}
                >
                  Upgrade plan
                </Link>
              )}
              {/* AGG-27: analytics needs a first-class entry point — it was only
                  reachable via a Settings section, which nobody would find. */}
              <Link
                href="/settings/analytics"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/60 transition hover:bg-white/5 hover:text-white"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Analytics
              </Link>
              <Link
                href="/settings"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/60 transition hover:bg-white/5 hover:text-white"
              >
                <Settings className="h-3.5 w-3.5" />
                Settings
              </Link>
              <AccountMenu />
          </div>
        )}
      </aside>
    </>
  );
}
