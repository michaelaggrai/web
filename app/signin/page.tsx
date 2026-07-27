"use client";

import { useState, type FC } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Zap, Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getAnonId, getShareRef, dropAnonLinkCookie } from "@/lib/anon-id";
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
    tagline: "10+ fast models",
    detail: "Free forever — Claude Haiku 4.5, GPT-4o Mini, GPT-5.4 Mini, Gemini 2.5 Flash, Gemini 3.1 Flash Lite, Mistral Small, Llama 3.1 8B, DeepSeek v3.2. Up to 3 models per comparison. No card required.",
  },
  {
    id: "pro",
    name: "Pro",
    price: "£11",
    period: "/mo",
    icon: Zap,
    iconColor: "text-teal-300",
    tagline: "Every flagship model",
    detail: "Everything in Free plus every flagship model — Claude Sonnet 5, Opus 4.8 Fast, GPT-4o, GPT-5.6, Gemini Pro, Grok 4.5, Kimi K3, Llama 3.3 70B, Codex, Devstral. Up to 3 models per comparison.",
  },
  {
    id: "premium",
    name: "Premium",
    price: "£19",
    period: "/mo",
    icon: Crown,
    iconColor: "text-amber-300",
    tagline: "Reasoning specialists",
    detail: "Everything in Pro plus deep-research reasoning specialists — Claude Opus 4.8, Claude Fable 5, GPT-5.6 Pro, Kimi K2 Thinking, DeepSeek v4 Pro, Nemotron 3 Ultra, and more. For deep research. Up to 5 models per comparison.",
  },
];
function isPlanId(v: string | null): v is PlanId {
  return v === "free" || v === "pro" || v === "premium";
}

// Social sign-in providers. Provider-agnostic on purpose: Supabase routes every
// one through the same signInWithOAuth() call and the same /auth/callback code
// exchange, so adding Apple/Microsoft/etc. later is one entry here + the
// provider's console setup — no new code path.
type OAuthProvider = "google" | "github";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56 0-.27-.01-1-.02-1.96-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.25 5.69.42.36.8 1.08.8 2.18 0 1.58-.01 2.85-.01 3.24 0 .31.21.68.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}

const OAUTH_PROVIDERS: { id: OAuthProvider; label: string; Icon: FC<{ className?: string }> }[] = [
  { id: "google", label: "Google", Icon: GoogleIcon },
  { id: "github", label: "GitHub", Icon: GitHubIcon },
];

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
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

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
        //
        // AGG-44: `ref` carries the first-touch acquisition source (the
        // aggrai_ref cookie set by /share, e.g. "share:<id>") into
        // profiles.ref → profile_events.properties.ref, so a shared link can be
        // credited with the signup — and the later upgrade — directly, rather
        // than inferred by matching anon_id. Same consent gate.
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { anon_id: getAnonId(), ref: getShareRef() } },
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

  // Social sign-in. The same call signs in an existing user or creates a new
  // one, so it's offered in both modes. anon_id lives in localStorage (not a
  // cookie), so drop a short-lived, consent-gated cookie the /auth/callback
  // route can read to keep the acquisition funnel intact for social signups.
  async function handleOAuth(provider: OAuthProvider) {
    setError("");
    setNotice("");
    setOauthLoading(provider);
    try {
      // Consent-gated funnel breadcrumb the server-side callback reads (see lib).
      dropAnonLinkCookie();
      const params = new URLSearchParams({ next });
      if (plan !== "free") params.set("plan", plan);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback?${params.toString()}` },
      });
      if (error) throw error;
      // Success → browser is navigating to the provider; keep the spinner on.
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not start sign-in. Please try again.");
      setOauthLoading(null);
    }
  }

  return (
    <div className="relative min-h-dvh flex items-center justify-center overflow-hidden bg-navy px-4">
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] glow-teal-15" />
      <div className="pointer-events-none absolute bottom-20 right-1/4 w-[400px] h-[400px] glow-teal-10" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Link href="/" aria-label="aggrai">
            <Logo height={40} gradientId="signin-logo" />
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-surface-2 p-7 shadow-2xl shadow-black/30">
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

          {/* Social sign-in — same signInWithOAuth call whether the user is new
              or returning; Supabase creates or matches the account. */}
          <div className="mt-6 space-y-2">
            {OAUTH_PROVIDERS.map((p) => {
              const busy = oauthLoading === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleOAuth(p.id)}
                  disabled={loading || oauthLoading !== null}
                  aria-label={`Continue with ${p.label}`}
                  className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-surface-1 px-4 py-3 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/[0.04] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <p.Icon className="w-[18px] h-[18px] shrink-0" />
                  <span>{busy ? "Redirecting…" : `Continue with ${p.label}`}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-white/45">
            By continuing, you agree to aggrai&apos;s{" "}
            <Link href="/terms" target="_blank" className="text-teal-300/80 underline-offset-2 hover:underline">Terms</Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="text-teal-300/80 underline-offset-2 hover:underline">Privacy Policy</Link>.
          </p>

          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] uppercase tracking-wider text-white/40">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3" aria-label={mode === "signup" ? "Create account" : "Sign in"}>
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

            {mode === "signin" && (
              <div className="-mt-1 text-right">
                <Link href="/forgot" className="text-xs text-teal-300/80 hover:text-teal-200">
                  Forgot password?
                </Link>
              </div>
            )}

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
