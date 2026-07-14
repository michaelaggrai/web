"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  User, CreditCard, Globe, Cookie, Download, Trash2, LogOut, ArrowLeft,
  AlertTriangle, Calendar, Receipt, RotateCcw,
} from "lucide-react";
import { HomeLink } from "@/components/home-link";
import { AccountMenu } from "@/components/account-menu";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  PLANS, planByKey, priceFor, renewalDate, formatDate,
  TIER_RANK, TIER_LABEL, type Cycle, type Tier,
} from "@/lib/plans";
import {
  getDemoBilling, startDemoBilling, cancelDemoBilling, resumeDemoBilling,
  type DemoBilling,
} from "@/lib/billing-demo";
import { ConsentControl, ExportData, DeleteAccount } from "@/components/privacy-data";

export default function SettingsPage() {
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

  // Mock subscription record (cycle / renewal / cancellation). No billing
  // backend yet — see lib/billing-demo.
  const [billing, setBilling] = useState<DemoBilling | null>(null);

  // Plan-change state (downgrades go through /api/upgrade instantly; upgrades
  // route to /checkout).
  const [changingTo, setChangingTo] = useState<Tier | null>(null);
  const [confirmingDowngrade, setConfirmingDowngrade] = useState<Tier | null>(null);
  const [planError, setPlanError] = useState("");
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [showChangedBanner, setShowChangedBanner] = useState(searchParams.get("changed") === "1");

  useEffect(() => {
    if (!isSupabaseConfigured) {
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
      const { data: profile } = await supabase.from("profiles").select("tier").eq("id", user.id).single();
      const t: Tier = profile?.tier === "pro" || profile?.tier === "premium" ? profile.tier : "free";
      setTier(t);
      // Ensure a paying user always has a coherent (mock) subscription record so
      // the management UI renders consistently — seed one if they reached a paid
      // tier without going through the new checkout (admin/legacy).
      if (t !== "free") {
        let b = getDemoBilling();
        if (!b || b.tier !== t) {
          startDemoBilling(t, b?.cycle ?? "monthly");
          b = getDemoBilling();
        }
        setBilling(b);
      } else {
        setBilling(null);
      }
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Instant tier change — used for downgrades only (no payment needed).
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

  function handlePlanClick(target: Tier) {
    if (target === tier) return;
    if (TIER_RANK[target] > TIER_RANK[tier]) {
      // Upgrade → paid checkout flow.
      router.push(`/checkout?plan=${target}&cycle=${billing?.cycle ?? "monthly"}`);
    } else {
      // Downgrade between paid tiers → inline confirm, then instant.
      setConfirmingDowngrade(target);
      setPlanError("");
    }
  }

  function doCancel() {
    cancelDemoBilling();
    setBilling(getDemoBilling());
    setConfirmingCancel(false);
  }
  function doResume() {
    resumeDemoBilling();
    setBilling(getDemoBilling());
  }

  if (!loaded) {
    return <div className="min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547]" />;
  }

  const plan = planByKey(tier);
  const cycle: Cycle = billing?.cycle ?? "monthly";
  const price = priceFor(plan, cycle);
  // Paid tiers always have a seeded billing record by the time these sections
  // render (see the mount effect), so the 0 fallback never actually shows —
  // it just keeps Date.now() off the render path (lint: no impure calls in render).
  const startedAt = billing?.startedAt ?? 0;
  const renews = renewalDate(startedAt, cycle);
  const canceled = !!billing?.canceledAt;

  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547] px-4 py-12 overflow-hidden">
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to app
          </Link>
          <div className="flex items-center gap-3">
            <HomeLink height={24} gradientId="settings-logo" className="opacity-70 hover:opacity-100 transition-opacity" />
            <AccountMenu variant="topbar" />
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-white tracking-tight mb-1">Settings</h1>
        <p className="text-sm text-white/40 mb-8">Manage your account, subscription and preferences.</p>

        {showChangedBanner && (
          <div role="status" className="mb-6 rounded-xl border border-teal-400/30 bg-teal-400/10 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-teal-200">
              Plan updated — you&apos;re now on <strong className="text-white">{TIER_LABEL[tier]}</strong>.
            </p>
            <button type="button" onClick={() => setShowChangedBanner(false)} className="text-teal-300/60 hover:text-teal-200 text-xs">
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
              <button type="button" onClick={signOut} disabled={signingOut} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:text-white hover:border-white/20 transition disabled:opacity-50">
                <LogOut className="w-3.5 h-3.5" />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            }
          />
        </Section>

        {/* Subscription — paid tiers only */}
        {tier !== "free" && (
          <Section icon={CreditCard} title="Subscription">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <plan.icon className={`w-5 h-5 ${plan.iconColor}`} aria-hidden="true" />
                  <div>
                    <div className="text-sm font-semibold text-white">aggrai {plan.name}</div>
                    <div className="text-xs text-white/50 tabular-nums">
                      {price.amountLabel}{price.unit} · <span className="capitalize">{cycle}</span>
                    </div>
                  </div>
                </div>
                {canceled ? (
                  <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                    Canceling
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full border border-teal-400/30 bg-teal-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-teal-300">
                    Active
                  </span>
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-white/40 shrink-0" aria-hidden="true" />
                  <span className="text-white/50">
                    {canceled ? "Ends" : "Renews"}{" "}
                    <span className="text-white/80">{formatDate(renews)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="w-4 h-4 text-white/40 shrink-0" aria-hidden="true" />
                  <span className="text-white/50">
                    Visa <span className="text-white/80 tabular-nums">•••• 4242</span>
                  </span>
                </div>
              </div>

              {canceled && (
                <p className="mt-3 rounded-lg bg-amber-400/[0.08] border border-amber-400/20 px-3 py-2 text-xs text-amber-200/90">
                  Your subscription is set to cancel. You keep {plan.name} access until {formatDate(renews)}, then move to Free.
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled
                  title="Editing your payment method ships with Stripe"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/40 cursor-not-allowed"
                >
                  Update payment method
                </button>
                {canceled ? (
                  <button type="button" onClick={doResume} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-400/15 border border-teal-400/30 px-3 py-1.5 text-xs font-medium text-teal-200 hover:bg-teal-400/25 transition">
                    <RotateCcw className="w-3.5 h-3.5" />
                    Resume subscription
                  </button>
                ) : (
                  <button type="button" onClick={() => setConfirmingCancel(true)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 hover:text-white hover:border-white/20 transition">
                    Cancel subscription
                  </button>
                )}
              </div>

              {confirmingCancel && (
                <div role="alertdialog" aria-label="Confirm cancellation" className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="text-xs text-amber-100/90 leading-relaxed">
                      Cancel your {plan.name} subscription? You&apos;ll keep access until <strong className="text-white">{formatDate(renews)}</strong>, then drop to Free. No further charges.
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 justify-end">
                    <button type="button" onClick={() => setConfirmingCancel(false)} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white transition">
                      Keep subscription
                    </button>
                    <button type="button" onClick={doCancel} className="rounded-lg bg-amber-400/20 border border-amber-400/30 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-400/30 transition">
                      Yes, cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Change plan */}
        <Section icon={CreditCard} title={tier === "free" ? "Plan" : "Change plan"}>
          <p className="text-sm text-white/50 leading-relaxed mb-4">
            {tier === "free"
              ? "You're on the Free plan — no active subscription."
              : "Switch tiers any time. Upgrades go through checkout; downgrades take effect immediately."}{" "}
            <Link href="/pricing" className="text-teal-300 hover:text-teal-200 underline-offset-2 hover:underline">
              Compare plans →
            </Link>
          </p>

          <ul className="space-y-2" aria-label="Plan options">
            {PLANS.map((p) => {
              const isCurrent = p.key === tier;
              const isUpgrade = TIER_RANK[p.key] > TIER_RANK[tier];
              const isLoadingThis = changingTo === p.key;
              const anyChanging = changingTo !== null;
              const rowPrice = priceFor(p, "monthly");

              return (
                <li key={p.key} className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${isCurrent ? "border-teal-400/40 bg-teal-400/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
                  <p.icon className={`w-4 h-4 shrink-0 ${p.iconColor}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className={`text-sm font-semibold ${isCurrent ? "text-white" : "text-white/85"}`}>{p.name}</span>
                      <span className="text-xs text-white/50 tabular-nums">
                        <span className="text-white/70">{rowPrice.amountLabel}</span>
                        <span className="text-white/35">{p.key === "free" ? " forever" : "/mo"}</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5 leading-snug">{p.tagline}</p>
                  </div>

                  {isCurrent ? (
                    <span className="shrink-0 rounded-full border border-teal-400/30 bg-teal-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-teal-300">
                      Current
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePlanClick(p.key)}
                      disabled={anyChanging}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${
                        isUpgrade
                          ? p.key === "premium"
                            ? "bg-gradient-to-r from-amber-400 to-amber-300 text-navy hover:from-amber-300 hover:to-amber-200 shadow-sm shadow-amber-500/20"
                            : "bg-gradient-to-r from-teal-500 to-teal-400 text-white hover:from-teal-400 hover:to-teal-400 shadow-sm shadow-teal-500/20"
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

          {confirmingDowngrade && (
            <div role="alertdialog" aria-label="Confirm downgrade" className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] p-4">
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
                <button type="button" onClick={() => setConfirmingDowngrade(null)} disabled={changingTo !== null} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white transition disabled:opacity-40">
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
            <div role="alert" className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {planError}
            </div>
          )}
        </Section>

        {/* Billing history — paid tiers only */}
        {tier !== "free" && (
          <Section icon={Receipt} title="Billing history">
            <ul className="divide-y divide-white/5">
              <InvoiceRow date={formatDate(new Date(startedAt))} desc={`${plan.name} · ${cycle}`} amount={`${price.amountLabel}`} />
            </ul>
            <p className="mt-3 text-xs text-white/40">
              {canceled
                ? `No further payments — subscription ends ${formatDate(renews)}.`
                : `Next payment ${formatDate(renews)} · ${price.amountLabel}${price.unit}.`}
            </p>
          </Section>
        )}

        {/* Coming soon — v2 placeholders */}
        <Section icon={Globe} title="Language" comingSoon>
          <p className="text-sm text-white/40">Choose your interface language. Auto-detected from your browser by default.</p>
        </Section>
        <Section icon={Cookie} title="Cookies & tracking">
          <ConsentControl />
        </Section>
        <Section icon={Download} title="Export my data">
          <ExportData />
        </Section>
        <Section icon={Trash2} title="Delete account" danger>
          <DeleteAccount />
        </Section>

        <p className="mt-10 text-center text-xs text-white/30">
          Need help? <Link href="/contact" className="text-white/50 hover:text-white underline underline-offset-2">Contact us</Link>
        </p>
      </div>
    </div>
  );
}

function InvoiceRow({ date, desc, amount }: { date: string; desc: string; amount: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
      <div className="min-w-0">
        <div className="text-sm text-white/85">{date}</div>
        <div className="text-[11px] text-white/40 capitalize">{desc}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="rounded-full border border-teal-400/20 bg-teal-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-300">Paid</span>
        <span className="text-sm text-white/80 tabular-nums">{amount}</span>
        <button type="button" disabled title="Invoice PDFs ship with Stripe" className="text-white/30 cursor-not-allowed" aria-label="Download invoice">
          <Download className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
}

function Section({
  icon: Icon, title, children, comingSoon = false, danger = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  comingSoon?: boolean;
  danger?: boolean;
}) {
  return (
    <section className={`mb-4 rounded-2xl border bg-white/[0.03] p-5 ${danger ? "border-red-400/20" : "border-white/10"} ${comingSoon ? "opacity-60" : ""}`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${danger ? "text-red-300/80" : "text-white/60"}`} />
        <h2 className={`text-sm font-semibold ${danger ? "text-red-200" : "text-white"}`}>{title}</h2>
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
  label, value, valueAccent = false, action,
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
        {value && <div className={`text-sm truncate ${valueAccent ? "text-teal-300 font-medium" : "text-white/90"}`}>{value}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
