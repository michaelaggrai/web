"use client";
import React, { Suspense } from "react";
import { useState, useEffect, useRef } from "react";
import * as Sentry from "@sentry/nextjs";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, Zap, BookOpen, FileText, Sparkles, Layers, BarChart3, Menu } from "lucide-react";
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

type Result =
  | { type: "product"; answer: string; question: string; cached?: boolean }
  | { type: "compare"; summary: string; answers: Answer[]; question: string; failed?: { model: string; error: string }[]; cached?: boolean };

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

function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

function fleschReadingEase(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length || 1;
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  return 206.835 - 1.015 * (words.length / sentences) - 84.6 * (syllables / words.length);
}

function readabilityLabel(score: number): string {
  if (score >= 80) return "Very easy";
  if (score >= 60) return "Easy";
  if (score >= 40) return "Moderate";
  if (score >= 20) return "Difficult";
  return "Complex";
}

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

function QualityScores({ answers }: { answers: Answer[] }) {
  const scored = answers.filter((a): a is Answer & { scores: Scores } => !!a.scores);
  if (scored.length === 0) return null;

  const winners = SCORE_KEYS.map(({ key, label }) => {
    const top = scored.reduce((p, c) => (c.scores[key] > p.scores[key] ? c : p));
    return { key, label, model: top.model, value: top.scores[key] };
  });

  const ScoreBar = ({ value, accent }: { value: number; accent?: boolean }) => (
    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
      <div
        className={`h-full rounded-full ${accent ? "bg-gradient-to-r from-teal-400 to-teal-300" : "bg-white/30"}`}
        style={{ width: `${(value / 5) * 100}%` }}
      />
    </div>
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-6 shadow-xl">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-teal-300" />
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-300/80">Quality scores</p>
          <span className="text-[10px] text-white/30">judged by Haiku · 0–5</span>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px]">
          {winners.map(w => (
            <span key={w.key} className="inline-flex items-center gap-1 rounded-full bg-teal-400/15 text-teal-200 border border-teal-400/20 px-2 py-0.5">
              {w.label}: {modelLabel(w.model)}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {scored.map(a => (
          <div key={a.model} className="grid grid-cols-1 sm:grid-cols-[130px_1fr] gap-2 sm:gap-4 items-center">
            <div className="text-xs font-medium text-white/80 truncate">{modelLabel(a.model)}</div>
            <div className="grid grid-cols-2 gap-3">
              {SCORE_KEYS.map(({ key, label }) => (
                <div key={key} className="min-w-0">
                  <div className="text-[10px] text-white/40 truncate">{label}</div>
                  <div className="text-xs text-white/70 mb-1 truncate">{a.scores[key].toFixed(1)}</div>
                  <ScoreBar
                    value={a.scores[key]}
                    accent={winners.find(w => w.key === key)?.model === a.model}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricsCompare({ answers }: { answers: Answer[] }) {
  const enriched = answers.map(a => ({
    ...a,
    words: wordCount(a.answer),
    readability: fleschReadingEase(a.answer),
  }));
  const fastest = enriched.reduce((p, c) => (c.runtime_ms < p.runtime_ms ? c : p));
  const mostReadable = enriched.reduce((p, c) => (c.readability > p.readability ? c : p));
  const longest = enriched.reduce((p, c) => (c.words > p.words ? c : p));

  const maxRuntime = Math.max(...enriched.map(a => a.runtime_ms));
  const maxWords   = Math.max(...enriched.map(a => a.words));
  const maxRead    = Math.max(...enriched.map(a => Math.max(0, a.readability)));

  const Bar = ({ pct, accent }: { pct: number; accent?: boolean }) => (
    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
      <div
        className={`h-full rounded-full ${accent ? "bg-gradient-to-r from-teal-400 to-teal-300" : "bg-white/30"}`}
        style={{ width: `${Math.max(4, pct * 100)}%` }}
      />
    </div>
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-6 shadow-xl">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-3.5 h-3.5 text-teal-300" />
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-300/80">Comparison</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-400/15 text-teal-200 border border-teal-400/20 px-2 py-0.5">
            <Zap className="w-3 h-3" /> Fastest: {modelLabel(fastest.model)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-400/15 text-teal-200 border border-teal-400/20 px-2 py-0.5">
            <BookOpen className="w-3 h-3" /> Most readable: {modelLabel(mostReadable.model)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-400/15 text-teal-200 border border-teal-400/20 px-2 py-0.5">
            <FileText className="w-3 h-3" /> Most detailed: {modelLabel(longest.model)}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {enriched.map(a => (
          <div key={a.model} className="grid grid-cols-1 sm:grid-cols-[130px_1fr] gap-2 sm:gap-4 items-center">
            <div className="text-xs font-medium text-white/80 truncate">{modelLabel(a.model)}</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="min-w-0">
                <div className="text-[10px] text-white/40 truncate">Speed</div>
                <div className="text-xs text-white/70 mb-1 truncate">{(a.runtime_ms / 1000).toFixed(1)}s</div>
                <Bar pct={1 - a.runtime_ms / maxRuntime} accent={a.model === fastest.model} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-white/40 truncate">Readability</div>
                <div className="text-xs text-white/70 mb-1 truncate">{readabilityLabel(a.readability)}</div>
                <Bar
                  pct={maxRead > 0 ? Math.max(0, a.readability) / maxRead : 0}
                  accent={a.model === mostReadable.model}
                />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-white/40 truncate">Detail</div>
                <div className="text-xs text-white/70 mb-1 truncate">{a.words}w</div>
                <Bar pct={a.words / maxWords} />
              </div>
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
  const [showUpgradedBanner, setShowUpgradedBanner] = useState(searchParams.get("upgraded") === "1");
  const [signedIn, setSignedIn] = useState(false);
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
            <Logo height={24} gradientId="topbar-logo" />
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <LoadingBlock title="Summary" gradientId="ld-summary" className="lg:h-full" />
                  <div className="space-y-4">
                    <LoadingBlock title="Comparison" gradientId="ld-cmp" />
                    <LoadingBlock title="Quality scores" gradientId="ld-q" />
                  </div>
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
                  {/* Summary + (Comparison stacked over Quality scores) — only when comparing 2+ models */}
                  {result.answers.length > 1 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-6 shadow-xl min-w-0">
                        <div className="flex items-center gap-2 mb-4">
                          <Layers className="w-3.5 h-3.5 text-teal-300" />
                          <p className="text-xs font-semibold uppercase tracking-wider text-teal-300/80">Summary</p>
                        </div>
                        <div className="prose prose-sm prose-invert max-w-none
                          prose-h2:text-sm prose-h2:font-semibold prose-h2:text-white prose-h2:mt-4 prose-h2:mb-2
                          prose-ul:my-1 prose-li:my-0.5 prose-p:my-2 prose-strong:text-white">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>{result.summary}</ReactMarkdown>
                        </div>
                      </div>
                      <div className="space-y-4 min-w-0">
                        <MetricsCompare answers={result.answers} />
                        {result.answers.some(a => a.scores) && <QualityScores answers={result.answers} />}
                      </div>
                    </div>
                  )}

                  {/* Per-model answers — full width if only one */}
                  <div className={`grid grid-cols-1 gap-4 ${result.answers.length > 1 ? "sm:grid-cols-2" : ""}`}>
                    {result.answers.map(a => (
                      <div key={a.model} className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5 min-w-0 overflow-hidden">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-white/90 min-w-0">
                            <ProviderLogo provider={providerOf(a.model)} className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{modelLabel(a.model)}</span>
                          </span>
                          <div className="flex gap-3 text-xs text-white/40 shrink-0">
                            <span>{(a.runtime_ms / 1000).toFixed(1)}s</span>
                            <span>{a.tokens} tok</span>
                          </div>
                        </div>
                        <div className="prose prose-sm prose-invert max-w-none prose-p:my-2 prose-strong:text-white
                          [&_table]:block [&_table]:overflow-x-auto [&_table]:w-full [&_table]:text-xs
                          [&_pre]:overflow-x-auto [&_pre]:max-w-full
                          [&_img]:max-w-full [&_code]:break-words">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{a.answer}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
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
