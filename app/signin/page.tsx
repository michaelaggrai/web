"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Zap, Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

// Compact plan picker shown only in signup mode. After successful signup,
// the chosen paid plan is auto-applied via /api/upgrade. Free skips it.
type PlanId = "free" | "pro" | "premium";
type Plan = {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  icon: typeof Sparkles;
  iconColor: string;
  // Single line shown on the card itself — the "at a glance" tagline.
  tagline: string;
  // Shown below the picker when this plan is selected.
  detail: string;
};
const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "£0",
    period: "forever",
    icon: Sparkles,
    iconColor: "text-white/50",
    tagline: "3 basic models",
    detail: "Free forever — Claude Haiku, GPT-4o mini, Gemini 2.5 Flash. Up to 3 models per comparison. No card required.",
  },
  {
    id: "pro",
    name: "Pro",
    price: "£9",
    period: "/mo",
    icon: Zap,
    iconColor: "text-teal-300",
    tagline: "Flagship models",
    detail: "Full catalog including GPT-4o, Claude Sonnet 4.6, Gemini 2.5 Pro. Up to 3 models per comparison.",
  },
  {
    id: "premium",
    name: "Premium",
    price: "£19",
    period: "/mo",
    icon: Crown,
    iconColor: "text-amber-300",
    tagline: "5 models at once",
    detail: "Full catalog plus higher comparison limit — pit up to 5 flagship models against each other in one query.",
  },
];
function isPlanId(v: string | null): v is PlanId {
  return v === "free" || v === "pro" || v === "premium";
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}

function SignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/app";
  const reason = searchParams.get("reason");
  const [mode, setMode] = useState<"signin" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  // Plan picker: defaults to URL ?plan= if valid, otherwise Free.
  const initialPlan = searchParams.get("plan");
  const [plan, setPlan] = useState<PlanId>(isPlanId(initialPlan) ? initialPlan : "free");

  // sessionStorage key for "user picked Pro/Premium on signup but Supabase is
  // making them confirm email first — apply the upgrade after they finally
  // sign in." Survives the confirm-link round-trip (per-tab, ephemeral).
  const PENDING_UPGRADE_KEY = "aggrai_pending_upgrade_plan";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup" && !agreed) {
      setError("Please agree to the Terms and Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          // Email confirmation is enabled — no session until they confirm.
          // Stash the plan choice so it sticks through confirm-then-signin.
          // Read back in the signin branch below and applied via /api/upgrade
          // once they're actually signed in.
          if (plan !== "free") {
            try { sessionStorage.setItem(PENDING_UPGRADE_KEY, plan); } catch { /* private mode */ }
          }
          setNotice("Check your email to confirm your account, then sign in.");
          setMode("signin");
          setLoading(false);
          return;
        }
        // Auto-apply paid plan if the user selected one on the signup form
        // AND we got an immediate session (email confirmation OFF).
        if (plan !== "free") {
          const ok = await applyUpgrade(plan);
          if (!ok) {
            router.push("/upgrade");
            router.refresh();
            return;
          }
          // Hard reload so useTier + AccountMenu + ModelPicker locked-IDs
          // all see the new tier. router.push leaves the React tree intact
          // and they stay stale. See AGG-36 HIGH finding.
          window.location.assign("/app?upgraded=1");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Check for a pending upgrade left over from a prior signup +
        // email-confirmation round-trip.
        let pending: string | null = null;
        try { pending = sessionStorage.getItem(PENDING_UPGRADE_KEY); } catch { /* ignore */ }
        if (pending === "pro" || pending === "premium") {
          try { sessionStorage.removeItem(PENDING_UPGRADE_KEY); } catch { /* ignore */ }
          const ok = await applyUpgrade(pending);
          if (!ok) {
            router.push("/upgrade");
            router.refresh();
            return;
          }
          window.location.assign("/app?upgraded=1");
          return;
        }
      }
      router.push(next);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  // Fires /api/upgrade and returns whether it succeeded.
  async function applyUpgrade(tier: "pro" | "premium"): Promise<boolean> {
    try {
      const res = await fetch("/api/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-navy via-navy to-[#252547] px-4">
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/15 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px]" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Link href="/" aria-label="aggrai home">
            <Logo height={40} gradientId="signin-logo" />
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-7 shadow-2xl shadow-black/30">
          <h1 className="text-lg font-semibold text-white">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-white/40">
            {reason === "upgrade"
              ? "Create an account to unlock Pro and Premium plans."
              : mode === "signup"
                ? "Sign up to start comparing AI models."
                : "Sign in to continue."}
          </p>

          {mode === "signup" && (() => {
            const selected = PLANS.find(p => p.id === plan)!;
            return (
              <div className="mt-5">
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                    Choose a plan
                  </p>
                  <Link
                    href="/pricing"
                    target="_blank"
                    className="text-[11px] text-teal-300/80 hover:text-teal-200 underline-offset-2 hover:underline"
                  >
                    Compare plans →
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {PLANS.map(p => {
                    const Icon = p.icon;
                    const active = plan === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlan(p.id)}
                        aria-pressed={active}
                        title={p.detail}
                        className={`relative flex flex-col items-center rounded-xl border px-2 py-3 text-center transition-all ${
                          active
                            ? "border-teal-400/60 bg-teal-400/[0.08]"
                            : "border-white/10 bg-white/[0.03] hover:border-white/20"
                        }`}
                      >
                        <Icon className={`w-4 h-4 mb-1 ${p.iconColor}`} />
                        <div className={`text-xs font-semibold ${active ? "text-white" : "text-white/70"}`}>
                          {p.name}
                        </div>
                        <div className={`text-[11px] mt-0.5 ${active ? "text-white/80" : "text-white/50"}`}>
                          <span className="font-medium">{p.price}</span>
                          <span className="text-white/40">{p.period}</span>
                        </div>
                        <div className={`mt-1.5 text-[10px] leading-tight ${active ? "text-teal-200/90" : "text-white/40"}`}>
                          {p.tagline}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {/* Detail line for the currently selected plan */}
                <p className="mt-3 text-[11px] text-white/50 leading-relaxed min-h-[2.4em]">
                  {selected.detail}
                  {plan !== "free" && (
                    <span className="text-white/30"> Applied right after signup.</span>
                  )}
                </p>
              </div>
            );
          })()}

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors"
            />

            {mode === "signup" && (
              <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-white/[0.06] accent-teal-400 cursor-pointer"
                />
                <span className="text-xs text-white/60 leading-relaxed">
                  I agree to aggrai&apos;s{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    className="text-teal-300 underline-offset-2 hover:underline"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="text-teal-300 underline-offset-2 hover:underline"
                  >
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
            )}

            {error && <p className="text-sm text-red-300">{error}</p>}
            {notice && <p className="text-sm text-teal-300">{notice}</p>}

            <button
              type="submit"
              disabled={
                loading ||
                !email ||
                password.length < 6 ||
                (mode === "signup" && !agreed)
              }
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 px-4 py-3 text-sm font-medium text-white transition hover:from-teal-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "…" : mode === "signup" ? "Create account" : "Sign in"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-white/40">
            {mode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setError("");
                setNotice("");
                setAgreed(false);
              }}
              className="font-medium text-teal-300 hover:text-teal-200"
            >
              {mode === "signup" ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
