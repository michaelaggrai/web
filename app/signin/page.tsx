"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Zap, Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getAnonId } from "@/lib/anon-id";
import { Logo } from "@/components/logo";

// Compact plan picker shown only in signup mode. After successful signup, a
// chosen paid plan routes the new user into /checkout to pay; Free goes
// straight into the app. (Paid plans are no longer granted for free.)
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
    tagline: "8 basic models",
    detail: "Free forever — Claude Haiku 4.5, GPT-4o Mini, GPT-5.4 Mini, Gemini 2.5 Flash, Gemini 3.1 Flash Lite, Mistral Small, Llama 3.1 8B, DeepSeek v3.2. Up to 3 models per comparison. No card required.",
  },
  {
    id: "pro",
    name: "Pro",
    price: "£11",
    period: "/mo",
    icon: Zap,
    iconColor: "text-teal-300",
    tagline: "16 advanced models",
    detail: "Everything in Free plus every flagship model — Claude Opus 4.8 Fast, Sonnet 4.6, GPT-4o, GPT-5.5, Gemini Pro, Grok 4.20, Llama 3.3 70B, Codex, Devstral. Up to 3 models per comparison.",
  },
  {
    id: "premium",
    name: "Premium",
    price: "£19",
    period: "/mo",
    icon: Crown,
    iconColor: "text-amber-300",
    tagline: "9 research models",
    detail: "Everything in Pro plus 9 reasoning specialists — Claude Opus 4.8, GPT-5.5 Pro, Kimi K2 Thinking, DeepSeek v4 Pro, Nemotron 3 Ultra, and more. For deep research. Up to 5 models per comparison.",
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
        // AGG-21: carry this browser's anon_id into the signup metadata so
        // handle_new_user() can stamp it onto profiles → profile_events. That's
        // what stitches the funnel: events.anon_id → questions.anon_id →
        // profile_events.anon_id, i.e. "this visitor landed, asked, then
        // converted". Null without analytics consent (getAnonId returns null),
        // and the trigger validates + ignores anything malformed.
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { anon_id: getAnonId() } },
        });
        if (error) throw error;
        if (!data.session) {
          // Email confirmation is enabled — no session until they confirm.
          // Stash the plan choice so it sticks through confirm-then-signin.
          // Read back in the signin branch below and sent to /checkout once
          // they're actually signed in.
          if (plan !== "free") {
            try { sessionStorage.setItem(PENDING_UPGRADE_KEY, plan); } catch { /* private mode */ }
          }
          setNotice("Check your email to confirm your account, then sign in.");
          setMode("signin");
          setLoading(false);
          return;
        }
        // Paid plan chosen + immediate session (email confirmation OFF) → send
        // them to checkout to pay. Free falls through into the app. The session
        // is already set, so /checkout resolves their account without re-login.
        if (plan !== "free") {
          router.push(`/checkout?plan=${plan}&cycle=monthly`);
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
          router.push(`/checkout?plan=${pending}&cycle=monthly`);
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

  return (
    <div className="relative min-h-dvh flex items-center justify-center overflow-hidden bg-navy px-4">
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/15 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px]" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Link href="/" aria-label="aggrai">
            <Logo height={40} gradientId="signin-logo" />
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-surface-2 backdrop-blur-xl p-7 shadow-2xl shadow-black/30">
          <h1 className="text-lg font-semibold text-white">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-white/55">
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
                  <p className="text-xs font-medium uppercase tracking-wider text-white/55">
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
                            : "border-white/10 bg-surface-1 hover:border-white/20"
                        }`}
                      >
                        <Icon className={`w-4 h-4 mb-1 ${p.iconColor}`} />
                        <div className={`text-xs font-semibold ${active ? "text-white" : "text-white/70"}`}>
                          {p.name}
                        </div>
                        <div className={`text-[11px] mt-0.5 ${active ? "text-white/80" : "text-white/50"}`}>
                          <span className="font-medium">{p.price}</span>
                          <span className="text-white/55">{p.period}</span>
                        </div>
                        <div className={`mt-1.5 text-[11px] leading-tight ${active ? "text-teal-200/90" : "text-white/55"}`}>
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
                    <span className="text-white/55"> Applied right after signup.</span>
                  )}
                </p>
              </div>
            );
          })()}

          <form onSubmit={handleSubmit} className="mt-6 space-y-3" aria-label={mode === "signup" ? "Create account" : "Sign in"}>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              aria-label="Email"
              aria-invalid={error ? true : undefined}
              autoComplete="email"
              className="w-full rounded-xl border border-white/10 bg-surface-1 px-4 py-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/30 transition-colors"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              aria-label="Password"
              aria-invalid={error ? true : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="w-full rounded-xl border border-white/10 bg-surface-1 px-4 py-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/30 transition-colors"
            />

            {mode === "signup" && (
              <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-surface-2 accent-teal-400 cursor-pointer"
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

            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            {notice && <p role="status" className="text-sm text-teal-300">{notice}</p>}

            <button
              type="submit"
              disabled={
                loading ||
                !email ||
                password.length < 6 ||
                (mode === "signup" && !agreed)
              }
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 px-4 py-3 text-sm font-semibold text-navy transition hover:from-teal-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "…" : mode === "signup" ? "Create account" : "Sign in"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-white/55">
            {mode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setError("");
                setNotice("");
                setAgreed(false);
              }}
              aria-label={mode === "signup" ? "Switch to sign in" : "Switch to create account"}
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
