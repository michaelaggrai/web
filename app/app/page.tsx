"use client";
import { Suspense } from "react";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <img src="/logo.png" alt="aggrai" style={{ height: 36, width: 'auto' }} />
          <span className="text-xs text-gray-400">Ask every AI at once</span>
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-4xl space-y-8">

          {/* Input */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e); }}
              placeholder="Ask anything…"
              rows={3}
              className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-400 shadow-sm"
            />

            {/* Model selector */}
            <div className="flex flex-wrap gap-2">
              {MODELS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleModel(m.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition border ${
                    selected.has(m.id)
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-40"
            >
              {loading ? "Comparing…" : "Compare"}
            </button>
          </form>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-4 animate-pulse">
              <div className="h-24 rounded-xl bg-gray-100" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[...selected].map(id => (
                  <div key={id} className="h-32 rounded-xl bg-gray-100" />
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <div className="space-y-6">

              {result.type === "product" ? (
                /* Product answer */
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Aggrai</p>
                  <div className="prose prose-sm prose-gray max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.answer}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <>
                  {/* Summary */}
                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Summary</p>
                    <div className="prose prose-sm prose-gray max-w-none
                      prose-h2:text-sm prose-h2:font-semibold prose-h2:text-gray-900 prose-h2:mt-4 prose-h2:mb-2
                      prose-ul:my-1 prose-li:my-0.5 prose-p:my-2">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.summary}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Per-model answers */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {result.answers.map(a => (
                      <div key={a.model} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-700">{modelLabel(a.model)}</span>
                          <div className="flex gap-3 text-xs text-gray-400">
                            <span>{(a.runtime_ms / 1000).toFixed(1)}s</span>
                            <span>{a.tokens} tok</span>
                            {a.cost_usd && <span>${a.cost_usd.toFixed(4)}</span>}
                          </div>
                        </div>
                        <div className="prose prose-sm prose-gray max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{a.answer}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Failed models */}
                  {result.failed && result.failed.length > 0 && (
                    <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-700">
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
