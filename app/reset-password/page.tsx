"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

// Set a new password. Reached only after the recovery link completes the
// /auth/callback code exchange, which leaves a (recovery) session in cookies.
// We verify that session exists; without it there's nothing to update, so we
// point the user back to request a fresh link.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await createClient().auth.getUser();
      if (!active) return;
      setHasSession(Boolean(data.user));
      setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      router.push("/app");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't update your password. Please try again.");
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
            <Logo height={40} gradientId="reset-logo" />
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-surface-2 backdrop-blur-xl p-7 shadow-2xl shadow-black/30">
          <h1 className="text-lg font-semibold text-white">Set a new password</h1>

          {checking ? (
            <p className="mt-4 text-sm text-white/50">Checking your link…</p>
          ) : !hasSession ? (
            <>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">
                This reset link is invalid or has expired. Request a new one to continue.
              </p>
              <Link
                href="/forgot"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-teal-300 hover:text-teal-200"
              >
                Request a new link <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-3" aria-label="Set new password">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                aria-label="New password"
                autoComplete="new-password"
                className="w-full rounded-xl border border-white/10 bg-surface-1 px-4 py-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/30 transition-colors"
              />
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                aria-label="Confirm new password"
                autoComplete="new-password"
                className="w-full rounded-xl border border-white/10 bg-surface-1 px-4 py-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/30 transition-colors"
              />
              {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
              <button
                type="submit"
                disabled={loading || password.length < 6 || confirm.length < 6}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 px-4 py-3 text-sm font-semibold text-navy transition hover:from-teal-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "…" : "Update password"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
