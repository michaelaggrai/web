"use client";
import React, { Suspense } from "react";
import { useState, useEffect, useRef } from "react";
import * as Sentry from "@sentry/nextjs";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, Layers, BarChart3, Menu, ChevronDown, Trophy, MessageCircle } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ModelLoader } from "@/components/model-loader";
import { ModelPicker } from "@/components/model-picker";
import { AppSidebar } from "@/components/app-sidebar";
import { useTier } from "@/lib/use-tier";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { ProviderLogo, providerOf } from "@/components/brand-icons";
import { FALLBACK_MODELS, TIER_DEFAULTS, maxModelsForTier, lockedModelIds, parseModelsParam, type ModelEntry } from "@/lib/models";

type Scores = {
  comprehension: number;
  thought_provoking: number;
  nuance: number;
  clarity: number;
};

type Answer = {
  model: string;
  answer: string;
  runtime_ms: number;
  tokens: number;
  cost_usd: number | null;
  scores?: Scores | null;
};

type Contribution = { model: string; pct: number };

type Result =
  | { type: "product"; answer: string; question: string; cached?: boolean }
  | {
      type: "compare";
      summary: string;
      answers: Answer[];
      question: string;
      contributions?: Contribution[] | null;
      failed?: { model: string; error: string }[];
      cached?: boolean;
    };

let _modelLabels: Record<string, string> = Object.fromEntries(FALLBACK_MODELS.map(m => [m.id, m.label]));
function setModelLabels(catalog: ModelEntry[]) {
  _modelLabels = Object.fromEntries(catalog.map(m => [m.id, m.label]));
}
function modelLabel(id: string) {
  return _modelLabels[id] ?? id.split("/").pop() ?? id;
}

// Longest patterns first so "Claude Sonnet 4.6" wins over "Claude"
const MODEL_NAME_PATTERN = /\b(Claude Sonnet 4\.6|Gemini 2\.5 Flash|Llama 3\.1 8B|Mistral Small|GPT-4o|ChatGPT|Claude|Gemini|Mistral|Llama|OpenAI|Anthropic)\b/g;

function ModelChip({ name }: { name: string }) {
  return <span className="text-teal-300 font-medium">{name}</span>;
}

function highlightString(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(MODEL_NAME_PATTERN.source, "g");
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<ModelChip key={`${m.index}-${m[0]}`} name={m[0]} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function highlightNode(node: React.ReactNode, keyPrefix = ""): React.ReactNode {
  if (typeof node === "string") return highlightString(node);
  if (Array.isArray(node)) return node.map((n, i) => <React.Fragment key={`${keyPrefix}-${i}`}>{highlightNode(n, `${keyPrefix}-${i}`)}</React.Fragment>);
  return node;
}

const MARKDOWN_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => <p>{highlightNode(children, "p")}</p>,
  li: ({ children }: { children?: React.ReactNode }) => <li>{highlightNode(children, "li")}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong>{highlightNode(children, "s")}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em>{highlightNode(children, "e")}</em>,
};

function LoadingBlock({ title, gradientId, className = "" }: { title: string; gradientId: string; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-xl flex flex-col items-center justify-center gap-2 min-h-[110px] p-4 ${className}`}>
      <Logo height={40} spinning symbolOnly gradientId={gradientId} />
      <p className="text-xs text-white/40">{title}</p>
    </div>
  );
}

function ModelLoadingBlock({ modelId }: { modelId: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-xl flex flex-col items-center justify-center gap-2 min-h-[110px] p-4">
      <ModelLoader modelId={modelId} size={36} />
      <p className="text-xs text-white/40">{modelLabel(modelId)}</p>
    </div>
  );
}

const SCORE_KEYS: { key: keyof Scores; label: string }[] = [
  { key: "comprehension",     label: "Comprehension" },
  { key: "thought_provoking", label: "Thought-provoking" },
  { key: "nuance",            label: "Nuance" },
  { key: "clarity",           label: "Clarity" },
];

// Map each scored answer's 4 dimensions (each 0-5) to a single 0-100
// quality score. Simple unweighted average × 20. This is a stand-in until
// AGG-7's weighted 5-dimension Quality Score lands; the layout is already
// shaped to plug that in (one big number + sub-metric breakdown).
function overallScore(s: Scores): number {
  return Math.round(((s.comprehension + s.thought_provoking + s.nuance + s.clarity) / 4) * 20);
}

// The summariser produces markdown with a single section:
//   ## Best answer    (a full rewritten answer using all models, weighted
//                      by their scores — see backend summariser prompt)
// We split it out so we can render the Best Answer with a stronger visual
// hierarchy inside the Summary card. If the section header is missing
// (e.g. legacy cached responses with the old multi-section format), the
// whole `summary` string is rendered as-is.
function splitSummary(summary: string): { best: string | null; rest: string } {
  const match = summary.match(/^[ \t]*##\s*Best\s+answer\s*\n([\s\S]*?)(?=^\s*##\s|\Z)/im);
  if (!match) return { best: null, rest: summary };
  const best = match[1].trim();
  const rest = summary.replace(match[0], "").trim();
  return { best, rest };
}

// Highlights the single highest-scoring model alongside a CTA to continue
// a follow-up with just that model. The synthesised "Best answer" is the
// product; this block points at which model the user might want to keep
// chatting with afterwards.
//
// onContinue is wired by the page: clicking the CTA sets the model picker
// to only this model and scrolls to the question input. When V2's
// persistent conversation feature lands, this is the entry point for it.
function WinnerBlock({
  answers,
  onContinue,
}: {
  answers: Answer[];
  onContinue?: (modelId: string) => void;
}) {
  const scored = answers.filter((a): a is Answer & { scores: Scores } => !!a.scores);
  if (scored.length === 0) return null;

  const ranked = [...scored]
    .map(a => ({ ...a, overall: overallScore(a.scores) }))
    .sort((a, b) => b.overall - a.overall);
  const winner = ranked[0];
  const runnerUp = ranked[1];

  const wonOn = SCORE_KEYS.filter(({ key }) => {
    const top = scored.reduce((p, c) => (c.scores[key] > p.scores[key] ? c : p));
    return top.model === winner.model;
  }).map(k => k.label);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-xl p-5 shadow-lg">
      <div className="flex items-start gap-4">
        <div className="shrink-0 rounded-xl bg-amber-300/10 border border-amber-300/20 p-2.5">
          <Trophy className="w-4 h-4 text-amber-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1">
            Strongest single answer
          </p>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <ProviderLogo provider={providerOf(winner.model)} className="w-4 h-4 self-center shrink-0" />
            <span className="text-base sm:text-lg font-semibold text-white truncate">
              {modelLabel(winner.model)}
            </span>
            <span className="text-xl sm:text-2xl font-bold text-teal-300 tabular-nums">
              {winner.overall}
            </span>
            <span className="text-xs text-white/40">/100</span>
            {runnerUp && (
              <span className="text-xs text-white/40">
                · {modelLabel(runnerUp.model)} {runnerUp.overall}
              </span>
            )}
          </div>
          {wonOn.length > 0 && (
            <p className="mt-1 text-xs text-white/50">
              Strongest on {wonOn.join(", ").toLowerCase()}.
            </p>
          )}
        </div>
        {onContinue && (
          <button
            type="button"
            onClick={() => onContinue(winner.model)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-teal-500 to-teal-400 px-3 py-2 text-xs font-medium text-white hover:from-teal-400 hover:to-teal-400 transition shadow-sm shadow-teal-500/20"
            aria-label={`Continue with ${modelLabel(winner.model)}`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Continue with {modelLabel(winner.model).split(" ")[0]}
          </button>
        )}
      </div>
    </div>
  );
}

// Stacked bars at the top of the Summary card showing how much each
// model's content influenced the rewritten Best answer below. Source is
// the summariser's self-reported attribution; values sum to ~100.
//
// Rendered above the Best answer so the reader knows *who's behind this*
// before they read the synthesis — sets context, not a footnote.
function ContributionsTop({ contributions }: { contributions: Contribution[] }) {
  if (contributions.length === 0) return null;
  const sorted = [...contributions].sort((a, b) => b.pct - a.pct);
  return (
    <div className="mb-5 pb-4 border-b border-white/10">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-3">
        Where the summary came from
      </p>
      <div className="space-y-2">
        {sorted.map(({ model, pct }) => (
          <div key={model} className="flex items-center gap-2 text-xs">
            <ProviderLogo provider={providerOf(model)} className="w-3.5 h-3.5 shrink-0" />
            <span className="text-white/70 w-32 truncate shrink-0">{modelLabel(model)}</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-400/80 to-teal-300/80"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
            <span className="text-white/60 tabular-nums w-10 text-right shrink-0">{pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Per-model overall quality score + the 4 quality sub-metrics that compose
// it (Comprehension, Thought-provoking, Nuance, Clarity — Haiku-judged).
// Only the sub-metrics that ROLL UP into the headline 0-100 belong here;
// runtime/readability/length are descriptive but not part of the quality
// score, so they're shown on the per-answer card headers instead.
function ScoresAndMetrics({ answers }: { answers: Answer[] }) {
  const scored = answers.filter((a): a is Answer & { scores: Scores } => !!a.scores);
  if (scored.length === 0) return null;

  const enriched = scored.map(a => ({ ...a, overall: overallScore(a.scores) }));
  const topByDim = SCORE_KEYS.map(({ key }) => ({
    key,
    model: enriched.reduce((p, c) => (c.scores[key] > p.scores[key] ? c : p)).model,
  }));
  const maxOverall = Math.max(...enriched.map(a => a.overall));
  const ranked = [...enriched].sort((a, b) => b.overall - a.overall);

  const Bar = ({ pct, accent }: { pct: number; accent?: boolean }) => (
    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
      <div
        className={`h-full rounded-full ${accent ? "bg-gradient-to-r from-teal-400 to-teal-300" : "bg-white/30"}`}
        style={{ width: `${Math.max(2, Math.min(100, pct * 100))}%` }}
      />
    </div>
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-6 shadow-xl">
      <div className="mb-5 flex items-center gap-2">
        <BarChart3 className="w-3.5 h-3.5 text-teal-300" />
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-300/80">
          Quality scores
        </p>
        <span className="text-[10px] text-white/30">judged by Haiku · 0–100 overall</span>
      </div>

      <div className="space-y-5">
        {ranked.map(a => (
          <div key={a.model} className="space-y-2">
            {/* Per-model header: name + big overall score */}
            <div className="flex items-baseline justify-between gap-2 border-b border-white/5 pb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <ProviderLogo provider={providerOf(a.model)} className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs font-medium text-white/90 truncate">{modelLabel(a.model)}</span>
              </div>
              <div className="flex items-baseline gap-1 shrink-0">
                <span className={`text-base font-semibold tabular-nums ${a.overall === maxOverall ? "text-teal-300" : "text-white/80"}`}>
                  {a.overall}
                </span>
                <span className="text-[10px] text-white/40">/100</span>
              </div>
            </div>

            {/* The 4 sub-metrics that roll up into the overall score */}
            <div className="grid grid-cols-4 gap-2">
              {SCORE_KEYS.map(({ key, label }) => {
                const isTop = topByDim.find(t => t.key === key)?.model === a.model;
                return (
                  <div key={key} className="min-w-0">
                    <div className="text-[10px] text-white/40 truncate">{label}</div>
                    <div className={`text-xs mb-1 tabular-nums ${isTop ? "text-teal-200" : "text-white/70"}`}>
                      {a.scores[key].toFixed(1)}
                    </div>
                    <Bar pct={a.scores[key] / 5} accent={isTop} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}

function Home() {
  const searchParams = useSearchParams();
  const modelsParam = parseModelsParam(searchParams.get("models"));
  const tier = useTier();
  const [question, setQuestion] = useState(searchParams.get("q") ?? "");
  const [allModels, setAllModels] = useState<ModelEntry[]>(FALLBACK_MODELS);
  const [selected, setSelected] = useState<Set<string>>(modelsParam ?? new Set(TIER_DEFAULTS.free));
  const [loading, setLoading] = useState(false);
  const [intentHint, setIntentHint] = useState<"compare" | "product" | "direct" | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Session-scoped recents: kept in sessionStorage so they survive page
  // reloads within the same tab but vanish when the tab closes. Persistent
  // cross-session memory is a V2 feature; this is the bridge that already
  // makes the sidebar's Recents area useful today.
  type SessionRecent = {
    id: string;
    question: string;
    models: string[];
    result: Result;
    timestamp: number;
  };
  const SESSION_RECENTS_KEY = "aggrai_session_recents_v1";
  const MAX_RECENTS = 20;
  const [sessionRecents, setSessionRecents] = useState<SessionRecent[]>([]);
  const [activeRecentId, setActiveRecentId] = useState<string | null>(null);

  // Hydrate from sessionStorage on first mount only
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_RECENTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSessionRecents(parsed);
      }
    } catch { /* corrupt storage — start empty */ }
  }, []);

  // Persist any change back to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_RECENTS_KEY, JSON.stringify(sessionRecents));
    } catch { /* quota / private-mode — degrade silently */ }
  }, [sessionRecents]);

  function pushRecent(question: string, models: Set<string>, result: Result) {
    const id = `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    setSessionRecents(prev => {
      // Dedupe by question text — if the same question was just asked again,
      // replace its entry rather than stack a duplicate.
      const filtered = prev.filter(r => r.question.trim().toLowerCase() !== question.trim().toLowerCase());
      return [{ id, question, models: [...models], result, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENTS);
    });
    setActiveRecentId(id);
  }

  function selectRecent(id: string) {
    const found = sessionRecents.find(r => r.id === id);
    if (!found) return;
    setActiveRecentId(id);
    setQuestion(found.question);
    setResult(found.result);
    setSelected(new Set(found.models));
    setError("");
    setIntentHint(null);
    setSidebarOpen(false);
  }
  const [showUpgradedBanner, setShowUpgradedBanner] = useState(searchParams.get("upgraded") === "1");
  const [signedIn, setSignedIn] = useState(false);
  // Per-model raw answers are collapsed by default. User clicks a card header
  // to expand. Reset whenever a fresh result lands so a new question starts
  // with everything collapsed again.
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());
  useEffect(() => { setExpandedAnswers(new Set()); }, [result]);
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);

  // "Continue with X" — narrow the model picker to just that model, clear
  // the visible result, and scroll the question input into view focused.
  // Until V2's persistent conversation feature lands, this is a "soft"
  // continuation: the user's next question goes to that single model with
  // no carried context, which is still much closer to the "pick a model
  // and chat with it" mental model than today's restart-from-scratch flow.
  function handleContinueWith(modelId: string) {
    setSelected(new Set([modelId]));
    userOwnsSelection.current = true;  // stop tier-default auto-sync from overriding
    setResult(null);
    setError("");
    setIntentHint(null);
    // Scroll + focus on the next tick so the layout collapse has happened.
    setTimeout(() => {
      questionInputRef.current?.focus();
      questionInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }
  const toggleAnswer = (modelId: string) => {
    setExpandedAnswers(prev => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId); else next.add(modelId);
      return next;
    });
  };
  const autoSubmitted = useRef(false);
  // User "owns" their selection if they brought a ?models= URL preset or
  // manually edited the picker. Otherwise we keep it in sync with their tier.
  const userOwnsSelection = useRef(modelsParam !== null);

  // Whenever the tier resolves, snap the default selection to that tier's
  // defaults — unless the user has explicitly chosen models.
  useEffect(() => {
    if (userOwnsSelection.current) return;
    setSelected(new Set(TIER_DEFAULTS[tier]));
  }, [tier]);

  function handleSelectionChange(next: Set<string>) {
    userOwnsSelection.current = true;
    setSelected(next);
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    createClient().auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  const maxModels = maxModelsForTier(tier);
  const lockedIds = lockedModelIds(tier, allModels);

  useEffect(() => {
    fetch("/api/models")
      .then(r => r.json())
      .then((d: { models?: ModelEntry[] }) => {
        if (Array.isArray(d.models) && d.models.length > 0) {
          setAllModels(d.models);
          setModelLabels(d.models);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoSubmitted.current) {
      autoSubmitted.current = true;
      setQuestion(q);
      submitQuestion(q, modelsParam ?? new Set(TIER_DEFAULTS.free));
    }
  }, []);

  // Keep the selection valid for the current tier — trims flagship models /
  // excess count from a stale URL or after a tier change.
  useEffect(() => {
    const locked = lockedModelIds(tier, allModels);
    const cap = maxModelsForTier(tier);
    setSelected(prev => {
      const valid = [...prev].filter(id => !locked.has(id)).slice(0, cap);
      if (valid.length === prev.size) return prev;
      return new Set(valid.length > 0 ? valid : TIER_DEFAULTS[tier]);
    });
  }, [tier, allModels]);

  async function submitQuestion(q: string, models: Set<string>) {
    const startedAt = Date.now();
    setLoading(true);
    setResult(null);
    setError("");
    setIntentHint(null);
    setQuestion("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.trim(), models: [...models] }),
      });
      if (!res.ok || !res.body) {
        let errorMsg = `Request failed (HTTP ${res.status})`;
        try {
          const text = await res.text();
          if (text) {
            try {
              const parsed = JSON.parse(text);
              if (parsed?.error) errorMsg = parsed.error;
            } catch { /* not JSON, keep generic */ }
          }
        } catch { /* body unreadable, keep generic */ }
        throw new Error(errorMsg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      type StreamedResult = Result & { cached?: boolean; failed?: { model: string; error: string }[] };
      let pendingResult: StreamedResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let evt: { stage?: string; intent?: string; error?: string; [k: string]: unknown };
          try { evt = JSON.parse(line); } catch { continue; }

          if (evt.stage === "intent" && (evt.intent === "compare" || evt.intent === "product" || evt.intent === "direct")) {
            setIntentHint(evt.intent);
          } else if (evt.stage === "result") {
            const { stage: _s, ...rest } = evt;
            void _s;
            pendingResult = rest as unknown as StreamedResult;
          } else if (evt.stage === "error") {
            throw new Error(evt.error ?? "Request failed");
          }
        }
      }

      if (pendingResult) {
        if (pendingResult.cached) {
          const elapsed = Date.now() - startedAt;
          const remaining = 2000 - elapsed;
          if (remaining > 0) await new Promise(r => setTimeout(r, remaining));
        }
        setResult(pendingResult);
        // Capture into session recents so the sidebar shows it and the
        // user can jump back to this comparison without re-querying.
        pushRecent(q.trim(), models, pendingResult);
      } else {
        throw new Error("Empty response from server");
      }
    } catch (err: unknown) {
      // Report handled failures — this is the path the user actually sees
      Sentry.captureException(err, { tags: { feature: "ask" } });
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setIntentHint(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    await submitQuestion(question, selected);
  }

  // Reset to a blank comparison ("New comparison" in the sidebar).
  function newComparison() {
    setResult(null);
    setQuestion("");
    setError("");
    setIntentHint(null);
    setActiveRecentId(null);
    setSidebarOpen(false);
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-gradient-to-b from-navy via-navy to-[#252547]">
      {/* Soft gradient orbs */}
      <div className="pointer-events-none absolute top-20 left-1/3 w-[500px] h-[500px] bg-teal-500/12 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/8 rounded-full blur-[100px]" />

      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewComparison={newComparison}
        recents={sessionRecents.map(r => ({ id: r.id, question: r.question }))}
        activeId={activeRecentId}
        onSelectRecent={selectRecent}
      />

      <div className="relative z-10 flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/5 px-4">
          {/* Mobile: menu toggle + logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="text-white/60 hover:text-white transition"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href={signedIn ? "/app" : "/"} aria-label="aggrai home">
              <Logo height={24} gradientId="topbar-logo" />
            </Link>
          </div>

          <div className="flex-1" />

          {/* Auth buttons — anonymous only */}
          {!signedIn && (
            <div className="flex items-center gap-2">
              <Link
                href="/signin"
                className="rounded-lg px-3 py-1.5 text-sm text-white/60 transition hover:text-white"
              >
                Log in
              </Link>
              <Link
                href="/signin?mode=signup"
                className="rounded-lg bg-white px-3.5 py-1.5 text-sm font-medium text-navy transition hover:bg-white/90"
              >
                Sign up for free
              </Link>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-10">
          <div className="mx-auto max-w-4xl space-y-8">

          {showUpgradedBanner && (
            <div className="rounded-xl border border-teal-400/30 bg-teal-400/10 px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-sm text-teal-200">
                Plan upgraded — your new models are unlocked.
              </p>
              <button
                type="button"
                onClick={() => setShowUpgradedBanner(false)}
                className="text-teal-300/60 hover:text-teal-200 text-xs"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center bg-white/[0.08] backdrop-blur-xl rounded-2xl border border-white/10 hover:border-white/20 transition-colors shadow-2xl shadow-black/20">
              <textarea
                ref={questionInputRef}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                placeholder="What would you like to know?"
                rows={2}
                className="flex-1 resize-none bg-transparent text-white placeholder:text-white/30 px-6 py-4 text-base focus:outline-none rounded-2xl"
              />
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="m-2 bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-400 text-white p-3.5 rounded-xl transition-all shadow-lg shadow-teal-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Submit"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Model selector */}
            <ModelPicker
              all={allModels}
              selected={selected}
              onChange={handleSelectionChange}
              max={maxModels}
              lockedIds={lockedIds}
            />
          </form>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Loading state — skeleton blocks mirroring the real layout */}
          {loading && (
            intentHint === "compare" && selected.size > 1 ? (
              <div className="space-y-4">
                <LoadingBlock title="Strongest single answer" gradientId="ld-winner" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <LoadingBlock title="Summary" gradientId="ld-summary" className="lg:h-full min-h-[280px]" />
                  <LoadingBlock title="Quality scores" gradientId="ld-sm" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[...selected].map(id => (
                    <ModelLoadingBlock key={id} modelId={id} />
                  ))}
                </div>
              </div>
            ) : (
              <LoadingBlock title="Thinking…" gradientId="ld-initial" />
            )
          )}

          {/* Results */}
          {result && !loading && (
            <div className="space-y-6">
              {/* Asked question */}
              <div className="text-sm text-white/50">
                <span className="text-white/30">You asked:</span>{" "}
                <span className="text-white/80">{result.question}</span>
              </div>

              {result.type === "product" ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-6 shadow-xl">
                  <div className="mb-3">
                    <Logo height={28} symbolOnly gradientId="product-g" />
                  </div>
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.answer}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <>
                  {/* Multi-model results — top-down:
                      1. Strongest single answer + Continue CTA (next action).
                      2. Two-col main content:
                         - LEFT: Summary card = Contributions (where it came
                           from) on top, then Best Answer (the rewrite).
                         - RIGHT: Quality scores. */}
                  {result.answers.length > 1 && (() => {
                    const { best } = splitSummary(result.summary);
                    return (
                      <>
                        {result.answers.some(a => a.scores) && (
                          <WinnerBlock
                            answers={result.answers}
                            // 'Continue with X' button hidden until V2
                            // persistent conversation lands. handleContinueWith
                            // is left in place so the wire-up is ready when
                            // we re-enable; just don't pass it for now.
                            // onContinue={handleContinueWith}
                          />
                        )}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                          <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-6 shadow-xl min-w-0">
                            <div className="flex items-center gap-2 mb-4">
                              <Layers className="w-3.5 h-3.5 text-teal-300" />
                              <p className="text-xs font-semibold uppercase tracking-wider text-teal-300/80">
                                Summary
                              </p>
                            </div>

                            {/* Contributions FIRST — explains where the
                                rewritten Best answer's content came from
                                before the user reads the rewrite itself. */}
                            {result.contributions && result.contributions.length > 0 && (
                              <ContributionsTop contributions={result.contributions} />
                            )}

                            {/* Best answer — the rewritten synthesis, the
                                hero content of this card. */}
                            <div className="prose prose-sm sm:prose-base prose-invert max-w-none
                              prose-h2:text-base prose-h2:font-semibold prose-h2:text-white prose-h2:mt-4 prose-h2:mb-2
                              prose-h3:text-sm prose-h3:font-semibold prose-h3:text-white prose-h3:mt-3 prose-h3:mb-2
                              prose-ul:my-2 prose-li:my-1 prose-p:my-2 prose-strong:text-white">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-300/80 mb-2 not-prose">
                                Aggrai&apos;s answer
                                <span className="ml-1.5 normal-case tracking-normal text-white/30 font-medium">
                                  · combined from all models, weighted by score
                                </span>
                              </p>
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                                {best || result.summary}
                              </ReactMarkdown>
                            </div>
                          </div>
                          <div className="min-w-0">
                            <ScoresAndMetrics answers={result.answers} />
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Per-model answers — full width if only one */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Raw answers</p>
                    {result.answers.length > 1 && (() => {
                      const allOpen = expandedAnswers.size === result.answers.length;
                      return (
                        <button
                          type="button"
                          onClick={() => setExpandedAnswers(allOpen ? new Set() : new Set(result.answers.map(a => a.model)))}
                          className="text-xs text-white/50 hover:text-white/80 transition-colors"
                        >
                          {allOpen ? "Collapse all" : "Expand all"}
                        </button>
                      );
                    })()}
                  </div>
                  <div className={`grid grid-cols-1 gap-4 ${result.answers.length > 1 ? "sm:grid-cols-2" : ""}`}>
                    {result.answers.map(a => {
                      const isOpen = expandedAnswers.has(a.model);
                      return (
                        <div key={a.model} className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl min-w-0 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleAnswer(a.model)}
                            aria-expanded={isOpen}
                            className="w-full flex items-center justify-between gap-2 p-5 text-left hover:bg-white/[0.02] transition-colors"
                          >
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-white/90 min-w-0">
                              <ProviderLogo provider={providerOf(a.model)} className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{modelLabel(a.model)}</span>
                            </span>
                            <div className="flex items-center gap-3 text-xs text-white/40 shrink-0">
                              <span>{(a.runtime_ms / 1000).toFixed(1)}s</span>
                              <span>{a.tokens} tok</span>
                              <ChevronDown
                                className={`w-4 h-4 text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`}
                                aria-hidden="true"
                              />
                            </div>
                          </button>
                          {isOpen && (
                            <div className="px-5 pb-5 prose prose-sm prose-invert max-w-none prose-p:my-2 prose-strong:text-white
                              [&_table]:block [&_table]:overflow-x-auto [&_table]:w-full [&_table]:text-xs
                              [&_pre]:overflow-x-auto [&_pre]:max-w-full
                              [&_img]:max-w-full [&_code]:break-words">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{a.answer}</ReactMarkdown>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Failed models */}
                  {result.failed && result.failed.length > 0 && (
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-300">
                      Failed: {result.failed.map(f => modelLabel(f.model)).join(", ")}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        </main>
      </div>
    </div>
  );
}
