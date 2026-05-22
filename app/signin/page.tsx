"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

export default function SignInPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
          setNotice("Check your email to confirm your account, then sign in.");
          setMode("signin");
          setLoading(false);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push("/app");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-navy via-navy to-[#252547] px-4">
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/15 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px]" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo height={40} gradientId="signin-logo" />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-7 shadow-2xl shadow-black/30">
          <h1 className="text-lg font-semibold text-white">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-white/40">
            {mode === "signup"
              ? "Sign up to start comparing AI models."
              : "Sign in to continue."}
          </p>

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

            {error && <p className="text-sm text-red-300">{error}</p>}
            {notice && <p className="text-sm text-teal-300">{notice}</p>}

            <button
              type="submit"
              disabled={loading || !email || password.length < 6}
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
