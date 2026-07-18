"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, Settings as SettingsIcon, HelpCircle, MessageSquare, ArrowUpCircle, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Tier = "free" | "pro" | "premium";

const TIER_LABEL: Record<Tier, string> = { free: "Free", pro: "Pro", premium: "Premium" };
const TIER_STYLE: Record<Tier, string> = {
  free:    "border-white/15 bg-white/5 text-white/60",
  pro:     "border-teal-400/30 bg-teal-400/10 text-teal-300",
  premium: "border-amber-300/30 bg-amber-300/10 text-amber-200",
};

type Variant = "sidebar" | "topbar";

/**
 * Account menu — dropdown anchored on either the sidebar (opens upward,
 * trigger = email pill) or the topbar of other pages (opens downward,
 * trigger = circular initials avatar). Single shared menu body so the
 * choices stay consistent everywhere a logged-in user looks.
 *
 * Variants:
 * - `sidebar` — used in /app's AppSidebar. Anonymous users see nothing
 *   (the sidebar bottom has its own "Log in" link).
 * - `topbar` — used in headers of legal/static pages. Anonymous users
 *   see a small "Sign in" link instead of the avatar.
 */
export function AccountMenu({ variant = "sidebar" }: { variant?: Variant }) {
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
        /* swallow — fall through as anonymous */
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
      /* force reload anyway — see comment below */
    }
    // Hard reload so the proxy re-evaluates the (now empty) session and
    // every consumer (useTier, ModelPicker locked-ids, etc.) re-mounts
    // without stale state.
    window.location.assign("/");
  }

  // Auth not configured, or still resolving — render nothing to avoid a
  // flash of the wrong state.
  if (!isSupabaseConfigured || !loaded) return null;

  // Anonymous handling differs per variant. Sidebar keeps its existing
  // null behaviour (the sidebar already has a Log-in link at its
  // bottom). Topbar shows a "Sign in" link so account access is at
  // least one click away from every page.
  if (!email) {
    if (variant === "topbar") {
      return (
        <Link
          href="/signin"
          className="text-xs font-medium text-white/60 hover:text-white transition-colors"
        >
          Sign in
        </Link>
      );
    }
    return null;
  }

  const initial = email.trim().charAt(0).toUpperCase() || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "topbar" ? (
          <button
            type="button"
            aria-label="Account menu"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-teal-400/15 border border-teal-400/30 text-sm font-semibold text-teal-200 hover:bg-teal-400/25 hover:text-teal-100 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400/40"
          >
            {initial}
          </button>
        ) : (
          <button
            type="button"
            aria-label="Account menu"
            className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-left transition hover:bg-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-teal-400/40"
          >
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-teal-400/15 border border-teal-400/30 text-[11px] font-semibold text-teal-200 shrink-0">
              {initial}
            </span>
            <span className="min-w-0 flex-1 flex items-center gap-1.5">
              <span className="text-xs text-white/60 truncate">{email}</span>
              <span
                className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${TIER_STYLE[tier]}`}
                title={`Current plan: ${TIER_LABEL[tier]}`}
              >
                {TIER_LABEL[tier]}
              </span>
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-white/55 shrink-0" aria-hidden="true" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={variant === "topbar" ? "bottom" : "top"}
        align="end"
        sideOffset={6}
        className="w-64 bg-navy/95 backdrop-blur-xl border-white/10 text-white p-1"
      >
        {/* Header — email + tier badge */}
        <div className="px-2 py-2">
          <p className="text-sm font-medium text-white truncate">{email}</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="text-xs text-white/50">on</span>
            <span
              className={`rounded-full border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${TIER_STYLE[tier]}`}
            >
              {TIER_LABEL[tier]}
            </span>
            <span className="text-xs text-white/50">plan</span>
          </div>
        </div>

        <DropdownMenuSeparator className="bg-white/10" />

        {/* Plan actions — only show Upgrade for non-premium */}
        {tier !== "premium" && (
          <DropdownMenuItem asChild className="cursor-pointer focus:bg-white/10">
            <Link
              href="/settings"
              className={`flex items-center gap-2 px-2 py-1.5 text-sm ${tier === "pro" ? "text-amber-200" : "text-white/90"}`}
            >
              <ArrowUpCircle className={`w-4 h-4 ${tier === "pro" ? "text-amber-300" : "text-teal-300"}`} />
              Upgrade plan
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-white/10">
          <Link href="/settings" className="flex items-center gap-2 px-2 py-1.5 text-sm text-white/90">
            <SettingsIcon className="w-4 h-4 text-white/60" />
            Settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-white/10" />

        {/* Help + contact */}
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-white/10">
          <Link href="/help" className="flex items-center gap-2 px-2 py-1.5 text-sm text-white/90">
            <HelpCircle className="w-4 h-4 text-white/60" />
            Help center
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-white/10">
          <Link href="/contact" className="flex items-center gap-2 px-2 py-1.5 text-sm text-white/90">
            <MessageSquare className="w-4 h-4 text-white/60" />
            Contact / report bug
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-white/10" />

        {/* Tiny secondary links. Models lives here because it's a useful
            reference page users want to dip back into (which Pro models do
            I get? What's in Premium?) but it's not a primary action like
            Settings or Upgrade. Privacy + Terms keep their existing slot
            alongside it. */}
        <div className="px-2 py-1.5 flex items-center gap-2 text-[11px] text-white/55">
          <Link href="/models" className="hover:text-white/70 transition-colors">Models</Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-white/70 transition-colors">Privacy</Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-white/70 transition-colors">Terms</Link>
        </div>

        <DropdownMenuSeparator className="bg-white/10" />

        <DropdownMenuItem
          onSelect={signOut}
          disabled={signingOut}
          className="cursor-pointer focus:bg-red-500/10 text-red-300 focus:text-red-200"
        >
          <span className="flex items-center gap-2 px-2 py-1.5 text-sm">
            <LogOut className="w-4 h-4" />
            {signingOut ? "Signing out…" : "Sign out"}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
