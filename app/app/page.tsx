"use client";
import { Suspense } from "react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";

const MODELS = [
  { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "mistralai/mistral-small-3.2-24b-instruct", label: "Mistral Small" },
  { id: "meta-llama/llama-3.1-8b-instruct", label: "Llama 3.1 8B" },
];

type Answer = {
  model: string;
  answer: string;
  runtime_ms: number;
  tokens: number;
  cost_usd: number | null;
};

type Result =
  | { type: "product"; answer: string; question: string }
  | { type: "compare"; summary: string; answers: Answer[]; question: string; failed?: { model: string; error: string }[] };

function modelLabel(id: string) {
  return MODELS.find(m => m.id === id)?.label ?? id.split("/").pop() ?? id;
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

          {/* Loading state — big spinning logo */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-6">
              <Logo height={80} spinning gradientId="loading-g" />
              <p className="text-sm text-white/50">Asking every model…</p>
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <div className="space-y-6">

              {result.type === "product" ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-6 shadow-xl">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-teal-300/80">Aggrai</p>
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.answer}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <>
                  {/* Summary */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-6 shadow-xl">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-teal-300/80">Summary</p>
                    <div className="prose prose-sm prose-invert max-w-none
                      prose-h2:text-sm prose-h2:font-semibold prose-h2:text-white prose-h2:mt-4 prose-h2:mb-2
                      prose-ul:my-1 prose-li:my-0.5 prose-p:my-2 prose-strong:text-white">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.summary}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Per-model answers */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {result.answers.map(a => (
                      <div key={a.model} className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-semibold text-white/90">{modelLabel(a.model)}</span>
                          <div className="flex gap-3 text-xs text-white/40">
                            <span>{(a.runtime_ms / 1000).toFixed(1)}s</span>
                            <span>{a.tokens} tok</span>
                            {a.cost_usd && <span>${a.cost_usd.toFixed(4)}</span>}
                          </div>
                        </div>
                        <div className="prose prose-sm prose-invert max-w-none prose-p:my-2 prose-strong:text-white">
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
