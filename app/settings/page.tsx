"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  User, CreditCard, Globe, Cookie, Download, Trash2, LogOut, ArrowLeft,
  Sparkles, Zap, Crown, AlertTriangle,
} from "lucide-react";
import { HomeLink } from "@/components/home-link";
import { AccountMenu } from "@/components/account-menu";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Tier = "free" | "pro" | "premium";

const TIER_LABEL: Record<Tier, string> = {
  free: "Free",
  pro: "Pro",
  premium: "Premium",
};

// Numeric rank used to decide direction (upgrade vs downgrade) when the
// user picks a different plan in the picker below.
const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, premium: 2 };

type PlanOption = {
  key: Tier;
  name: string;
  price: string;
  period: string;
  tagline: string;
  icon: typeof Sparkles;
  iconColor: string;
};

const PLAN_OPTIONS: PlanOption[] = [
  { key: "free",    name: "Free",    price: "£0",  period: "forever", tagline: "8 basic models, up to 3 per comparison",       icon: Sparkles, iconColor: "text-white/50" },
  { key: "pro",     name: "Pro",     price: "£11", period: "/mo",     tagline: "17 advanced models, up to 3 per comparison",   icon: Zap,      iconColor: "text-teal-300" },
  { key: "premium", name: "Premium", price: "£19", period: "/mo",     tagline: "5 research models, up to 5 per comparison",    icon: Crown,    iconColor: "text-amber-300" },
];

export default function SettingsPage() {
  // Wrap in Suspense so useSearchParams (used for the ?changed=1 banner)
  // doesn't blow up the page render before the params resolve.
  return (
    <Suspense fallback={<div className="min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547]" />}>
      <Settings />
    </Suspense>
  );
}

function Settings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier>("free");
  const [loaded, setLoaded] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Plan-change state. `changingTo` shows the spinner on the target row;
  // `confirmingDowngrade` shows the inline confirmation card for the
  // selected downgrade target (null when no downgrade is being confirmed).
  const [changingTo, setChangingTo] = useState<Tier | null>(null);
  const [confirmingDowngrade, setConfirmingDowngrade] = useState<Tier | null>(null);
  const [planError, setPlanError] = useState("");
  // Post-change banner: set when we land on /settings?changed=1 after a
  // hard reload from a successful plan change. Dismissable.
  const [showChangedBanner, setShowChangedBanner] = useState(searchParams.get("changed") === "1");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // No auth wired — bounce back to landing.
      router.replace("/");
      return;
    }
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        router.replace("/signin?next=/settings");
        return;
      }
      setEmail(user.email ?? null);
      const { data: profile } = await supabase
        .from("profiles")
        .select("tier")
        .eq("id", user.id)
        .single();
      if (profile?.tier === "pro" || profile?.tier === "premium") {
        setTier(profile.tier);
      }
      setLoaded(true);
    })();
    // `router` is a stable reference from next/navigation — no need to
    // include it in deps. This effect should fire exactly once on mount.
  }, []);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await createClient().auth.signOut();
    } catch {
      /* force reload anyway */
    }
    window.location.assign("/");
  }

  // Issue the actual plan-change call. Used by both the upgrade path
  // (direct click) and the downgrade path (post-confirmation). Hard-reloads
  // the page on success so useTier + AccountMenu + ModelPicker locked-ids
  // all pick up the new tier. router.refresh() alone leaves cached state.
  async function changePlan(target: Tier) {
    if (changingTo !== null) return;
    setChangingTo(target);
    setPlanError("");
    try {
      const res = await fetch("/api/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: target }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error ?? "Plan change failed");
      }
      window.location.assign("/settings?changed=1");
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : "Something went wrong");
      setChangingTo(null);
    }
  }

  // Entry point for a row's Upgrade/Downgrade button.
  // - Upgrade direction: go straight through (matches /upgrade page UX).
  // - Downgrade direction: surface an inline confirmation card so the user
  //   has to opt in to losing flagship access / model slots.
  function handlePlanClick(target: Tier) {
    if (target === tier) return;
    if (TIER_RANK[target] < TIER_RANK[tier]) {
      setConfirmingDowngrade(target);
      setPlanError("");
    } else {
      changePlan(target);
    }
  }

  if (!loaded) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547]" />
    );
  }

  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547] px-4 py-12 overflow-hidden">
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to app
          </Link>
          <div className="flex items-center gap-3">
            <HomeLink height={24} gradientId="settings-logo" className="opacity-70 hover:opacity-100 transition-opacity" />
            <AccountMenu variant="topbar" />
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-white tracking-tight mb-1">Settings</h1>
        <p className="text-sm text-white/40 mb-8">Manage your account and preferences.</p>

        {showChangedBanner && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-teal-400/30 bg-teal-400/10 px-4 py-3 flex items-center justify-between gap-3"
          >
            <p className="text-sm text-teal-200">
              Plan updated — you&apos;re now on <strong className="text-white">{TIER_LABEL[tier]}</strong>.
            </p>
            <button
              type="button"
              onClick={() => setShowChangedBanner(false)}
              className="text-teal-300/60 hover:text-teal-200 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Account */}
        <Section icon={User} title="Account">
          <Row label="Email" value={email ?? "—"} />
          <Row
            label="Sign out"
            value=""
            action={
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:text-white hover:border-white/20 transition disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            }
          />
        </Section>

        {/* Plan */}
        <Section icon={CreditCard} title="Plan">
          <p className="text-sm text-white/50 leading-relaxed mb-4">
            Switch any time. Downgrades take effect immediately.{" "}
            <Link
              href="/pricing"
              className="text-teal-300 hover:text-teal-200 underline-offset-2 hover:underline"
            >
              Compare plans →
            </Link>
          </p>

          <ul className="space-y-2" aria-label="Plan options">
            {PLAN_OPTIONS.map(plan => {
              const PlanIcon = plan.icon;
              const isCurrent = plan.key === tier;
              const isUpgrade = TIER_RANK[plan.key] > TIER_RANK[tier];
              const isLoadingThis = changingTo === plan.key;
              const anyChanging = changingTo !== null;

              return (
                <li
                  key={plan.key}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                    isCurrent
                      ? "border-teal-400/40 bg-teal-400/[0.06]"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <PlanIcon className={`w-4 h-4 shrink-0 ${plan.iconColor}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className={`text-sm font-semibold ${isCurrent ? "text-white" : "text-white/85"}`}>
                        {plan.name}
                      </span>
                      <span className="text-xs text-white/50 tabular-nums">
                        <span className="text-white/70">{plan.price}</span>
                        <span className="text-white/35">{plan.period}</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5 leading-snug">{plan.tagline}</p>
                  </div>

                  {isCurrent ? (
                    <span className="shrink-0 rounded-full border border-teal-400/30 bg-teal-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-teal-300">
                      Current
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePlanClick(plan.key)}
                      disabled={anyChanging}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${
                        isUpgrade
                          ? "bg-gradient-to-r from-teal-500 to-teal-400 text-white hover:from-teal-400 hover:to-teal-400 shadow-sm shadow-teal-500/20"
                          : "border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {isLoadingThis ? "…" : isUpgrade ? "Upgrade" : "Downgrade"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Inline confirmation card for downgrades. Renders below the
              plan list so the action and its consequence stay visually
              connected. role="alertdialog" because it's a modal decision
              point even though it's not a popup. */}
          {confirmingDowngrade && (
            <div
              role="alertdialog"
              aria-label="Confirm downgrade"
              className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] p-4"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-amber-100">
                    Downgrade to <strong className="text-white">{TIER_LABEL[confirmingDowngrade]}</strong>?
                  </p>
                  <p className="mt-1 text-xs text-amber-200/80 leading-relaxed">
                    {confirmingDowngrade === "free"
                      ? "You'll lose access to flagship models (GPT-4o, Claude Sonnet, Gemini 2.5 Pro, etc.) and your selection will be reset to the 3 basic models."
                      : confirmingDowngrade === "pro" && tier === "premium"
                        ? "You'll keep access to flagship models but be limited to 3 models per comparison instead of 5."
                        : "Your access will be reduced."}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmingDowngrade(null)}
                  disabled={changingTo !== null}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white transition disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = confirmingDowngrade;
                    setConfirmingDowngrade(null);
                    changePlan(target);
                  }}
                  disabled={changingTo !== null}
                  className="rounded-lg bg-amber-400/20 border border-amber-400/30 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-400/30 transition disabled:opacity-40"
                >
                  {changingTo === confirmingDowngrade ? "Downgrading…" : "Yes, downgrade"}
                </button>
              </div>
            </div>
          )}

          {planError && (
            <div
              role="alert"
              className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              {planError}
            </div>
          )}
        </Section>

        {/* Coming soon — placeholders for v2 GDPR + i18n work */}
        <Section icon={Globe} title="Language" comingSoon>
          <p className="text-sm text-white/40">
            Choose your interface language. Auto-detected from your browser by default.
          </p>
        </Section>

        <Section icon={Cookie} title="Cookies & tracking" comingSoon>
          <p className="text-sm text-white/40">
            Control which cookies and analytics tools we can use.
          </p>
        </Section>

        <Section icon={Download} title="Export my data" comingSoon>
          <p className="text-sm text-white/40">
            Download a copy of your account data and comparison history.
          </p>
        </Section>

        <Section icon={Trash2} title="Delete account" comingSoon danger>
          <p className="text-sm text-white/40">
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </p>
        </Section>

        <p className="mt-10 text-center text-xs text-white/30">
          Need help? <a href="mailto:hello@aggrai.com" className="text-white/50 hover:text-white underline underline-offset-2">hello@aggrai.com</a>
        </p>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
  comingSoon = false,
  danger = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  comingSoon?: boolean;
  danger?: boolean;
}) {
  return (
    <section
      className={`mb-4 rounded-2xl border bg-white/[0.03] p-5 ${
        danger ? "border-red-400/20" : "border-white/10"
      } ${comingSoon ? "opacity-60" : ""}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${danger ? "text-red-300/80" : "text-white/60"}`} />
        <h2 className={`text-sm font-semibold ${danger ? "text-red-200" : "text-white"}`}>
          {title}
        </h2>
        {comingSoon && (
          <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-white/40 border border-white/10 rounded-full px-2 py-0.5">
            Coming soon
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  valueAccent = false,
  action,
}: {
  label: string;
  value: string;
  valueAccent?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0 border-b border-white/5 last:border-0">
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-white/40 mb-0.5">{label}</div>
        {value && (
          <div className={`text-sm truncate ${valueAccent ? "text-teal-300 font-medium" : "text-white/90"}`}>
            {value}
          </div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
