"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readConsent, writeConsent } from "@/lib/consent";
import { createClient } from "@/lib/supabase/client";

// --- Cookies & tracking: view + change the analytics-consent choice ----------
export function ConsentControl() {
  const [value, setValue] = useState<"accepted" | "rejected" | null>(null);
  useEffect(() => setValue(readConsent()), []);

  const set = (v: "accepted" | "rejected") => {
    writeConsent(v);
    setValue(v);
    // Toggling analytics on/off changes whether Sentry initialises — reload so
    // the change takes effect immediately (see instrumentation-client.ts).
    window.location.reload();
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/50">
        Essential cookies (keeping you signed in) are always on. Error-monitoring is optional.
      </p>
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
        <div>
          <div className="text-sm font-medium text-white/85">Error monitoring</div>
          <div className="text-xs text-white/40">
            {value === "accepted" ? "On — helps us catch crashes" : value === "rejected" ? "Off" : "Not set"}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => set("rejected")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${value === "rejected" ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-white/60 hover:bg-white/5"}`}
          >
            Off
          </button>
          <button
            type="button"
            onClick={() => set("accepted")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${value === "accepted" ? "bg-teal-400 text-neutral-950" : "border border-white/10 text-white/60 hover:bg-white/5"}`}
          >
            On
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Export my data ----------------------------------------------------------
export function ExportData() {
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-sm text-white/50">
        Download a JSON copy of your account data — profile, questions, per-model results, and saved conversations.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          // GET with auth cookies; Content-Disposition triggers the download.
          window.location.href = "/api/me/export";
          setTimeout(() => setBusy(false), 3000);
        }}
        className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-50"
      >
        {busy ? "Preparing…" : "Download my data"}
      </button>
    </div>
  );
}

// --- Delete account (irreversible; type-email-to-confirm) --------------------
export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Deletion failed");
      }
      try { await createClient().auth.signOut(); } catch { /* session already gone */ }
      router.push("/?deleted=1");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deletion failed");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/50">
        Permanently delete your account and all associated data. This cannot be undone.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-400/30 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/10"
      >
        Delete my account
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-red-400/20 bg-neutral-900 p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-red-200">Delete your account?</h3>
            <p className="mt-2 text-sm text-white/60">
              This permanently erases your profile, comparison history, saved conversations, and usage
              records. It cannot be undone. Type your account email to confirm.
            </p>
            <input
              type="email"
              autoComplete="off"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="you@example.com"
              className="mt-4 w-full rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
            />
            {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => { setOpen(false); setConfirm(""); setError(null); }}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || confirm.trim().length === 0}
                onClick={run}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
              >
                {busy ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
