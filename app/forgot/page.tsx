"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

// Request a password-reset email. Supabase sends a recovery link that lands on
// /auth/callback (PKCE code exchange → recovery session) → /reset-password.
// The confirmation is identical whether or not the address has an account, so
// this can't be used to enumerate which emails are registered.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
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
            <Logo height={40} gradientId="forgot-logo" />
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-surface-2 backdrop-blur-xl p-7 shadow-2xl shadow-black/30">
          {sent ? (
            <>
              <h1 className="text-lg font-semibold text-white">Check your email</h1>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">
                If an account exists for <span className="text-white/80">{email}</span>, we&apos;ve sent a link to
                reset your password. It expires in an hour.
              </p>
              <Link
                href="/signin"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-teal-300 hover:text-teal-200"
              >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-white">Reset your password</h1>
              <p className="mt-1 text-sm text-white/55">
                Enter your account email and we&apos;ll send you a reset link.
              </p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-3" aria-label="Reset password">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  aria-label="Email"
                  autoComplete="email"
                  className="w-full rounded-xl border border-white/10 bg-surface-1 px-4 py-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/30 transition-colors"
                />
                {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 px-4 py-3 text-sm font-semibold text-navy transition hover:from-teal-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? "…" : "Send reset link"}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
              <p className="mt-5 text-center text-sm text-white/55">
                Remembered it?{" "}
                <Link href="/signin" className="font-medium text-teal-300 hover:text-teal-200">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
