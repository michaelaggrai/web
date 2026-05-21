"use client";
import { Suspense } from "react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, Zap, BookOpen, FileText, Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";
import { ModelLoader } from "@/components/model-loader";

const MODELS = [
  { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "mistralai/mistral-small-3.2-24b-instruct", label: "Mistral Small" },
  { id: "meta-llama/llama-3.1-8b-instruct", label: "Llama 3.1 8B" },
];

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
  | { type: "product"; answer: string; question: string }
  | { type: "compare"; summary: string; answers: Answer[]; question: string; failed?: { model: string; error: string }[] };

function modelLabel(id: string) {
  return MODELS.find(m => m.id === id)?.label ?? id.split("/").pop() ?? id;
}

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

function LoadingBlock({ title, gradientId, compact }: { title: string; gradientId: string; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-xl flex flex-col items-center justify-center gap-3 ${compact ? "min-h-[140px] p-5" : "min-h-[180px] p-6"}`}>
      <Logo height={compact ? 22 : 30} spinning symbolOnly gradientId={gradientId} />
      <p className="text-xs text-white/40">{title}</p>
    </div>
  );
}

function ModelLoadingBlock({ modelId }: { modelId: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-xl flex flex-col items-center justify-center gap-3 min-h-[140px] p-5">
      <ModelLoader modelId={modelId} size={28} />
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
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
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
                <div key={key}>
                  <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
                    <span>{label}</span>
                    <span className="text-white/70">{a.scores[key].toFixed(1)}</span>
                  </div>
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
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-300/80">Comparison</p>
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-400/15 text-teal-200 border border-teal-400/20 px-2 py-0.5">
            <Zap className="w-3 h-3" /> Fastest: {modelLabel(fastest.model)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-400/15 text-teal-200 border border-teal-400/20 px-2 py-0.5">
            <BookOpen className="w-3 h-3" /> Most readable: {modelLabel(mostReadable.model)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 text-white/70 border border-white/10 px-2 py-0.5">
            <FileText className="w-3 h-3" /> Most detailed: {modelLabel(longest.model)}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {enriched.map(a => (
          <div key={a.model} className="grid grid-cols-1 sm:grid-cols-[130px_1fr] gap-2 sm:gap-4 items-center">
            <div className="text-xs font-medium text-white/80 truncate">{modelLabel(a.model)}</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
                  <span>Speed</span>
                  <span className="text-white/70">{(a.runtime_ms / 1000).toFixed(1)}s</span>
                </div>
                <Bar pct={1 - a.runtime_ms / maxRuntime} accent={a.model === fastest.model} />
              </div>
              <div>
                <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
                  <span>Readability</span>
                  <span className="text-white/70">{readabilityLabel(a.readability)}</span>
                </div>
                <Bar
                  pct={maxRead > 0 ? Math.max(0, a.readability) / maxRead : 0}
                  accent={a.model === mostReadable.model}
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
                  <span>Detail</span>
                  <span className="text-white/70">{a.words}w</span>
                </div>
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
  const [question, setQuestion] = useState(searchParams.get("q") ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(MODELS.map(m => m.id)));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const autoSubmitted = useRef(false);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoSubmitted.current) {
      autoSubmitted.current = true;
      setQuestion(q);
      submitQuestion(q, new Set(MODELS.map(m => m.id)));
    }
  }, []);

  function toggleModel(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function submitQuestion(q: string, models: Set<string>) {
    setLoading(true);
    setResult(null);
    setError("");
    setQuestion("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.trim(), models: [...models] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    await submitQuestion(question, selected);
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-navy via-navy to-[#252547] overflow-hidden">
      {/* Soft gradient orbs */}
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/15 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px]" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-navy/60 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/">
              <Logo height={36} gradientId="app-logo-g" />
            </Link>
            <span className="text-xs text-white/40">Ask every AI at once</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-4 py-10">
        <div className="mx-auto max-w-4xl space-y-8">

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
            <div className="flex flex-wrap gap-2">
              {MODELS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleModel(m.id)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition border ${
                    selected.has(m.id)
                      ? "bg-white/15 text-white border-white/20"
                      : "bg-white/5 text-white/40 border-white/5 hover:text-white/70 hover:border-white/10"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </form>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Loading state — skeleton blocks mirroring the real layout */}
          {loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <LoadingBlock title="Summary" gradientId="ld-summary" />
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
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-teal-300/80">Aggrai</p>
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.answer}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <>
                  {/* Summary + (Comparison stacked over Quality scores) side-by-side */}
                  <div className={result.answers.length > 1 ? "grid grid-cols-1 lg:grid-cols-2 gap-4 items-start" : ""}>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-6 shadow-xl min-w-0">
                      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-teal-300/80">Summary</p>
                      <div className="prose prose-sm prose-invert max-w-none
                        prose-h2:text-sm prose-h2:font-semibold prose-h2:text-white prose-h2:mt-4 prose-h2:mb-2
                        prose-ul:my-1 prose-li:my-0.5 prose-p:my-2 prose-strong:text-white">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.summary}</ReactMarkdown>
                      </div>
                    </div>
                    {result.answers.length > 1 && (
                      <div className="space-y-4 min-w-0">
                        <MetricsCompare answers={result.answers} />
                        {result.answers.some(a => a.scores) && <QualityScores answers={result.answers} />}
                      </div>
                    )}
                  </div>

                  {/* Per-model answers */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {result.answers.map(a => (
                      <div key={a.model} className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5 min-w-0 overflow-hidden">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-semibold text-white/90">{modelLabel(a.model)}</span>
                          <div className="flex gap-3 text-xs text-white/40">
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
  );
}
