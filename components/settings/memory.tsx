"use client";

import { useEffect, useState } from "react";

// Phase 5c (AGG-29): the Memory settings surface. Reads/writes /api/me/memory
// (RLS-scoped to the signed-in user). Explicit preferences + the two toggles
// are persisted together by "Save"; "Clear learned facts" is an immediate,
// separate action. The backend injects all of this into conversation prompts
// via buildMemoryNote() — see api/server.js.

const LENGTH_OPTS = [
  { value: "", label: "No preference" },
  { value: "concise", label: "Concise" },
  { value: "balanced", label: "Balanced" },
  { value: "detailed", label: "Detailed" },
];
const TONE_OPTS = [
  { value: "", label: "No preference" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "friendly", label: "Friendly" },
  { value: "direct", label: "Direct" },
];

interface MemoryData {
  enabled: boolean;
  implicit_enabled: boolean;
  explicit: Record<string, string>;
  implicit: { facts?: string[] };
}

export function MemorySettings() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [implicitEnabled, setImplicitEnabled] = useState(false);
  const [length, setLength] = useState("");
  const [tone, setTone] = useState("");
  const [expertise, setExpertise] = useState("");
  const [topics, setTopics] = useState("");
  const [custom, setCustom] = useState("");
  const [facts, setFacts] = useState<string[]>([]);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me/memory", { cache: "no-store" });
        if (res.ok) {
          const d = (await res.json()) as MemoryData;
          setEnabled(d.enabled);
          setImplicitEnabled(d.implicit_enabled);
          const ex = d.explicit ?? {};
          setLength(typeof ex.length === "string" ? ex.length : "");
          setTone(typeof ex.tone === "string" ? ex.tone : "");
          setExpertise(typeof ex.expertise === "string" ? ex.expertise : "");
          setTopics(typeof ex.topics === "string" ? ex.topics : "");
          setCustom(typeof ex.custom === "string" ? ex.custom : "");
          setFacts(Array.isArray(d.implicit?.facts) ? d.implicit.facts : []);
        }
      } catch {
        /* leave defaults */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Any edit marks the panel dirty and clears the transient "Saved" flag.
  function mark<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setDirty(true); setSaved(false); };
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/me/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          implicit_enabled: implicitEnabled,
          explicit: { length, tone, expertise, topics, custom },
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Save failed");
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function clearFacts() {
    if (clearing) return;
    setClearing(true);
    setError(null);
    try {
      const res = await fetch("/api/me/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearImplicit: true }),
      });
      if (!res.ok) throw new Error("Could not clear");
      setFacts([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clear");
    } finally {
      setClearing(false);
    }
  }

  if (loading) {
    return <div className="h-24 rounded-xl border border-white/10 bg-white/[0.02] animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      {/* Master switch */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-white/85">Use memory</div>
          <div className="text-xs text-white/40">
            Tailors answers as you continue a conversation. Your first question in a thread stays neutral.
          </div>
        </div>
        <Switch checked={enabled} onChange={mark(setEnabled)} label="Use memory" />
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <Field label="Response length">
            <PillGroup options={LENGTH_OPTS} value={length} onChange={mark(setLength)} />
          </Field>
          <Field label="Tone">
            <PillGroup options={TONE_OPTS} value={tone} onChange={mark(setTone)} />
          </Field>
          <Field label="Your background" hint="Lets aggrai pitch answers at the right level.">
            <input
              type="text"
              value={expertise}
              maxLength={300}
              onChange={(e) => mark(setExpertise)(e.target.value)}
              placeholder="e.g. Senior backend engineer, comfortable with TypeScript"
              className="w-full rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
            />
          </Field>
          <Field label="Recurring interests">
            <input
              type="text"
              value={topics}
              maxLength={300}
              onChange={(e) => mark(setTopics)(e.target.value)}
              placeholder="e.g. AI infrastructure, startups, climate tech"
              className="w-full rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
            />
          </Field>
          <Field label="Anything else aggrai should know">
            <textarea
              value={custom}
              maxLength={500}
              rows={3}
              onChange={(e) => mark(setCustom)(e.target.value)}
              placeholder="Free-form. e.g. Prefer answers with code examples; based in the UK."
              className="w-full resize-y rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
            />
          </Field>
        </div>
      )}

      {/* Implicit / auto-learned */}
      <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-white/85">Learn from my conversations</div>
            <div className="text-xs text-white/40">
              Off by default. When on, aggrai periodically notes durable preferences from your chats — you can review and clear them below.
            </div>
          </div>
          <Switch checked={implicitEnabled} onChange={mark(setImplicitEnabled)} label="Learn from my conversations" />
        </div>

        {facts.length > 0 && (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-white/40">
              Learned about you
            </div>
            <ul className="space-y-1.5">
              {facts.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm text-white/70">
                  <span className="text-teal-300/70">•</span>
                  <span className="min-w-0">{f}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={clearFacts}
              disabled={clearing}
              className="mt-3 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 disabled:opacity-50"
            >
              {clearing ? "Clearing…" : "Clear learned facts"}
            </button>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-teal-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save preferences"}
        </button>
        {saved && <span className="text-xs text-teal-300">Saved</span>}
        {dirty && !saving && <span className="text-xs text-white/40">Unsaved changes</span>}
        {error && <span className="text-xs text-red-300">{error}</span>}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs uppercase tracking-wider text-white/40">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-white/30">{hint}</p>}
    </div>
  );
}

function PillGroup({
  options, value, onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value || "none"}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              active
                ? "border-teal-400/40 bg-teal-400/15 text-teal-200"
                : "border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/5 hover:text-white/80"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Switch({
  checked, onChange, label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-teal-400" : "bg-white/15"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
