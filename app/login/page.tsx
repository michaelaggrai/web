"use client";

// Beta password wall (V0/V1 only — removed once we open the site post-V2).
// This page sets the sitewide `auth` cookie that proxy.ts/middleware checks
// before letting anyone past the marketing site. It is INDEPENDENT of
// Supabase auth (which governs which user you are once you're inside) —
// see app/api/login/route.ts for the two-layer note.
//
// AGG-34: restyled from the V0 light-theme placeholder to match the rest
// of the dark-navy site. Mirrors the signin page's gradient + card + form
// styles so the closed-beta experience feels like part of the product
// rather than an unfinished detour.

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // Hard navigation (NOT router.push) on purpose. The App Router caches
        // a prefetched RSC payload for "/" generated while we were still
        // unauthenticated — which resolved to the /login redirect from the
        // proxy gate. A client-side push can serve that stale entry and
        // bounce the user straight back to /login, which is the "had to try
        // the password / refresh a few times" flakiness. A full document load
        // re-requests "/" with the freshly-set `auth` cookie, so the gate
        // sees it on the first try. Keep `loading` true — the page unloads.
        // Honour ?next (the destination the proxy stashed), validated to a
        // same-origin path so it can't be an open redirect.
        const raw = new URLSearchParams(window.location.search).get("next");
        const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
        window.location.assign(next);
        return;
      }
      // 500 = SITE_PASSWORD env var unset on the server. Surface a
      // distinct message so we (or anyone helping us debug) can tell
      // a misconfigured deploy apart from a wrong password.
      if (res.status === 500) {
        setError("Login is temporarily unavailable. Please try again later.");
      } else {
        setError("Incorrect password");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-dvh flex items-center justify-center overflow-hidden bg-navy px-4">
      {/* Match the signin/landing gradient orbs so the page feels of-a-piece. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/15 rounded-full blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px]"
      />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          {/* prefetch={false}: on /login the user is (by definition) not yet
              authed, so prefetching "/" caches the proxy's /login redirect —
              poisoning the router cache. Disable it so nothing stale is held. */}
          <Link href="/" aria-label="aggrai" prefetch={false}>
            <Logo height={36} />
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-surface-2 backdrop-blur-xl p-7 shadow-2xl shadow-black/30">
          <h1 className="text-lg font-semibold text-white">Closed beta</h1>
          <p className="mt-1 text-sm text-white/55">
            Enter the beta password to continue.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-3"
            aria-label="Enter beta password"
          >
            <label htmlFor="beta-password" className="sr-only">
              Beta password
            </label>
            <input
              id="beta-password"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoFocus
              className="w-full rounded-xl border border-white/10 bg-surface-1 px-4 py-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/30 transition-colors"
            />

            {error && (
              <p role="alert" className="text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || password.length === 0}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 px-4 py-3 text-sm font-semibold text-navy transition hover:from-teal-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Checking…" : "Continue"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
