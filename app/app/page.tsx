"use client";
import React, { Suspense } from "react";
import { useState, useEffect, useRef } from "react";
import * as Sentry from "@sentry/nextjs";
import { useSearchParams, usePathname } from "next/navigation";
import { generateConvId, storeConv, loadConv } from "@/lib/conv-id";
import { getAnonId } from "@/lib/anon-id";
import { getSessionId } from "@/lib/session-id";
import { saveConversation, listConversations, loadConversation, type ConvRow } from "@/lib/history";
import { claimAnonRecents } from "@/lib/claim-recents";
import { appendMessage, bumpConversation, type ConvMessage } from "@/lib/messages";
// P6b Phase 4: read threads from the raw source-of-truth tables (questions +
// model_runs) instead of the messages table. Same ConvMessage[] shape → toFollowups
// + rendering unchanged. Writers above still dual-write messages until Phase 6.
import { listThread } from "@/lib/thread";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, Layers, BarChart3, Menu, ChevronDown, Trophy, Square, Plus, Minus, Check, Globe, Share2 } from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ModelLoader } from "@/components/model-loader";
import { ModelPicker } from "@/components/model-picker";
import { AppSidebar } from "@/components/app-sidebar";
import { useTier } from "@/lib/use-tier";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { ProviderLogo, providerOf } from "@/components/brand-icons";
import { FALLBACK_MODELS, TIER_DEFAULTS, maxModelsForTier, lockedModelIds, parseModelsParam, type ModelEntry, type Tier } from "@/lib/models";
import type { ShareSnapshot, ShareTurn, ShareAnswer } from "@/lib/share";

// AGG-7 v2 (2026-05-25): switched from 4-dim (comprehension /
// thought_provoking / nuance / clarity) to research-backed 5-dim.
// Each dimension is 0-5 from the judge (itself the mean of 3 sub-criteria);
// overallScore() weights them into a single 0-10 with a fatal-flaw cap on Accuracy.
// See /Users/ms/assistant/research/scoring-metric-2026-05-24.md.
type Scores = {
  accuracy:     number;
  completeness: number;
  calibration:  number;
  clarity:      number;
  insight:      number;
  /** |s5: per-model qualitative critique behind the radar's expand toggle.
   *  Short bullet phrases. Absent/empty on older cached responses. */
  strengths?:   string[];
  weaknesses?:  string[];
};

type Answer = {
  model: string;
  answer: string;
  runtime_ms: number;
  tokens: number;
  cost_usd: number | null;
  /** True when the provider hit our max_tokens cap (finish_reason=length).
   *  Surface in the UI so a low quality score on a truncated answer doesn't
   *  read as "the model was bad" — it reads as "we cut it off." */
  truncated?: boolean;
  scores?: Scores | null;
};

type Contribution = { model: string; pct: number };
type SectionAttribution = { heading: string; primary: string; supporting: string[] };

// AGG-39: the live web-search sources, embedded IN the persisted result so a
// restored/revisited ask keeps its "Searched the web" block (the live
// stage:'search' event is gone on reload). Matches SearchSources' `info` prop.
type SearchBlock = { ok: boolean; provider?: string; sources: { title: string; url: string }[] };

type Result =
  | { type: "product"; answer: string; question: string; cached?: boolean }
  // "direct" = a single-right-answer factual question (2+2, capital of France)
  // where a multi-model comparison adds no value. Rendered like product but
  // with a witty "we didn't burn the energy comparing" note.
  | { type: "direct"; answer: string; question: string; cached?: boolean; search?: SearchBlock | null }
  | {
      type: "compare";
      summary: string;
      answers: Answer[];
      question: string;
      contributions?: Contribution[] | null;
      section_attributions?: SectionAttribution[] | null;
      failed?: { model: string; error: string }[];
      // True when the question likely depends on information newer than the
      // models' training cutoff — the UI shows a "may not reflect the latest"
      // banner so users don't trust time-sensitive answers blindly.
      recencyWarning?: boolean;
      // AGG-39: sources if this ask was grounded on live search. Present even on a
      // restored result, so revisiting a grounded ask still shows them.
      search?: SearchBlock | null;
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

// Extract plain text from arbitrary ReactMarkdown children (strings, fragments,
// nested elements). Used by the heading-detection logic that looks for
// "**Bold heading:**" style paragraphs to attach attribution chips to.
function extractText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return extractText(props.children);
  }
  return "";
}

// True if a paragraph's children are ONLY a single bold child (with optional
// trailing colon / whitespace). Matches the "## Heading"-via-bold pattern the
// summariser tends to produce: `**Your foundation matters first:**`
function isBoldOnlyParagraph(children: React.ReactNode): boolean {
  const arr = React.Children.toArray(children);
  // Allow optional trailing colon/punctuation text nodes
  const meaningful = arr.filter(c => {
    if (typeof c === "string") return c.trim().length > 0;
    return true;
  });
  if (meaningful.length === 0) return false;
  const first = meaningful[0];
  if (!React.isValidElement(first)) return false;
  // Tag name check — handles both `strong` and `b`
  const tag = (first as { type?: string | { displayName?: string } }).type;
  const tagName = typeof tag === "string" ? tag : "";
  if (tagName !== "strong" && tagName !== "b") return false;
  // Any remaining children must be tiny punctuation-only text (e.g. ":")
  const rest = meaningful.slice(1);
  return rest.every(c => typeof c === "string" && /^[\s:.;!?–—-]*$/.test(c));
}

// Normalise a heading string for fuzzy matching: lowercase, strip trailing
// colons + punctuation + whitespace so "Your foundation matters first:" and
// "your foundation matters FIRST" both match the same attribution entry.
function normHeading(s: string): string {
  return s.trim().toLowerCase().replace(/[\s:.,!?]+$/g, "");
}

// Per-section "via <model>" attribution chip — REMOVED from display at the
// user's request (2026-05-29). The model-level attribution is now shown by
// the single stacked "Where the summary came from" bar at the top of the
// Summary card, which made the per-heading chips redundant + noisy.
//
// Kept as a no-op (rather than ripping out the section_attribution wiring +
// injection points in makeAggraiAnswerComponents) so it can be reinstated
// by restoring this body if we want section-level attribution back.
function AttributionChip(_props: {
  attribution: SectionAttribution;
  knownModelIds: Set<string>;
}) {
  return null;
}

// Factory: returns ReactMarkdown components that inject attribution chips
// after each heading-like element (h2 or bold-only paragraph) when a
// matching section_attribution exists. Used only for the aggrai's answer
// render — the default MARKDOWN_COMPONENTS handles everything else.
function makeAggraiAnswerComponents(
  attributions: SectionAttribution[],
  knownModelIds: Set<string>,
) {
  // Index by normalised heading for O(1) lookup
  const byHeading = new Map<string, SectionAttribution>();
  for (const a of attributions) {
    byHeading.set(normHeading(a.heading), a);
  }
  const lookup = (text: string) => byHeading.get(normHeading(text));

  return {
    p: ({ children }: { children?: React.ReactNode }) => {
      if (isBoldOnlyParagraph(children)) {
        const text = extractText(children);
        const attribution = lookup(text);
        return (
          <p>
            {highlightNode(children, "p")}
            {attribution && <AttributionChip attribution={attribution} knownModelIds={knownModelIds} />}
          </p>
        );
      }
      return <p>{highlightNode(children, "p")}</p>;
    },
    h2: ({ children }: { children?: React.ReactNode }) => {
      const text = extractText(children);
      const attribution = lookup(text);
      return (
        <h2>
          {highlightNode(children, "h2")}
          {attribution && <AttributionChip attribution={attribution} knownModelIds={knownModelIds} />}
        </h2>
      );
    },
    h3: ({ children }: { children?: React.ReactNode }) => {
      const text = extractText(children);
      const attribution = lookup(text);
      return (
        <h3>
          {highlightNode(children, "h3")}
          {attribution && <AttributionChip attribution={attribution} knownModelIds={knownModelIds} />}
        </h3>
      );
    },
    li: ({ children }: { children?: React.ReactNode }) => <li>{highlightNode(children, "li")}</li>,
    strong: ({ children }: { children?: React.ReactNode }) => <strong>{highlightNode(children, "s")}</strong>,
    em: ({ children }: { children?: React.ReactNode }) => <em>{highlightNode(children, "e")}</em>,
  };
}

// Two sizes for the loading blocks — they're tuned to look *visually*
// equivalent even though the numbers differ. The aggrai pentagon mesh is
// an open outline (5 dots + thin spokes + thin edge) with lots of negative
// space, while brand icons (Claude A, OpenAI spiral, Google G, Llama M,
// Mistral grid) are filled shapes that fill their box more densely.
// Sizing history: original 44 → bumped to 64 (overshot — brand felt
// dominant) → pulled to 52 (still too big per user feedback) → 44
// (back to original, filled-vs-mesh visual weight matches at this ratio).
// The aggrai 84 with internal padding (viewBox -12 -12 124 124) renders
// at ~68px visible mesh, which roughly matches brand 44 once you account
// for the density difference between filled glyphs and open outlines.
const LOADING_BRAND_SIZE = 44;   // ProviderLogo for per-model loaders
const LOADING_AGGRAI_SIZE = 84;  // Aggrai pentagon for summary / scores / winner loaders

function LoadingBlock({ title, gradientId, className = "" }: { title: string; gradientId: string; className?: string }) {
  return (
    <div
      role="status"
      aria-label={`Loading ${title}`}
      className={`rounded-2xl border border-white/10 bg-surface-2 backdrop-blur-xl shadow-xl flex flex-col items-center justify-center gap-2 min-h-[110px] p-4 ${className}`}
    >
      <Logo height={LOADING_AGGRAI_SIZE} spinning symbolOnly gradientId={gradientId} />
      <p className="text-xs text-white/55">{title}</p>
    </div>
  );
}

function ModelLoadingBlock({ modelId }: { modelId: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-1 backdrop-blur-xl shadow-xl flex flex-col items-center justify-center gap-2 min-h-[110px] p-4">
      <ModelLoader modelId={modelId} size={LOADING_BRAND_SIZE} label={modelLabel(modelId)} />
      <p className="text-xs text-white/55">{modelLabel(modelId)}</p>
    </div>
  );
}

// Playful flavour lines that rotate under the headline so the wait feels alive
// even in the gaps between real events. Two sets — one per phase.
const THINKING_FLAVORS = [
  "no peeking at each other's work",
  "each one thinking solo",
  "the more minds the merrier",
  "gathering every angle",
  "same question, five takes",
];
const SCORING_FLAVORS = [
  "reading every answer twice",
  "tallying the Aggr-Score",
  "marking on the merits",
  "checking who backed it up",
  "crowning a winner",
];

// The live orchestration status shown while a comparison streams in. Replaces a
// static "Thinking…" with a phase-aware headline (names the model that just
// landed), a rotating flavour line, and a per-model checklist that ticks green
// as each answer arrives — so the top block narrates what aggrai is doing.
function ThinkingStatus({
  modelIds, done, typing, gradientId,
}: {
  modelIds: string[];
  done: string[];      // finished, in completion order (newest last)
  typing: string[];    // currently streaming
  gradientId: string;
}) {
  const total = modelIds.length;
  const doneCount = done.length;
  const allIn = total > 0 && doneCount >= total;

  // Rotate a flavour line every ~2.4s. Deterministic (no Math.random) so it
  // stays stable across the frequent re-renders that streaming triggers.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 2400);
    return () => clearInterval(t);
  }, []);
  const flavors = allIn ? SCORING_FLAVORS : THINKING_FLAVORS;
  const flavor = flavors[tick % flavors.length];

  let headline: string;
  if (allIn) {
    headline = `Gathered all ${total} answers — scoring them now…`;
  } else if (doneCount === 0) {
    headline = `Asking ${total} models…`;
  } else {
    const last = modelLabel(done[done.length - 1]);
    const remaining = total - doneCount;
    headline = `${last} is in — awaiting ${remaining} more…`;
  }

  return (
    <div
      role="status"
      aria-label="Comparing models"
      className="rounded-2xl border border-white/10 bg-surface-2 backdrop-blur-xl shadow-xl flex flex-col items-center justify-center gap-2 min-h-[110px] p-4"
    >
      <Logo height={LOADING_AGGRAI_SIZE} spinning symbolOnly gradientId={gradientId} />
      <p className="text-sm font-medium text-white/80 text-center" aria-live="polite">{headline}</p>
      <p className="text-xs text-white/55 text-center">{flavor}…</p>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
        {modelIds.map((id) => {
          const isDone = done.includes(id);
          const isTyping = !isDone && typing.includes(id);
          return (
            <span
              key={id}
              title={modelLabel(id)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                isDone
                  ? "border-teal-300/40 bg-teal-300/10 text-teal-200"
                  : isTyping
                    ? "border-white/15 bg-surface-2 text-white/70"
                    : "border-white/10 text-white/55"
              }`}
            >
              <ProviderLogo provider={providerOf(id)} className="w-2.5 h-2.5 shrink-0" />
              <span className="max-w-[90px] truncate">{modelLabel(id)}</span>
              {isDone ? (
                <Check className="w-2.5 h-2.5 text-teal-300" aria-hidden="true" />
              ) : isTyping ? (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse" aria-hidden="true" />
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// THE comparison summary — every phase of it, for every caller. The first ask and
// a follow-up ask are the same thing happening twice, so they render through this
// one component rather than two lookalikes that drift apart. They already drifted:
// the follow-up copy never got streaming, the score rail, contributions, or the
// "aggrai's answer" label, because each was added to the original and not to it.
//
// Three phases, one shell, so nothing jumps as they advance:
//   nothing yet          -> ThinkingStatus (per-model checklist)
//   prose arriving       -> the Summary card, typing in (P3d: from ~1s)
//   result landed        -> + contributions, attribution chips, Aggr-Score rail
function SummaryPanel({
  result, partialSummary, models, doneModels, partialAnswers, gradientId,
}: {
  result: Result | null;
  partialSummary: string;
  models: string[];
  doneModels: string[];
  partialAnswers: Record<string, string>;
  gradientId: string;
}) {
  const settled = result?.type === "compare" ? result : null;
  // The prompt asks the summariser for a "## Best answer" heading and it doesn't
  // emit one, so splitSummary returns best=null on real traffic and the whole
  // summary IS the body. Gating on `best` alone would render nothing, ever.
  const text = settled
    ? (splitSummary(settled.summary).best || settled.summary)
    : (splitSummary(partialSummary).best || partialSummary);

  if (!settled && !text.trim()) {
    return (
      <ThinkingStatus
        modelIds={models}
        done={doneModels}
        typing={models.filter(m => partialAnswers[m] != null)}
        gradientId={gradientId}
      />
    );
  }

  // Attribution chips need the finished prose AND the judgement, so they only
  // exist once the result lands; until then plain markdown, no visual change.
  const attrs = settled?.section_attributions ?? [];
  const knownIds = new Set(settled?.answers.map(a => a.model) ?? []);
  const components = attrs.length > 0 ? makeAggraiAnswerComponents(attrs, knownIds) : MARKDOWN_COMPONENTS;

  return (
    // 75/25 — the Aggr-Score rail only needs a compact radar + 5 axis labels; the
    // rewrite wants the width. No rail while streaming, so no grid either: an
    // empty second column just squeezes the prose against dead space.
    <div className={settled ? "grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-4 items-start" : ""}>
      <div
        role={settled ? undefined : "status"}
        aria-label={settled ? undefined : "Writing the summary"}
        className="rounded-2xl border border-white/10 bg-surface-2 backdrop-blur-xl p-6 shadow-xl min-w-0"
      >
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-3.5 h-3.5 text-teal-300" />
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-300/80">Summary</p>
        </div>
        {/* Contributions FIRST — where the rewrite's content came from, before
            the rewrite itself. */}
        {settled?.contributions && settled.contributions.length > 0 && (
          <ContributionsTop contributions={settled.contributions} />
        )}
        <div className="prose prose-sm sm:prose-base prose-invert max-w-none
          prose-h2:text-base prose-h2:font-semibold prose-h2:text-white prose-h2:mt-4 prose-h2:mb-2
          prose-h3:text-sm prose-h3:font-semibold prose-h3:text-white prose-h3:mt-3 prose-h3:mb-2
          prose-ul:my-2 prose-li:my-1 prose-p:my-2 prose-strong:text-white">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-300/80 mb-2 not-prose">
            aggrai&apos;s answer
            <span className="ml-1.5 normal-case tracking-normal text-white/55 font-medium">
              {/* NOT "weighted by score". The rewrite is a separate call that never
                  sees the scores (P3d) — and even before the split it was told to
                  prefer whoever "scored highest for the relevant point", a score
                  that has never existed: accuracy is scored once per ANSWER. It has
                  always judged each point by reading. "Combined from all models" is
                  what actually happens. */}
              {settled ? "· combined from all models" : "· writing…"}
            </span>
          </p>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{text}</ReactMarkdown>
        </div>
      </div>
      {settled && <div className="min-w-0"><ScoresAndMetrics answers={settled.answers} /></div>}
    </div>
  );
}

// AGG-39: the "Searched the web" badge + its sources. Shown when an ask was
// grounded on live results — turns the invisible backend grounding into the
// visible "comparison + research" signal, and gives the models' [1][2] citation
// markers something to point at.
function SearchSources({ info }: { info: { ok: boolean; sources: { title: string; url: string }[] } }) {
  const host = (u: string) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return u; } };
  return (
    <div className="rounded-xl border border-teal-300/20 bg-teal-300/[0.05] px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-teal-200">
        <Globe className="w-3.5 h-3.5" aria-hidden="true" />
        {info.ok && info.sources.length > 0
          ? `Searched the web · ${info.sources.length} source${info.sources.length === 1 ? "" : "s"}`
          : "Searched the web"}
      </div>
      {info.sources.length > 0 && (
        <ol className="mt-2 space-y-1 text-xs">
          {info.sources.map((s, i) => (
            <li key={s.url + i} className="flex gap-2 min-w-0">
              <span className="shrink-0 text-white/55 tabular-nums">[{i + 1}]</span>
              <a href={s.url} target="_blank" rel="noopener noreferrer nofollow"
                className="min-w-0 truncate text-white/60 hover:text-teal-200 transition-colors"
                title={s.title}>
                <span className="text-white/80">{host(s.url)}</span>
                <span className="text-white/55"> — {s.title}</span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// THE per-model raw answers — every caller, so a follow-up's raw answers are the
// same collapsible cards, masonry, "Expand all", runtime/token metadata and
// Truncated chips as the first ask's. They had diverged into compact always-open
// cards on follow-ups; this is the same drift SummaryPanel fixed, one level down.
// Owns its own open/closed set so callers don't thread it through.
function RawAnswers({ answers, streamedText }: {
  answers: Answer[];
  // model -> partial text while a turn is still streaming; answers[] with empty
  // `answer` fall back to it, so a follow-up shows text before the result lands.
  streamedText?: Record<string, string>;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const multi = answers.length > 1;
  const allOpen = multi && open.size === answers.length;
  const toggle = (m: string) => setOpen(prev => {
    const next = new Set(prev);
    if (next.has(m)) next.delete(m); else next.add(m);
    return next;
  });
  // Single answer: no collapse affordance, just show it.
  const isOpen = (m: string) => !multi || open.has(m);

  const renderCard = (a: Answer) => {
    const shown = isOpen(a.model);
    const text = a.answer || streamedText?.[a.model] || "";
    return (
      <div key={a.model} className="rounded-2xl border border-white/10 bg-surface-1 backdrop-blur-xl min-w-0 overflow-hidden">
        <button
          type="button"
          onClick={() => multi && toggle(a.model)}
          aria-expanded={shown}
          className={`w-full flex items-center justify-between gap-2 p-5 text-left transition-colors ${multi ? "hover:bg-surface-1" : "cursor-default"}`}
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white/90 min-w-0">
            <ProviderLogo provider={providerOf(a.model)} className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{modelLabel(a.model)}</span>
            {a.truncated && (
              <span
                title="The provider hit our token cap and the answer was cut off mid-response. Aggr-Score below reflects what was returned, not what the model intended."
                className="shrink-0 inline-flex items-center rounded-md border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-200"
              >
                Truncated
              </span>
            )}
          </span>
          <div className="flex items-center gap-3 text-xs text-white/55 shrink-0">
            {a.runtime_ms > 0 && <span>{(a.runtime_ms / 1000).toFixed(1)}s</span>}
            {a.tokens > 0 && <span>{a.tokens} tok</span>}
            {multi && <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${shown ? "rotate-180" : ""}`} aria-hidden="true" />}
          </div>
        </button>
        {shown && text && (
          <div className="px-5 pb-5 prose prose-sm prose-invert max-w-none prose-p:my-2 prose-strong:text-white
            [&_table]:block [&_table]:overflow-x-auto [&_table]:w-full [&_table]:text-xs
            [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_img]:max-w-full [&_code]:break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/55">Raw answers</p>
        {multi && (
          <button
            type="button"
            onClick={() => setOpen(allOpen ? new Set() : new Set(answers.map(a => a.model)))}
            className="text-xs text-white/50 hover:text-white/80 transition-colors"
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>
      {/* Masonry packs by MEASURED card height so a long answer fills the
          genuinely-shorter column. layoutKey re-measures on every open/close. */}
      <AnswerMasonry answers={answers} renderCard={renderCard} layoutKey={[...open].sort().join("|")} />
    </>
  );
}

// AGG-7 v2: Accuracy first (it's the most consequential dimension),
// Insight last (lowest weight, the "nice to have"). Order here is
// also the order they render in the 5-segment breakdown bar.
// The five numeric rubric dimensions (excludes the optional strengths/
// weaknesses string arrays on Scores, so indexing a score by one of these
// always yields a number).
type ScoreDimension = "accuracy" | "completeness" | "calibration" | "clarity" | "insight";
const SCORE_KEYS: { key: ScoreDimension; label: string }[] = [
  { key: "accuracy",     label: "Accuracy" },
  { key: "completeness", label: "Completeness" },
  { key: "calibration",  label: "Calibration" },
  { key: "clarity",      label: "Clarity" },
  { key: "insight",      label: "Insight" },
];

// AGG-7 v2 / scoring v3: weighted composite of the 5 dimensions (each 0-5,
// itself the mean of 3 sub-criteria) into a single 0-10 headline, plus a
// fatal-flaw cap: if Accuracy ≤ 1.0 (confidently-wrong or fabricated) the
// composite is capped at 4.0 no matter how high the other dims are.
// "A beautifully-written wrong answer is not a good answer."
//
// Weights (sum to 1.0):
//   accuracy     30%   factual correctness, no hallucination
//   completeness 25%   addresses the actual question + evident intent
//   calibration  20%   confidence matches evidence (epistemic honesty)
//   clarity      15%   structure + appropriate length, no padding
//   insight      10%   non-obvious angles, novel framing
//
// Source: research/scoring-metric-2026-05-24.md §4 (composite formula
// + worked examples) and §7.3 (fatal-flaw cap UX).
function overallScore(s: Scores): number {
  // AGGRAI-WEB-9 hotfix: defensive coalesce. Backend filters out score
  // entries with missing sub-dimensions before they reach the client,
  // but if anything sneaks through (older cached responses, future
  // shape drift, etc.) `undefined * 0.30 = NaN` poisons the whole
  // weighted sum and renders as "NaN" in the UI. Coalesce each
  // dim to 0 instead — a missing dim now reads as a 0 contribution
  // rather than a render glitch.
  const acc  = typeof s.accuracy     === 'number' ? s.accuracy     : 0;
  const comp = typeof s.completeness === 'number' ? s.completeness : 0;
  const cal  = typeof s.calibration  === 'number' ? s.calibration  : 0;
  const clar = typeof s.clarity      === 'number' ? s.clarity      : 0;
  const ins  = typeof s.insight      === 'number' ? s.insight      : 0;
  const weighted = acc * 0.30 + comp * 0.25 + cal * 0.20 + clar * 0.15 + ins * 0.10;
  // weighted is 0-5; rescale to a 0-10 headline (one decimal) so the headline
  // sits on the SAME /10 scale as the sub-metrics in the radar. ×2 maps 0-5→0-10.
  const raw = Math.round(weighted * 2 * 10) / 10;
  // Fatal-flaw cap: near-zero Accuracy (≤1.0/5) caps the headline at 4.0/10 so
  // a confidently-wrong answer can't score well on style alone.
  return acc <= 1.0 ? Math.min(raw, 4.0) : raw;
}

// True when the fatal-flaw cap on Accuracy actually changed the
// score (raw > 40 but accuracy ≤ 1.0). Used to surface a "score
// limited — contains factual errors" hint so users understand why
// the badge is low when sub-scores look mixed.
function isAccuracyCapped(s: Scores): boolean {
  if (s.accuracy > 1.0) return false;
  const raw =
    s.accuracy     * 0.30 +
    s.completeness * 0.25 +
    s.calibration  * 0.20 +
    s.clarity      * 0.15 +
    s.insight      * 0.10;
  // raw is 0-5; ×2 → 0-10. Capped iff the uncapped headline would top 4.0/10.
  return Math.round(raw * 2 * 10) / 10 > 4.0;
}

// The summariser produces markdown with a single section:
//   ## Best answer    (a full rewritten answer using all models, weighted
//                      by their scores — see backend summariser prompt)
// We split it out so we can render the Best Answer with a stronger visual
// hierarchy inside the Summary card. Legacy multi-section responses (with
// "Where they agree" / "Where they differ") still parse correctly — best
// answer is everything between the heading and the next "##" or the end.
//
// IMPORTANT: JavaScript regex has NO `\Z` end-of-string assertion (unlike
// Perl). An earlier version of this function used `\Z` in a lookahead;
// JS regex interpreted it as the literal letter Z, so any answer
// containing a Z (e.g. "specialized", "amazing", "size") got truncated
// at the first Z. Procedural string slicing here avoids the trap.
function splitSummary(summary: string): { best: string | null; rest: string } {
  const headerMatch = summary.match(/##\s*Best\s+answer\s*\n/i);
  if (!headerMatch || headerMatch.index === undefined) {
    return { best: null, rest: summary };
  }
  const start = headerMatch.index;
  const afterHeader = start + headerMatch[0].length;
  const remainder = summary.slice(afterHeader);
  // Find next "## " heading after the Best Answer section, if any
  const nextHeadingRel = remainder.search(/\n##\s/);
  if (nextHeadingRel === -1) {
    // No more headings — best answer runs to end of string
    return {
      best: remainder.trim(),
      rest: summary.slice(0, start).trim(),
    };
  }
  const end = afterHeader + nextHeadingRel;
  return {
    best: summary.slice(afterHeader, end).trim(),
    rest: (summary.slice(0, start) + summary.slice(end + 1)).trim(),
  };
}

// (The "Strongest single answer" WinnerBlock was removed — the winner is now
// marked with a trophy next to the top model inside the Aggr-Score block.)

// A single 100% stacked bar at the top of the Summary card showing how much
// each model's content influenced the rewritten Best answer below. Source is
// the summariser's self-reported attribution; values sum to ~100. One bar
// (rather than separate per-model bars) makes the "these add up to a whole"
// relationship obvious at a glance.
//
// Rendered above the Best answer so the reader knows *who's behind this*
// before they read the synthesis — sets context, not a footnote.
function ContributionsTop({ contributions }: { contributions: Contribution[] }) {
  if (contributions.length === 0) return null;
  const sorted = [...contributions].sort((a, b) => b.pct - a.pct);
  // Distinct segment colours so adjacent slices read apart; legend below
  // keys each colour to its model.
  const PALETTE = ["#5eead4", "#60a5fa", "#c084fc", "#fbbf24", "#f472b6"];
  return (
    <div className="mb-5 pb-4 border-b border-white/10">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55 mb-3">
        Where the summary came from
      </p>
      {/* Proportional stacked bar (segments sum to 100%). On wider screens each
          segment is labelled inline (logo + name + %). On narrow screens a name
          can't fit a ~20% slice, so segments show just logo + % (never
          truncated) and the full names move to the wrap-friendly legend below
          (mobile-only — redundant once names are inline). Dark text for contrast
          on the light palette; title attr is the hover fallback either way. */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-lg bg-white/5 sm:h-9">
        {sorted.map(({ model, pct }, i) => (
          <div
            key={model}
            className="flex items-center gap-1 px-1.5 min-w-0 overflow-hidden"
            style={{ width: `${pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
            title={`${modelLabel(model)} · ${pct}%`}
          >
            {/* Labels only on sm+ (smaller text so names don't truncate). Below
                sm the bar is a plain slim colour band and the legend below
                carries every name + %. */}
            <ProviderLogo provider={providerOf(model)} className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
            <span className="hidden truncate text-[11px] font-semibold text-slate-900/85 sm:block">
              {modelLabel(model)}
            </span>
            <span className="ml-auto hidden shrink-0 text-[11px] font-semibold tabular-nums text-slate-900/70 sm:block">
              {pct}%
            </span>
          </div>
        ))}
      </div>
      {/* Full model names — only on narrow screens, where they don't fit inside
          the bar. Wraps cleanly, so it's readable at any width. */}
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5 sm:hidden">
        {sorted.map(({ model, pct }, i) => (
          <div key={model} className="flex items-center gap-1.5 text-xs min-w-0">
            <span
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              aria-hidden="true"
            />
            <ProviderLogo provider={providerOf(model)} className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate text-white/70">{modelLabel(model)}</span>
            <span className="shrink-0 tabular-nums text-white/55">{pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// One radar per scored model, stacked top-down in ranked order. Each radar
// plots the 5 sub-metrics (Accuracy / Completeness / Calibration / Clarity /
// Insight) on 0-10 axes, with that model's overall 0-10 anchored in the
// middle as the punchline number. Per-model lets readers compare shapes
// side-by-side without polygons fighting for the same space.
function ScoresAndMetrics({ answers }: { answers: Answer[] }) {
  // Which models have their strengths/weaknesses detail expanded. Hook must
  // precede the early return below to satisfy the rules of hooks.
  const [openDetail, setOpenDetail] = useState<Set<string>>(new Set());
  const toggleDetail = (model: string) =>
    setOpenDetail(prev => {
      const next = new Set(prev);
      next.has(model) ? next.delete(model) : next.add(model);
      return next;
    });
  const scored = answers.filter((a): a is Answer & { scores: Scores } => !!a.scores);
  if (scored.length === 0) return null;

  const enriched = scored.map(a => ({ ...a, overall: overallScore(a.scores) }));
  const maxOverall = Math.max(...enriched.map(a => a.overall));
  const ranked = [...enriched].sort((a, b) => b.overall - a.overall);

  // Rank-based palette so colour tracks position. Winner = brand teal,
  // ranks 2-5 cycle through blue / purple / amber / pink. Capped at 5
  // because Premium tops out at 5 models per comparison.
  const PALETTE = [
    "#5eead4", // teal-300 — winner
    "#60a5fa", // blue-400
    "#c084fc", // purple-400
    "#fbbf24", // amber-400
    "#f472b6", // pink-400
  ];

  // Per-dimension winner: which model scored highest on each sub-metric,
  // tie-broken by overall score (so a model can't claim a tied metric just by
  // appearing first). Drives the per-radar axis highlight — the multi-radar
  // equivalent of the old "best at X" highlight. Only meaningful with 2+ models.
  const dimWinner: Record<string, string> = {};
  if (scored.length > 1) {
    for (const { key } of SCORE_KEYS) {
      const top = ranked.reduce((p, c) =>
        c.scores[key] > p.scores[key] ||
        (c.scores[key] === p.scores[key] && c.overall > p.overall)
          ? c : p
      );
      dimWinner[key] = top.model;
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-surface-2 backdrop-blur-xl p-6 shadow-xl">
      <div className="mb-5 flex items-center gap-x-2 gap-y-1 flex-wrap">
        <BarChart3 className="w-3.5 h-3.5 text-teal-300 shrink-0" />
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-300/80 whitespace-nowrap">
          Aggr-Score
        </p>
        <span className="text-[11px] text-white/55">judged by Haiku · all scores 0–10</span>
      </div>

      {/* Radars: a 2-up grid when this block spans full width (tablet, md–lg),
          stacked top-to-bottom both on mobile (too narrow for two) and in the
          narrow desktop rail (lg+, where it sits beside the summary). items-start
          so an expanded strengths/weaknesses panel grows only its own cell and
          never stretches or overlaps its neighbour. */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2 lg:grid-cols-1 items-start">
        {ranked.map((a, i) => {
          const color = PALETTE[i % PALETTE.length];
          const isWinner = a.overall === maxOverall;
          // Backend stores 0-5; UI surfaces 0-10. Doubling at the data
          // boundary keeps overallScore() unchanged + means no cache
          // invalidation for previously-judged comparisons.
          const data = SCORE_KEYS.map(({ key, label }) => ({
            dim: label,
            value: (typeof a.scores[key] === "number" ? a.scores[key] : 0) * 2,
          }));
          const valueByDim: Record<string, number> = Object.fromEntries(
            data.map(d => [d.dim, d.value]),
          );
          // Sub-metric labels this model wins outright — highlighted in its
          // radar colour + bold on the axis, so you can see at a glance which
          // model was best at what.
          const winLabels = new Set(
            SCORE_KEYS.filter(k => dimWinner[k.key] === a.model).map(k => k.label),
          );
          // Custom axis tick: the dimension name plus its 0-10 sub-score in
          // grey just below it, so each radar shows the exact numbers, not
          // just the polygon shape. A winning dimension is drawn in the
          // model's colour + bold. payload.value is the dim string.
          const renderAxisTick = (props: {
            payload: { value: string }; x: number; y: number; cy: number;
            textAnchor: "start" | "middle" | "end" | "inherit";
          }) => {
            const { payload, x, y, cy, textAnchor } = props;
            const v = valueByDim[payload.value];
            const isWin = winLabels.has(payload.value);
            // Two-line label: dimension name, then its 0-10 score one line
            // below. At the top vertex "below" points inward, so the score
            // would land on the polygon's top point. textAnchor "middle" +
            // sitting above the centre uniquely identifies that top label
            // (the side labels are start/end), so lift it one line up into
            // the headroom above — the score then occupies the (already
            // clear) spot the name held, and the name moves further out.
            const topVertex = textAnchor === "middle" && y < cy;
            const nameY = topVertex ? y - 11 : y;
            const scoreY = nameY + 11;
            return (
              <g>
                <text x={x} y={nameY} textAnchor={textAnchor} dominantBaseline="central" fontSize={10} fontWeight={isWin ? 700 : 400} fill={isWin ? color : "rgba(255,255,255,0.55)"}>
                  {payload.value}
                </text>
                <text x={x} y={scoreY} textAnchor={textAnchor} dominantBaseline="central" fontSize={9} fontWeight={isWin ? 700 : 400} fill={isWin ? color : "rgba(255,255,255,0.38)"}>
                  {typeof v === "number" ? v.toFixed(1) : "—"}
                </text>
              </g>
            );
          };
          const detailOpen = openDetail.has(a.model);
          const hasDetail =
            (a.scores.strengths?.length ?? 0) + (a.scores.weaknesses?.length ?? 0) > 0;
          return (
            <div key={a.model} className="space-y-2 min-w-0">
              {/* Header: colour swatch ties this header to the polygon
                  below; Limited badge surfaces the accuracy fatal-flaw
                  cap when it has been applied; Winner tag marks the
                  top score. */}
              <div className="flex items-center gap-2 text-xs min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <ProviderLogo provider={providerOf(a.model)} className="w-3.5 h-3.5 shrink-0" />
                {isWinner && (
                  <Trophy className="w-3.5 h-3.5 text-teal-300 shrink-0" aria-label="Winner — highest overall score" />
                )}
                <span className="font-medium text-white/90 flex-1 truncate">{modelLabel(a.model)}</span>
                {isAccuracyCapped(a.scores) && (
                  <span
                    title="Score limited — contains factual errors. Accuracy ≤ 1.0 caps the overall quality at 40."
                    className="shrink-0 inline-flex items-center rounded-md border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-200"
                  >
                    Limited
                  </span>
                )}
                {/* Little +/− to reveal this model's strengths/weaknesses.
                    Only shown when the summariser actually produced critique
                    bullets (older cached |s4 responses have none). The radar
                    below is also clickable as a larger target. */}
                {hasDetail && (
                  <button
                    type="button"
                    onClick={() => toggleDetail(a.model)}
                    aria-expanded={detailOpen}
                    aria-label={detailOpen ? `Hide ${modelLabel(a.model)} detail` : `Show ${modelLabel(a.model)} detail`}
                    className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-md border border-white/15 bg-white/5 text-white/60 hover:text-white hover:border-white/30 transition-colors"
                  >
                    {detailOpen ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  </button>
                )}
              </div>

              {/* Radar — position:relative so the overall 0-10 can be
                  absolutely centred on top. When this model has critique
                  detail, the whole radar is a clickable target that toggles
                  the strengths/weaknesses panel (keyboard-accessible too),
                  mirroring the +/− button. pointer-events-none on the centre
                  overlay lets clicks fall through to this wrapper. */}
              <div
                className={`relative ${hasDetail ? "cursor-pointer rounded-xl hover:bg-surface-1 transition-colors" : ""}`}
                role={hasDetail ? "button" : undefined}
                tabIndex={hasDetail ? 0 : undefined}
                aria-expanded={hasDetail ? detailOpen : undefined}
                aria-label={hasDetail ? `${detailOpen ? "Hide" : "Show"} ${modelLabel(a.model)} detail` : undefined}
                onClick={hasDetail ? () => toggleDetail(a.model) : undefined}
                onKeyDown={hasDetail ? (e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleDetail(a.model); }
                } : undefined}
              >
                <ResponsiveContainer width="100%" height={184}>
                  <RadarChart data={data} outerRadius="58%">
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis dataKey="dim" tick={renderAxisTick} />
                    <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                    <Radar
                      name={modelLabel(a.model)}
                      dataKey="value"
                      stroke={color}
                      fill={color}
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div
                    className="text-2xl font-semibold tabular-nums leading-none"
                    style={{ color }}
                  >
                    {a.overall.toFixed(1)}
                  </div>
                </div>
              </div>

              {/* Expanded detail — the answer's pros and cons, judged by the
                  summariser. Strengths in teal, weaknesses in amber. */}
              {openDetail.has(a.model) && (
                <div className="rounded-lg border border-white/10 bg-surface-1 p-3 space-y-2.5 text-xs">
                  {(a.scores.strengths?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-300/80 mb-1.5">Strengths</p>
                      <ul className="space-y-1">
                        {a.scores.strengths!.map((s, j) => (
                          <li key={j} className="flex gap-1.5 text-white/70 leading-snug">
                            <Plus className="w-3 h-3 mt-0.5 shrink-0 text-teal-300/80" aria-hidden="true" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(a.scores.weaknesses?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300/80 mb-1.5">Weaknesses</p>
                      <ul className="space-y-1">
                        {a.scores.weaknesses!.map((w, j) => (
                          <li key={j} className="flex gap-1.5 text-white/70 leading-snug">
                            <Minus className="w-3 h-3 mt-0.5 shrink-0 text-amber-300/80" aria-hidden="true" />
                            <span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Two-column masonry for the raw answer cards, packed by MEASURED rendered
// height — not an estimate. Earlier we guessed height from answer character
// count, but a heading/list-heavy answer renders far taller than its length
// implies, so two long answers piled into one column. Here we measure each
// card's actual offsetHeight and pack longest-first into the genuinely-shorter
// column (the "longest processing time" bin-packing heuristic), which keeps
// the two columns close in height regardless of content shape.
//
// Heights are column-independent (both columns are equal width), so measuring
// once is stable — no measure↔reflow loop. Re-measures when the answer set or
// the expand/collapse state changes (layoutKey). Single column on mobile.
function AnswerMasonry({
  answers,
  renderCard,
  layoutKey,
}: {
  answers: Answer[];
  renderCard: (a: Answer) => React.ReactNode;
  layoutKey: string;
}) {
  const [twoCol, setTwoCol] = useState(false);
  const [assign, setAssign] = useState<Record<string, 0 | 1>>({});
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setTwoCol(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!twoCol || answers.length < 2) return;
    // Longest-first: assign each card (tallest down) to the shorter column.
    const order = [...answers].sort(
      (a, b) => (refs.current[b.model]?.offsetHeight ?? 0) - (refs.current[a.model]?.offsetHeight ?? 0),
    );
    const h = [0, 0];
    const next: Record<string, 0 | 1> = {};
    for (const a of order) {
      const t = h[0] <= h[1] ? 0 : 1;
      next[a.model] = t;
      h[t] += refs.current[a.model]?.offsetHeight ?? 0;
    }
    setAssign(prev => (answers.every(a => prev[a.model] === next[a.model]) ? prev : next));
  }, [answers, layoutKey, twoCol]);

  const setRef = (model: string) => (el: HTMLDivElement | null) => { refs.current[model] = el; };

  // Single answer, or mobile → one column in source order.
  if (answers.length <= 1 || !twoCol) {
    return (
      <div className="space-y-4">
        {answers.map(a => (
          <div key={a.model} ref={setRef(a.model)}>{renderCard(a)}</div>
        ))}
      </div>
    );
  }

  // Desktop: two columns. Until the first measure runs, fall back to index
  // parity so the first paint is already roughly balanced (no all-in-one-column
  // flash). Each column keeps source order among its assigned cards.
  const placed = answers.map((a, idx) => ({ a, col: assign[a.model] ?? ((idx % 2) as 0 | 1) }));
  const columns: Answer[][] = [
    placed.filter(p => p.col === 0).map(p => p.a),
    placed.filter(p => p.col === 1).map(p => p.a),
  ];
  return (
    <div className="grid grid-cols-2 gap-4 items-start">
      {columns.map((col, i) => (
        <div key={i} className="space-y-4 min-w-0">
          {col.map(a => (
            <div key={a.model} ref={setRef(a.model)}>{renderCard(a)}</div>
          ))}
        </div>
      ))}
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
  const pathname = usePathname();

  // Resolve the initial conversation context. Three possible sources, in
  // priority order:
  //   1. /app/c/{id}  — V1 short id, looked up in sessionStorage
  //   2. ?q= & ?models=  — legacy query-string URL (kept for backwards
  //      compat with any existing /app links + recents)
  //   3. plain /app  — empty state, user types from scratch
  // This means a refresh on /app/c/{id} restores the original question +
  // model selection, and old /app?q=... links never break.
  const urlConvId = pathname?.match(/^\/app\/c\/([^/]+)$/)?.[1] ?? null;
  const convFromStorage = urlConvId ? loadConv(urlConvId) : null;
  const initialQuestion = convFromStorage?.question ?? searchParams.get("q") ?? "";
  // Explicit models from either source, or null if the user came in
  // without specifying any (in which case the tier defaults below kick in
  // once useTier resolves).
  const explicitModels: Set<string> | null = convFromStorage?.models
    ? new Set(convFromStorage.models)
    : parseModelsParam(searchParams.get("models"));
  // If a previous submission saved its result to the conv payload, hydrate
  // it as the initial result so a refresh on /app/c/{id} renders the
  // answer instantly with zero API calls. We type-cast from `unknown`
  // because the full Result shape lives in this file and would create a
  // circular import if we typed it in lib/conv-id.ts.
  const initialResult = (convFromStorage?.result as Result | undefined) ?? null;

  const { tier, resolved: tierResolved } = useTier();
  const [question, setQuestion] = useState(initialQuestion);
  // The question that's currently in flight. `question` (the input) is cleared
  // on submit, so we stash the submitted text here to show "You asked: …" above
  // the loading skeleton, matching the loaded result header.
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [allModels, setAllModels] = useState<ModelEntry[]>(FALLBACK_MODELS);
  // Backend-authored defaults (delisted models already swapped for siblings).
  // Static TIER_DEFAULTS is the pre-fetch fallback; /api/models overrides it.
  const [tierDefaults, setTierDefaults] = useState<Record<Tier, string[]>>(TIER_DEFAULTS);
  const [selected, setSelected] = useState<Set<string>>(explicitModels ?? new Set(TIER_DEFAULTS.free));
  const [loading, setLoading] = useState(false);
  const [intentHint, setIntentHint] = useState<"compare" | "product" | "direct" | null>(null);
  const [result, setResult] = useState<Result | null>(initialResult);
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

  // ── Conversation continuation (Phase 5a) ──────────────────────────────────
  // A single-model follow-up thread rendered BELOW the turn-1 comparison. Each
  // Followup is one exchange: the user's question + the chosen model's answer,
  // streamed from /api/converse. Signed-in only (the thread lives in Supabase).
  type Followup = {
    id: string;
    userTurn: number;      // message-row turn for the question
    asstTurn: number;      // message-row turn for the answer
    question: string;
    mode: "single" | "compare";
    modelId: string;       // single mode: the model that answered
    answer: string;        // single mode: its answer text
    result: Result | null; // compare mode: the full comparison Result
    streaming: boolean;
    error: string | null;
    // Compare mode, while streaming. The backend has always emitted per-model
    // answer-chunks here (and summary-chunks since the P3d split), but this
    // handler discarded every one of them and waited for `result` — which is why
    // a compare follow-up sat on a static "Comparing models…" for its whole run
    // while the main /ask page, fed by the identical events, showed live
    // progress. Nobody caught it because compare follow-ups 400'd at the proxy
    // and never once reached this code.
    models: string[];                      // who was asked (known before any reply)
    partialAnswers: Record<string, string>; // model -> text so far
    doneModels: string[];                   // finished, in completion order
    partialSummary: string;                 // the rewrite, streaming
    // AGG-39 D-converse: this turn's live-search grounding, if any. Per-follow-up
    // (not the page-level searchInfo) — each turn searches independently, so the
    // sources shown must belong to that turn, not the first ask.
    searchInfo: { ok: boolean; sources: { title: string; url: string }[] } | null;
  };
  const [activeConvId, setActiveConvId] = useState<string | null>(urlConvId);
  const [followups, setFollowups] = useState<Followup[]>([]);
  // AGG-44: share-link state — the created public URL + an in-flight flag.
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  // Brief "Copied!" flash when the share link is (re-)copied.
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [followupModel, setFollowupModel] = useState<string | null>(null);  // null → winner
  // Which models a follow-up goes to. Empty = "not chosen yet", which resolves to
  // the winner (see selectedFollowupModels) — so the default costs no effect and
  // no seeding. The backend has always accepted an arbitrary models[] subset;
  // "1 or all" was a frontend limitation, never a product one.
  const [followupModels, setFollowupModels] = useState<Set<string>>(new Set());
  const [followupInput, setFollowupInput] = useState("");
  const [followupLoading, setFollowupLoading] = useState(false);
  // Which follow-up turns are expanded. Older turns collapse to a one-line
  // question header once a newer turn arrives, so the thread stays tidy; the
  // newest (and any streaming) turn is always open. A turn can be re-opened.
  const [expandedFollowups, setExpandedFollowups] = useState<Set<string>>(new Set());
  // The original turn-1 comparison also collapses to a one-line header once the
  // user has continued (it's a historical turn then); expanded when there are no
  // follow-ups, or when the user re-opens it.
  const [comparisonExpanded, setComparisonExpanded] = useState(true);
  const toggleFollowup = (id: string) =>
    setExpandedFollowups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const followupAbortRef = useRef<AbortController | null>(null);

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
    // Anonymous session recents can't be continued (no RLS-scoped thread).
    setActiveConvId(null);
    setFollowups([]);
    setFollowupModel(null);
    setSelected(new Set(found.models));
    // Mark as user-chosen so the tier-defaults sync effect doesn't clobber
    // the restored selection on the next render (e.g. if useTier resolves
    // a different tier right after we restore).
    userOwnsSelection.current = true;
    setError("");
    setIntentHint(null);
    setSidebarOpen(false);
    // Scroll back to the top of the document — without this, after the
    // AGG-38 body-scroll refactor the user who's scrolled mid-answer
    // and taps a recent would end up viewing the new result from a
    // random scroll depth.
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
  const [showUpgradedBanner, setShowUpgradedBanner] = useState(searchParams.get("upgraded") === "1");
  const [signedIn, setSignedIn] = useState(false);
  // Per-model raw answers are collapsed by default. User clicks a card header
  // to expand. Reset whenever a fresh result lands so a new question starts
  // with everything collapsed again.
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());
  // Streaming partial answers. Backend sends a `stage: "answer"` event
  // as each model returns, ahead of the slowest model + summariser.
  // We render each one expanded so the user can read it immediately
  // instead of staring at skeleton boxes for the full ~15s.
  // Cleared when the final `stage: "result"` event lands; the result
  // render path then takes over with the canonical answers (which also
  // include the summariser's per-model scores).
  const [streamingAnswers, setStreamingAnswers] = useState<Answer[]>([]);
  // Per-model partial text being typed in token-by-token. The backend
  // emits `stage: "answer-chunk"` events with each `delta` straight from
  // OpenRouter's SSE stream, so this updates ~10-100 times per model
  // during a real generation. Promoted into streamingAnswers (and
  // cleared from here) when the model's full `stage: "answer"` event
  // lands with metadata (token count, runtime, truncated flag).
  const [partialAnswers, setPartialAnswers] = useState<Record<string, string>>({});
  // The summariser's "Best answer" prose, typed in as it's written. It runs LAST
  // and takes ~26s, so before this the user watched a spinner for that whole
  // stretch with every model answer already on screen. The backend digs the
  // "summary" field out of the JSON envelope mid-stream and sends it as
  // `stage: "summary-chunk"`; `reset: true` means a keystone fallback restarted
  // the envelope and this partial is dead text. Replaced by the canonical
  // summary when `result` lands.
  const [partialSummary, setPartialSummary] = useState<string>("");
  // AGG-39 web search: the sources this ask was grounded on. Set from the
  // backend's stage:'search' event (fires before the answers when the classifier
  // flagged a recency question). null = no search this ask. Live-only for now —
  // not persisted in the stored result, so it shows on a fresh ask, not a reload.
  const [searchInfo, setSearchInfo] = useState<{ ok: boolean; sources: { title: string; url: string }[] } | null>(null);
  // When the final result lands we collapse all per-model blocks so the
  // user's eye goes straight to the summary. The streaming-answer
  // handler below re-expands individual blocks as their answers arrive.
  useEffect(() => { setExpandedAnswers(new Set()); }, [result]);
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const followupInputRef = useRef<HTMLTextAreaElement | null>(null);  // Phase 5a continuation composer
  // Reference to the mobile menu button so the AppSidebar can restore
  // focus here when the drawer closes (a11y — Escape, X click, backdrop).
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  // AbortController for the in-flight /api/ask fetch. Lets the user
  // click Stop to cancel mid-stream — the fetch reader throws
  // AbortError, the catch below detects it and skips the Sentry
  // report (it's not an actual failure). Cleared after every request
  // (whether it completed or was aborted) so we don't accidentally
  // abort the next one.
  const abortRef = useRef<AbortController | null>(null);

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
  const userOwnsSelection = useRef(explicitModels !== null);

  // Whenever the tier resolves, snap the default selection to that tier's
  // defaults — unless the user has explicitly chosen models.
  useEffect(() => {
    if (userOwnsSelection.current) return;
    setSelected(new Set(tierDefaults[tier]));
  }, [tier, tierDefaults]);

  function handleSelectionChange(next: Set<string>) {
    userOwnsSelection.current = true;
    setSelected(next);
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    createClient().auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  // ── Cross-device history (signed-in users) ────────────────────────────────
  // Persistent Supabase mirror of the sidebar recents. Anonymous users keep the
  // sessionStorage sessionRecents above; this only activates when signed in.
  const [dbRecents, setDbRecents] = useState<ConvRow[]>([]);

  // Load the user's saved history when they sign in.
  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    // R2 #9: fold this browser's anonymous recents (sessionStorage) into the
    // account on sign-in, THEN load history so the just-claimed convs show up
    // immediately. Best-effort + idempotent (upsert by conv id).
    claimAnonRecents()
      .then(() => listConversations(30))
      .then(rows => { if (alive) setDbRecents(rows); });
    return () => { alive = false; };
  }, [signedIn]);

  // Share fork on arrival: a signed-out viewer who clicked "Continue" on a
  // /share link was routed through signup with ?fork=<shareId>. Now that they're
  // signed in, fork that share into their own thread and jump to it (runs once).
  const forkHandled = useRef(false);
  useEffect(() => {
    if (!signedIn || forkHandled.current) return;
    const forkId = searchParams.get("fork");
    if (!forkId) return;
    forkHandled.current = true;
    fetch(`/api/share/${encodeURIComponent(forkId)}/fork`, { method: "POST" })
      .then(r => r.json())
      .then(d => {
        if (d?.conversationId && typeof window !== "undefined") {
          window.location.replace(`/app/c/${d.conversationId}`);
        } else if (typeof window !== "undefined") {
          window.history.replaceState(null, "", "/app");   // clear ?fork= on failure
        }
      })
      .catch(() => {
        if (typeof window !== "undefined") window.history.replaceState(null, "", "/app");
      });
  }, [signedIn, searchParams]);

  // The "Shared" link belongs to the conversation you shared — clear it when the
  // active conversation changes (click a recent / new comparison / new ask) so a
  // stale share URL doesn't linger on the next conversation.
  useEffect(() => { setShareUrl(null); }, [activeConvId, activeRecentId]);

  // Restoring /app/c/{id} on load. Two things live in two places: the ORIGINAL
  // comparison (turns 0-1) is cached in sessionStorage AND in Supabase; the
  // FOLLOW-UP turns (2+) live only in Supabase. So sessionStorage having the
  // comparison must not skip the thread fetch — that was the refresh bug: the
  // original rendered from storage while every follow-up silently vanished,
  // yet clicking the same conversation in Recents (which always fetches) showed
  // them. Fetch the comparison only when it ISN'T cached; fetch the thread
  // always.
  useEffect(() => {
    if (!signedIn || !urlConvId) return;
    let alive = true;
    if (!convFromStorage) {
      loadConversation(urlConvId).then(conv => {
        if (!alive || !conv) return;
        setQuestion(conv.question);
        if (conv.models.length) { setSelected(new Set(conv.models)); userOwnsSelection.current = true; }
        if (conv.result) setResult(conv.result as Result);
      });
    }
    // The thread is Supabase-only, so always fetch it — cached comparison or not.
    // Marking this the active conversation/recent rides in the thread callback so
    // the state writes stay inside the async path (same shape as selectDbRecent).
    listThread(urlConvId).then(msgs => {
      if (!alive) return;
      setActiveConvId(urlConvId);
      setActiveRecentId(urlConvId);
      const f = toFollowups(msgs);
      setFollowups(f);
      setExpandedFollowups(new Set(f.length ? [f[f.length - 1].id] : []));
      setComparisonExpanded(f.length === 0);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, urlConvId]);

  // Restore a Supabase history item clicked in the sidebar — loads the full
  // payload and hydrates in place (no remount), mirroring selectRecent().
  async function selectDbRecent(id: string) {
    const conv = await loadConversation(id);
    if (!conv) return;
    setActiveRecentId(id);
    setQuestion(conv.question);
    setSelected(new Set(conv.models));
    userOwnsSelection.current = true;
    if (conv.result) setResult(conv.result as Result);
    setError("");
    setIntentHint(null);
    setSidebarOpen(false);
    // Restore the follow-up thread (Phase 5a).
    setActiveConvId(id);
    setFollowups([]);
    setFollowupModel(null);
    listThread(id).then(msgs => {
      const f = toFollowups(msgs);
      setFollowups(f);
      setExpandedFollowups(new Set(f.length ? [f[f.length - 1].id] : []));
      setComparisonExpanded(f.length === 0);
    });
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/app/c/${id}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const maxModels = maxModelsForTier(tier);
  const lockedIds = lockedModelIds(tier, allModels);

  useEffect(() => {
    fetch("/api/models")
      .then(r => r.json())
      .then((d: { models?: ModelEntry[]; tierDefaults?: Record<Tier, string[]> }) => {
        if (Array.isArray(d.models) && d.models.length > 0) {
          setAllModels(d.models);
          setModelLabels(d.models);
        }
        // Backend ships HEALED defaults (delisted swapped for siblings); adopt
        // them so the picker pre-selects working models.
        if (d.tierDefaults) setTierDefaults(d.tierDefaults);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // If the URL's conv payload already carried a previously-rendered
    // result (refresh on /app/c/{id} after a successful submit), we've
    // hydrated `result` synchronously above — no API call needed.
    if (initialResult) {
      autoSubmitted.current = true;
      return;
    }
    if (!initialQuestion || autoSubmitted.current) return;

    // Fast path: if we have explicit models from either source
    // (sessionStorage via /app/c/{id} OR ?models= query string), we can
    // fire immediately without waiting for Supabase to resolve the
    // user's tier. This shaves ~200-500ms off the auto-submit latency
    // for the most common /app entry point (landing-page sample-
    // question click).
    if (explicitModels && explicitModels.size > 0) {
      autoSubmitted.current = true;
      setQuestion(initialQuestion);
      // Reuse the existing url id when on /app/c/{id} so we don't
      // generate a fresh one for a refresh (which would rotate the
      // URL on every reload).
      submitQuestion(initialQuestion, explicitModels, urlConvId ?? undefined);
      return;
    }

    // Slow path: no explicit models → auto-submit with tier defaults.
    // Must wait for useTier to actually settle, otherwise a signed-in
    // Pro/Premium user opening /app?q=... would briefly hit Free
    // defaults before their real tier resolves a moment later (AGG-37
    // #H10). Anonymous users + Supabase-not-configured both flip
    // `tierResolved` true immediately, so they're unaffected.
    if (!tierResolved) return;
    autoSubmitted.current = true;
    setQuestion(initialQuestion);
    submitQuestion(initialQuestion, new Set(tierDefaults[tier]), urlConvId ?? undefined);
    // submitQuestion + setQuestion are stable closures over this render;
    // we want this effect to fire exactly once on the relevant trigger
    // (mount when explicitModels is set, or tierResolved flip otherwise).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierResolved]);

  // Keep the selection valid for the current tier — trims flagship models /
  // excess count from a stale URL or after a tier change.
  useEffect(() => {
    const locked = lockedModelIds(tier, allModels);
    // Drop models the backend reports as delisted so a dead default / URL pick
    // isn't submitted (it's already absent from the picker list too).
    const unavailable = new Set(allModels.filter(m => m.available === false).map(m => m.id));
    const cap = maxModelsForTier(tier);
    setSelected(prev => {
      const valid = [...prev].filter(id => !locked.has(id) && !unavailable.has(id)).slice(0, cap);
      if (valid.length === prev.size) return prev;
      return new Set(valid.length > 0 ? valid : tierDefaults[tier]);
    });
  }, [tier, allModels, tierDefaults]);

  async function submitQuestion(q: string, models: Set<string>, reuseConvId?: string) {
    // URL bookkeeping: every submit lives at a clean /app/c/{id} URL so
    // the question + model selection don't show in the address bar (or
    // anyone's screen-share). When the auto-submit effect is restoring
    // an existing /app/c/{id} on page load, we pass the existing id
    // through (reuseConvId) so the URL doesn't rotate. User-typed
    // submissions get a fresh id every time. We hoist the id out so the
    // post-result block below can update the conv payload with the
    // final result — that makes a refresh on /app/c/{id} restore the
    // rendered answer instantly without re-firing /api/ask.
    let convId: string | null = null;
    if (typeof window !== "undefined") {
      convId = reuseConvId ?? generateConvId();
      storeConv(convId, { question: q, models: [...models] });
      if (!reuseConvId) {
        window.history.replaceState(null, "", `/app/c/${convId}`);
      }
    }

    // Local cache check: if this exact (question, models) combo is in our
    // session-recents, restore that result instead of hitting the API.
    // Saves a round-trip + a real LLM cost when the user re-submits an
    // already-asked question (e.g. clicking a recent then pressing Enter
    // without changing anything).
    const qNorm = q.trim().toLowerCase();
    const modelsKey = [...models].sort().join(",");
    const cached = sessionRecents.find(r =>
      r.question.trim().toLowerCase() === qNorm &&
      [...r.models].sort().join(",") === modelsKey
    );
    if (cached) {
      setResult(cached.result);
      setActiveRecentId(cached.id);
      setQuestion("");
      setError("");
      setIntentHint(null);
      return;
    }

    const startedAt = Date.now();
    setLoading(true);
    setPendingQuestion(q);
    setResult(null);
    setStreamingAnswers([]);
    setPartialAnswers({});
    setPartialSummary("");
    setSearchInfo(null);
    setError("");
    setIntentHint(null);
    setQuestion("");
    // Fresh AbortController for this request so stopGeneration() can
    // cancel it. We don't reuse across requests (an aborted controller
    // stays aborted).
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const anonId = getAnonId();
      const sessionId = getSessionId();
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(anonId ? { "x-aggrai-anon-id": anonId } : {}),
          ...(sessionId ? { "x-aggrai-session-id": sessionId } : {}),
        },
        // P6b root-link: pass the conversation short-id so the backend stamps the
        // root questions row (turn 1) → a thread reconstructs from `questions` alone.
        body: JSON.stringify({ question: q.trim(), models: [...models], ...(convId ? { conversation_id: convId } : {}) }),
        signal: controller.signal,
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

          if (evt.stage === "search") {
            // AGG-39: the ask was grounded on live web results — capture the
            // sources so the result can show a "Searched the web" badge.
            setSearchInfo({ ok: evt.ok !== false, sources: Array.isArray(evt.sources) ? evt.sources as { title: string; url: string }[] : [] });
          } else if (evt.stage === "intent" && (evt.intent === "compare" || evt.intent === "product" || evt.intent === "direct")) {
            setIntentHint(evt.intent);
          } else if (evt.stage === "summary-chunk") {
            if (evt.reset) setPartialSummary("");
            else setPartialSummary(prev => prev + String(evt.delta ?? ""));
          } else if (evt.stage === "answer-chunk") {
            // Real-time token delta from the LLM (via backend SSE).
            // Append to that model's partial text — the loading-state
            // render below shows the partial as it grows, so the
            // user sees the answer typing in word-by-word.
            const model = String(evt.model ?? "");
            const delta = String(evt.delta ?? "");
            if (model && delta) {
              setPartialAnswers(prev => ({
                ...prev,
                [model]: (prev[model] ?? "") + delta,
              }));
              setExpandedAnswers(prev => {
                if (prev.has(model)) return prev;
                const next = new Set(prev);
                next.add(model);
                return next;
              });
            }
          } else if (evt.stage === "answer") {
            // Backend has streamed a single model's answer ahead of the
            // summariser. Add it to streamingAnswers + auto-expand so
            // the user can start reading immediately. The result event
            // below replaces this with the scored/canonical version.
            const partial: Answer = {
              model: String(evt.model ?? ""),
              answer: String(evt.answer ?? ""),
              runtime_ms: Number(evt.runtime_ms ?? 0),
              tokens: Number(evt.tokens ?? 0),
              cost_usd: typeof evt.cost_usd === "number" ? evt.cost_usd : null,
              truncated: evt.truncated === true,
              scores: null,
            };
            setStreamingAnswers(prev => [...prev, partial]);
            setExpandedAnswers(prev => {
              const next = new Set(prev);
              next.add(partial.model);
              return next;
            });
            // The streamed partial is now superseded by the final
            // answer event's metadata-carrying version. Drop it so the
            // render doesn't double-account.
            setPartialAnswers(prev => {
              if (!(partial.model in prev)) return prev;
              const next = { ...prev };
              delete next[partial.model];
              return next;
            });
          } else if (evt.stage === "result") {
            const { stage: _s, ...rest } = evt;
            void _s;
            pendingResult = rest as unknown as StreamedResult;
            // Streaming partials are now superseded by result.answers
            // (which carry the summariser's scores too). Clearing here
            // avoids a momentary double-render of the same model's card.
            setStreamingAnswers([]);
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
        // A fresh comparison starts a fresh continuation thread (Phase 5a).
        setActiveConvId(convId ?? null);
        setFollowups([]);
        setFollowupModel(null);
        // Capture into session recents so the sidebar shows it and the
        // user can jump back to this comparison without re-querying.
        pushRecent(q.trim(), models, pendingResult);
        // Re-store the conv payload with the full result so a refresh
        // on /app/c/{id} hydrates the rendered answer synchronously
        // (no /api/ask call, no loading skeleton, no streaming
        // re-animation). Without this, the auto-submit useEffect would
        // race with sessionRecents hydration and the user would see
        // the question "re-load" as if it was new.
        if (convId) {
          storeConv(convId, {
            question: q.trim(),
            models: [...models],
            result: pendingResult,
          });
        }
        // Signed-in users: mirror to Supabase for persistent, cross-device
        // history. Best-effort (never blocks the result) + optimistically
        // surface it in the sidebar without a re-fetch.
        if (signedIn && convId) {
          // saveConversation writes the conversation row (question + result) —
          // the backend reads turns 0/1 from THAT (reliable), so we don't seed
          // message rows here (they FK to conversations and can lose the write
          // race). Only follow-ups (turn ≥ 2) are written, by submitContinuation.
          void saveConversation(convId, { question: q.trim(), models: [...models], result: pendingResult });
          setDbRecents(prev => [
            { id: convId, title: q.trim(), question: q.trim(), created_at: new Date().toISOString() },
            ...prev.filter(r => r.id !== convId),
          ].slice(0, 30));
        }
      } else {
        throw new Error("Empty response from server");
      }
    } catch (err: unknown) {
      // User-initiated abort (clicked Stop) — not a real error. Skip
      // Sentry, leave the partial answers visible, just exit the
      // loading state cleanly.
      const isAbort =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError");
      if (!isAbort) {
        // Report handled failures — this is the path the user actually sees
        Sentry.captureException(err, { tags: { feature: "ask" } });
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setLoading(false);
      setIntentHint(null);
      abortRef.current = null;
    }
  }

  // Cancel the in-flight /api/ask request. Whatever has streamed in so
  // far (partial answers, completed model answers without summariser)
  // stays on screen — we don't want to discard work the user just sat
  // through. Matches ChatGPT's "stop generating" semantics.
  function stopGeneration() {
    abortRef.current?.abort();
    // abortRef.current is cleared in the finally block of submitQuestion
    // once the rejection unwinds.
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    await submitQuestion(question, selected);
  }

  // ── Continuation handlers (Phase 5a) ──────────────────────────────────────
  // The comparison that drives the "continue" bar — its models, winner trophy,
  // and default target. It's the MOST RECENT compare turn (an "ask all again"
  // follow-up), else the root. Turn 1's winner isn't the conversation's current
  // winner once a later turn re-scored the models, so keying off `result` (the
  // root) left the trophy stuck on turn 1's winner. Single-model follow-ups don't
  // re-run a comparison, so they don't change this.
  function latestComparison(): Extract<Result, { type: "compare" }> | null {
    for (let i = followups.length - 1; i >= 0; i--) {
      const f = followups[i];
      if (f.mode === "compare" && f.result?.type === "compare") return f.result;
    }
    return result?.type === "compare" ? result : null;
  }

  // The model set for the WHOLE conversation = the ROOT question's comparison.
  // The candidate chips + "All" key off this so the number of models the user
  // started with stays constant across the thread — a subset "ask all" turn (or
  // whichever model won) never permanently drops a model. winnerModel()/scores
  // still track latestComparison() so the trophy reflects the current winner.
  function rootComparison(): Extract<Result, { type: "compare" }> | null {
    return result?.type === "compare" ? result : latestComparison();
  }

  // The winner = the highest Aggr-Score answer of the latest comparison; the
  // default "Continue with X".
  function winnerModel(): string | null {
    const c = latestComparison();
    if (!c || !c.answers.length) return null;
    const sc = (a: Answer) => (a.scores ? overallScore(a.scores) : 0);
    return [...c.answers].sort((a, b) => sc(b) - sc(a))[0]?.model ?? null;
  }

  // Best-scoring answer the CURRENT tier can still continue with. After a
  // downgrade the top (or every) model in an old thread may be locked — so the
  // default target, the composer, and the chips all key off this, not the raw
  // winner. Null when the whole comparison is above the current plan.
  function bestAccessibleModel(): string | null {
    const c = latestComparison();
    if (!c || !c.answers.length) return null;
    const sc = (a: Answer) => (a.scores ? overallScore(a.scores) : 0);
    const accessible = c.answers.filter(a => !lockedIds.has(a.model));
    return [...accessible].sort((a, b) => sc(b) - sc(a))[0]?.model ?? null;
  }

  // The model a follow-up will actually go to: the user's pick if it's still
  // in-tier, else the best accessible one.
  function continueTarget(): string | null {
    if (followupModel && !lockedIds.has(followupModel)) return followupModel;
    return bestAccessibleModel();
  }

  // Follow-up targets a user can pick from: the ROOT comparison's models (the
  // count the user started with), minus any now above their tier (a downgraded
  // account opening an old Premium thread).
  function followupCandidates(): string[] {
    const c = rootComparison();
    if (!c) return [];
    return c.answers.map(a => a.model).filter(m => !lockedIds.has(m));
  }

  // AGG-44: freeze the current conversation into a public snapshot. Internal
  // fields (runtime/tokens/cost) are stripped; per-model scores collapse to the
  // computed overall — the shared view shows the headline number, not the rail.
  function buildShareSnapshot(): ShareSnapshot | null {
    if (!result) return null;
    const strip = (a: Answer): ShareAnswer => ({
      model: a.model, answer: a.answer, truncated: a.truncated,
      runtime_ms: a.runtime_ms, tokens: a.tokens,
      // Carry the FULL rubric (not just the headline) so /share + a fork render
      // the same Aggr-Score radar + strengths/weaknesses as the live app.
      scores: a.scores ? {
        accuracy: a.scores.accuracy,
        completeness: a.scores.completeness,
        calibration: a.scores.calibration,
        clarity: a.scores.clarity,
        insight: a.scores.insight,
        ...(a.scores.strengths?.length ? { strengths: a.scores.strengths } : {}),
        ...(a.scores.weaknesses?.length ? { weaknesses: a.scores.weaknesses } : {}),
      } : null,
    });
    const compareTurn = (r: Extract<Result, { type: "compare" }>, question: string): ShareTurn => ({
      kind: "compare", question, summary: r.summary,
      contributions: r.contributions ?? null,
      answers: r.answers.map(strip),
      sources: r.search?.sources ?? null,
    });
    const turns: ShareTurn[] = [];
    if (result.type === "compare") turns.push(compareTurn(result, result.question));
    else if (result.type === "direct" || result.type === "product") turns.push({ kind: "direct", question: result.question, answer: result.answer });
    for (const f of followups) {
      if (f.mode === "compare" && f.result?.type === "compare") turns.push(compareTurn(f.result, f.question));
      else if (f.mode === "single" && f.answer) turns.push({ kind: "single", question: f.question, model: f.modelId, answer: f.answer });
    }
    if (!turns.length) return null;
    const models = result.type === "compare" ? result.answers.map(a => a.model) : [];
    return { v: 1, createdAt: new Date().toISOString(), models, turns };
  }

  async function handleShare() {
    if (sharing) return;
    const snapshot = buildShareSnapshot();
    if (!snapshot) return;
    setSharing(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot, conversationId: activeConvId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        setShareUrl(data.url);
        try { await navigator.clipboard?.writeText(data.url); } catch { /* clipboard blocked — link still shown */ }
      }
    } catch { /* network — button stays ready to retry */ } finally {
      setSharing(false);
    }
  }
  // Re-copy the share link on demand, with a brief "Copied!" flash so the click
  // clearly registers (the link is already auto-copied on Share).
  async function copyShareLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard?.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — the full URL is in the title tooltip */ }
  }
  // Multi-model follow-ups are Pro+; the backend rejects compare for free
  // outright, so offering the click would just buy an error.
  const canPickMultiple = tier === "pro" || tier === "premium";

  // The resolved selection. An untouched selection resolves to the winner, which
  // keeps the old one-click "continue with the best model" behaviour intact
  // without an effect to seed it. Stale picks (tier changed under a stored
  // thread) are filtered out rather than sent and rejected.
  function selectedFollowupModels(): string[] {
    const avail = followupCandidates();
    const picked = avail.filter(m => followupModels.has(m));
    if (picked.length > 0) return picked;
    const t = continueTarget();
    return t && avail.includes(t) ? [t] : avail.slice(0, 1);
  }

  // Chips are toggles now. Two invariants: never empty (an empty selection has
  // nothing to send, and a dead arrow button explains nothing), and never over
  // the tier's cap — free collapses to single-select rather than silently
  // refusing the second click.
  function toggleFollowupModel(modelId: string) {
    const cur = selectedFollowupModels();
    const has = cur.includes(modelId);
    if (has && cur.length === 1) return;                      // keep at least one
    if (!has && !canPickMultiple) {                           // free: replace, don't add
      setFollowupModels(new Set([modelId]));
      setFollowupModel(modelId);
      return;
    }
    if (!has && cur.length >= maxModels) return;              // at the tier cap
    const next = has ? cur.filter(m => m !== modelId) : [...cur, modelId];
    setFollowupModels(new Set(next));
    if (next.length === 1) setFollowupModel(next[0]);
    followupInputRef.current?.focus();   // picking a target means you're about to type
  }

  // Rebuild the follow-up thread from stored message rows (turns ≥ 2; turns 0/1
  // are the initial comparison, already rendered from `result`).
  function toFollowups(msgs: ConvMessage[]): Followup[] {
    const out: Followup[] = [];
    let pendingUser: { turn: number; content: string } | null = null;
    for (const m of [...msgs].sort((a, b) => a.turn - b.turn)) {
      if (m.turn < 2) continue;
      if (m.role === "user") { pendingUser = { turn: m.turn, content: m.content ?? "" }; continue; }
      if (!pendingUser) continue;
      // Rebuilt from storage, so nothing is in flight: the streaming fields are
      // empty and `models` comes from the stored result, which the render reads
      // in preference to them anyway.
      // searchInfo is a live-session affordance (the source list); on reload the
      // grounded answer text + its [1][2] markers persist, matching the first ask.
      const settled = { partialAnswers: {}, doneModels: [], partialSummary: "", searchInfo: null };
      if (m.role === "assistant_single") {
        out.push({
          id: `t${m.turn}`, userTurn: pendingUser.turn, asstTurn: m.turn,
          question: pendingUser.content, mode: "single", modelId: m.model_id ?? "",
          answer: m.content ?? "", result: null, streaming: false, error: null,
          models: m.model_id ? [m.model_id] : [], ...settled,
        });
        pendingUser = null;
      } else if (m.role === "assistant_comparison") {
        const stored = (m.result as Result) ?? null;
        out.push({
          id: `t${m.turn}`, userTurn: pendingUser.turn, asstTurn: m.turn,
          question: pendingUser.content, mode: "compare", modelId: "",
          answer: "", result: stored, streaming: false, error: null,
          models: stored?.type === "compare" ? stored.answers.map(a => a.model) : [], ...settled,
        });
        pendingUser = null;
      }
    }
    return out;
  }

  // Stream a single-model follow-up from /api/converse into the thread, then
  // persist both turns to Supabase (best-effort) so it survives a reload.
  // Single-model continuation (opts.modelId) or "Ask all again" — a multi-model
  // comparison follow-up (opts.models). The compare turn waits for the backend's
  // 'result' event and stores the full Result; single turns stream token-by-token.
  async function submitContinuation(q: string, opts: { modelId?: string; models?: string[] }) {
    const convId = activeConvId;
    const compare = !!(opts.models && opts.models.length);
    const modelId = opts.modelId ?? "";
    if (!convId || !q.trim() || followupLoading || (!compare && !modelId)) return;
    const maxTurn = followups.reduce((mx, f) => Math.max(mx, f.asstTurn), 1);
    const userTurn = maxTurn + 1;
    const asstTurn = maxTurn + 2;
    const id = `t${asstTurn}`;
    setFollowups(prev => [...prev, {
      id, userTurn, asstTurn, question: q.trim(), mode: compare ? "compare" : "single", modelId,
      answer: "", result: null, streaming: true, error: null,
      models: compare ? (opts.models ?? []) : [modelId],
      partialAnswers: {}, doneModels: [], partialSummary: "", searchInfo: null,
    }]);
    setExpandedFollowups(new Set([id]));  // collapse older turns; keep the new one open
    setComparisonExpanded(false);          // collapse the original comparison — it's history now
    setFollowupInput("");
    setFollowupLoading(true);
    const controller = new AbortController();
    followupAbortRef.current = controller;
    const patch = (fields: Partial<Followup>) =>
      setFollowups(prev => prev.map(f => (f.id === id ? { ...f, ...fields } : f)));
    try {
      const sessionId = getSessionId();
      const res = await fetch("/api/converse", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(sessionId ? { "x-aggrai-session-id": sessionId } : {}) },
        body: JSON.stringify(compare
          ? { conversationId: convId, question: q.trim(), models: opts.models, turn: asstTurn }
          : { conversationId: convId, question: q.trim(), modelId, turn: asstTurn }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        let msg = `Request failed (HTTP ${res.status})`;
        try { const j = JSON.parse(await res.text()); if (j?.error) msg = j.error; } catch { /* keep generic */ }
        throw new Error(msg);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answerText = "";
      let questionId: string | null = null;
      let cost: number | null = null;
      let latency = 0;
      let compareResult: Result | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let evt: { stage?: string; delta?: string; answer?: string; questionId?: string; runtime_ms?: number; cost_usd?: number | null; error?: string; [k: string]: unknown };
          try { evt = JSON.parse(line); } catch { continue; }
          if (evt.stage === "search") {
            // AGG-39 D-converse: this turn was grounded on live search. Surface
            // its sources on THIS follow-up (not the page-level searchInfo).
            const sources = Array.isArray(evt.sources) ? evt.sources as { title: string; url: string }[] : [];
            patch({ searchInfo: { ok: evt.ok !== false, sources } });
          } else if (evt.stage === "answer-chunk") {
            if (compare) {
              // Per-model deltas — the same events /ask renders live. Merge into
              // this turn's partials so the follow-up shows the models typing
              // instead of a frozen placeholder.
              const m = String(evt.model ?? "");
              const d = String(evt.delta ?? "");
              if (m && d) setFollowups(prev => prev.map(f => f.id === id
                ? { ...f, partialAnswers: { ...f.partialAnswers, [m]: (f.partialAnswers[m] ?? "") + d } }
                : f));
            } else { answerText += String(evt.delta ?? ""); patch({ answer: answerText }); }
          } else if (evt.stage === "summary-chunk") {
            // P3d: the rewrite streams ahead of the scores. reset means a keystone
            // fallback restarted it and what we have is dead text.
            if (evt.reset) patch({ partialSummary: "" });
            else setFollowups(prev => prev.map(f => f.id === id
              ? { ...f, partialSummary: f.partialSummary + String(evt.delta ?? "") } : f));
          } else if (evt.stage === "answer") {
            if (compare) {
              const m = String(evt.model ?? "");
              if (m) setFollowups(prev => prev.map(f => f.id === id
                ? { ...f, doneModels: f.doneModels.includes(m) ? f.doneModels : [...f.doneModels, m],
                    partialAnswers: { ...f.partialAnswers, [m]: String(evt.answer ?? f.partialAnswers[m] ?? "") } }
                : f));
            } else {
              answerText = String(evt.answer ?? answerText);
              latency = Number(evt.runtime_ms ?? 0);
              cost = typeof evt.cost_usd === "number" ? evt.cost_usd : null;
              patch({ answer: answerText });
            }
          } else if (evt.stage === "result") {
            const { stage: _s, ...rest } = evt; void _s;
            compareResult = rest as unknown as Result;
            patch({ result: compareResult });
          } else if (evt.stage === "done") {
            questionId = evt.questionId ?? null;
          } else if (evt.stage === "error") {
            throw new Error(evt.error ?? "The model failed to answer.");
          }
        }
      }
      patch({ streaming: false });
      void appendMessage(convId, { turn: userTurn, role: "user", content: q.trim() });
      if (compare) {
        void appendMessage(convId, { turn: asstTurn, role: "assistant_comparison", question_id: questionId, result: compareResult });
      } else {
        void appendMessage(convId, { turn: asstTurn, role: "assistant_single", model_id: modelId, question_id: questionId, content: answerText, cost_usd: cost, latency_ms: latency });
      }
      void bumpConversation(convId, asstTurn + 1);
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (isAbort) patch({ streaming: false });
      else {
        Sentry.captureException(err, { tags: { feature: "converse" } });
        patch({ streaming: false, error: err instanceof Error ? err.message : "Something went wrong" });
      }
    } finally {
      setFollowupLoading(false);
      followupAbortRef.current = null;
    }
  }

  // The single send path — arrow button and Enter both land here. The SIZE of the
  // selection picks the mode: one model is a continuation of its own thread, more
  // than one is a fresh comparison. No separate "ask all" concept survives.
  function handleFollowupSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const sel = selectedFollowupModels();
    if (sel.length === 0) return;
    if (sel.length === 1) { void submitContinuation(followupInput, { modelId: sel[0] }); return; }
    // Belt-and-braces; the chips enforce both already and the backend re-checks.
    if (!canPickMultiple || sel.length > maxModels) return;
    void submitContinuation(followupInput, { models: sel });
  }

  // Reset to a blank comparison ("New comparison" in the sidebar, or
  // tap on the topbar / sidebar logo). After the AGG-38 body-scroll
  // refactor, also scroll the document back to the top — otherwise a
  // user who scrolled deep into a long answer would reset state but
  // stay scrolled past the (now empty) question input and feel like
  // nothing happened.
  function newComparison() {
    setResult(null);
    setQuestion("");
    setError("");
    setIntentHint(null);
    setActiveRecentId(null);
    setSidebarOpen(false);
    // Clear the continuation thread (Phase 5a).
    setActiveConvId(null);
    setFollowups([]);
    setExpandedFollowups(new Set());
    setComparisonExpanded(true);
    setFollowupModel(null);
    setFollowupInput("");
    // A new comparison is a fresh start: snap the picker back to this tier's
    // FULL default set (so Premium gets its 5, not a stale free trio left over
    // from a restored recent) and re-enable tier-default sync. Without this,
    // selectRecent()'s `userOwnsSelection = true` sticks forever and the picker
    // never returns to the tier default.
    setSelected(new Set(tierDefaults[tier]));
    userOwnsSelection.current = false;
    if (typeof window !== "undefined") {
      // Drop any /app/c/{id} suffix back to plain /app so the URL
      // reflects the empty state. Use replaceState (not pushState) so
      // the user's back button still works as expected.
      window.history.replaceState(null, "", "/app");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    // AGG-38: body-scroll layout. Outer is `min-h-dvh` (not `h-dvh
    // overflow-hidden`) and `<main>` no longer has its own
    // `overflow-y-auto`, so the document itself scrolls. That makes
    // iOS's tap-status-bar-to-scroll-to-top gesture work for free, and
    // Android/desktop mouse-wheel/keyboard PgDn behave naturally too.
    // Sidebar is `lg:fixed` (was `lg:static`) and content uses
    // `lg:ml-64` to clear it. Header is `sticky top-0` with a
    // backdrop so it stays visible while the body scrolls under it.
    // Gradient orbs are `fixed` so they don't scroll out of view.
    <div className="relative min-h-dvh bg-navy">
      {/* Soft gradient orbs — fixed so they stay anchored to the
          viewport while the body scrolls. */}
      <div className="pointer-events-none fixed top-20 left-1/3 w-[500px] h-[500px] bg-teal-500/12 rounded-full blur-[120px]" />
      <div className="pointer-events-none fixed bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/8 rounded-full blur-[100px]" />

      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewComparison={newComparison}
        recents={signedIn
          ? dbRecents.map(r => ({ id: r.id, question: r.title || r.question }))
          : sessionRecents.map(r => ({ id: r.id, question: r.question }))}
        activeId={activeRecentId}
        onSelectRecent={signedIn ? selectDbRecent : selectRecent}
        triggerRef={menuButtonRef}
      />

      <div className="relative z-10 flex flex-col min-h-dvh lg:ml-64">
        {/* Top bar — sticky so it stays visible as the document scrolls.
            Backdrop blur prevents content from "ghosting" through the
            header text as you scroll under it.
            AGG-38 #2: pt + pl + pr safe-area insets so notch/dynamic-island
            don't overlap header content in landscape on iOS. h-14 stays as
            the *minimum* visual height; safe-area extends the box upward
            into the inset region without pushing the click targets down. */}
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-white/5 bg-navy/80 backdrop-blur-md px-4 pt-[env(safe-area-inset-top)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          {/* Mobile: menu toggle + logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              aria-controls="app-sidebar"
              aria-expanded={sidebarOpen}
              className="-ml-1.5 inline-flex items-center justify-center p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition"
            >
              <Menu className="h-5 w-5" />
            </button>
            {signedIn ? (
              // Signed-in user is already on their home page (/app), so
              // a Link to /app would be a no-op. Make the tap a real
              // action: reset to a fresh comparison (same UX as the
              // sidebar's "New comparison" button).
              <button
                type="button"
                onClick={newComparison}
                aria-label="New comparison"
                className="inline-flex items-center"
              >
                <Logo height={32} gradientId="topbar-logo" />
              </button>
            ) : (
              <Link href="/" aria-label="aggrai home" className="inline-flex items-center">
                <Logo height={32} gradientId="topbar-logo" />
              </Link>
            )}
          </div>

          <div className="flex-1" />

          {/* Auth buttons — anonymous only. On mobile (<sm) the Log-in
              text button is hidden because the sidebar already exposes a
              Log-in link at the bottom — keeping both on a 360px viewport
              pushed Sign-up off-screen (see AGG-37 M10). Sign-up text
              shortens to "Sign up" on mobile so it stays inside the
              header at narrow widths. */}
          {!signedIn && (
            <div className="flex items-center gap-2">
              <Link
                href="/signin"
                className="hidden sm:inline-flex rounded-lg px-3 py-1.5 text-sm text-white/60 transition hover:text-white"
              >
                Log in
              </Link>
              <Link
                href="/signin?mode=signup"
                className="rounded-lg bg-white px-3 sm:px-3.5 py-1.5 text-sm font-medium text-navy transition hover:bg-white/90 whitespace-nowrap"
              >
                Sign up<span className="hidden sm:inline"> for free</span>
              </Link>
            </div>
          )}
        </header>

        {/* AGG-38 #1 final fix: removed `overflow-y-auto` so the document
            itself scrolls (not a nested container). iOS tap-status-bar
            then scrolls /app to top like every other page. The outer
            min-h-dvh + flex-col still gives us the layout we want. */}
        <main className="flex-1 px-4 py-10">
          {/* Width: was max-w-4xl (~896px) which left ~500px of dead space
              on each side at 1080p+. Bumping to max-w-7xl (1280px) gives
              each model card ~600px on desktop instead of ~430, so long
              answers stop feeling squashed. Reading comfort ceiling for
              the summary text is still respected — each half-column is
              ~85ch, within the standard 60-95ch window. */}
          <div className="mx-auto max-w-7xl space-y-8">

          {showUpgradedBanner && (
            <div
              role="status"
              className="rounded-xl border border-teal-400/30 bg-teal-400/10 px-4 py-3 flex items-center justify-between gap-3"
            >
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

          {/* AGG-44: share the conversation. Any settled result, anon or signed-in,
              all result types — the API + /share page support them all. */}
          {result && !loading && !followupLoading && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {shareUrl ? (
                <button
                  type="button"
                  onClick={copyShareLink}
                  title={shareUrl}
                  aria-label="Copy the share link"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300/25 bg-teal-300/[0.06] px-3 py-1.5 text-xs font-medium text-teal-200 hover:bg-teal-300/10 transition"
                >
                  <Check className="w-3.5 h-3.5 shrink-0 text-teal-300" aria-hidden="true" />
                  {copied ? "Copied!" : "Shared link copied"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={sharing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-surface-1 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-surface-2 hover:text-white transition disabled:opacity-50"
                >
                  <Share2 className="w-3.5 h-3.5" aria-hidden="true" /> {sharing ? "Sharing…" : "Share"}
                </button>
              )}
            </div>
          )}

          {/* Input — the top block morphs: it's the "what would you like to
              know?" ask box until a comparison is fully done (summary + scores),
              then it becomes the "continue the conversation" composer so the
              next action is always where the eye already is. */}
          {result && !loading && result.type === "compare" && signedIn && activeConvId ? (
            bestAccessibleModel() === null ? (
              /* Every model in this stored comparison is above the current plan
                 (e.g. a 5-model Premium thread after a downgrade to Pro). It
                 can't be continued — nudge to upgrade or start fresh. */
              <div className="bg-amber-300/[0.05] backdrop-blur-xl rounded-2xl border border-amber-300/25 p-4 sm:p-5 shadow-2xl shadow-black/20">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300/80 mb-2">
                  Continue the conversation
                </p>
                <p className="text-sm text-white/70 leading-relaxed">
                  This conversation used models that aren&apos;t in your current plan, so you can&apos;t continue it here.{" "}
                  <Link href="/upgrade" className="text-amber-200 underline underline-offset-2 hover:text-amber-100">Upgrade</Link>{" "}
                  to pick it back up, or start a{" "}
                  <button type="button" onClick={newComparison} className="text-teal-300 underline underline-offset-2 hover:text-teal-200">new comparison</button>.
                </p>
              </div>
            ) : (
            <div className="bg-teal-300/[0.05] backdrop-blur-xl rounded-2xl border border-teal-300/25 p-4 sm:p-5 shadow-2xl shadow-black/20">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-300/80 mb-3">
                Continue the conversation
              </p>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {/* Chips = the ROOT question's models (constant across the thread,
                    regardless of which model won); the winner trophy still tracks
                    the latest turn's re-scored winner via winnerModel(). */}
                {(rootComparison() ?? result).answers.filter(a => !lockedIds.has(a.model)).map(a => {
                  const sel = selectedFollowupModels();
                  const isActive = sel.includes(a.model);
                  const isWinner = winnerModel() === a.model;
                  // Greyed only when adding this one would break a rule: at the
                  // tier cap, or free (where a second pick replaces rather than
                  // adds, so it stays clickable).
                  const atCap = !isActive && canPickMultiple && sel.length >= maxModels;
                  return (
                    <button
                      key={a.model}
                      type="button"
                      aria-pressed={isActive}
                      disabled={followupLoading || atCap}
                      title={atCap ? `Your ${tier} plan compares up to ${maxModels} models` : undefined}
                      onClick={() => toggleFollowupModel(a.model)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/70 disabled:opacity-30 disabled:cursor-not-allowed ${
                        isActive
                          ? "border-teal-300/40 bg-teal-300/15 text-teal-100"
                          : "border-white/10 bg-surface-1 text-white/60 hover:bg-surface-2"
                      }`}
                    >
                      {isWinner && <Trophy className="w-3 h-3 text-teal-300" aria-hidden="true" />}
                      <ProviderLogo provider={providerOf(a.model)} className="w-3 h-3" />
                      {modelLabel(a.model)}
                    </button>
                  );
                })}
                {(() => {
                  // A shortcut, not a mode. Its pressed state is DERIVED from the
                  // selection rather than stored beside it, so "All" and the chips
                  // can never disagree about what's selected — which is what the
                  // old separate followupAll flag risked.
                  const avail = followupCandidates();
                  const sel = selectedFollowupModels();
                  const allOn = avail.length > 1 && sel.length === avail.length;
                  // Blocked (not merely capped) when this stored comparison is
                  // bigger than the current plan allows — e.g. a 5-model Premium
                  // thread opened by a downgraded Pro account.
                  const overCap = avail.length > maxModels;
                  const allowed = canPickMultiple && !overCap && avail.length > 1;
                  const reason = tier === "free"
                    ? "Upgrade to Pro to ask more than one model"
                    : overCap
                      ? `This comparison has ${avail.length} models — your ${tier} plan compares up to ${maxModels}`
                      : allOn ? "Back to just the winner" : "Select every model";
                  return (
                    <button
                      type="button"
                      aria-pressed={allOn}
                      onClick={() => {
                        if (!allowed) return;
                        const t = continueTarget();
                        setFollowupModels(new Set(allOn ? [t && avail.includes(t) ? t : avail[0]] : avail));
                        followupInputRef.current?.focus();
                      }}
                      disabled={!allowed || followupLoading}
                      title={reason}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/70 disabled:opacity-40 disabled:cursor-not-allowed ${
                        allOn
                          ? "border-teal-300/40 bg-teal-300/15 text-teal-100"
                          : "border-white/10 bg-surface-1 text-white/60 hover:bg-surface-2"
                      }`}
                    >
                      <Layers className="w-3 h-3" aria-hidden="true" /> All{tier === "free" ? " · Pro" : overCap ? " · Premium" : ""}
                    </button>
                  );
                })()}
              </div>
              <form onSubmit={handleFollowupSubmit} className="flex items-end gap-2">
                <textarea
                  ref={followupInputRef}
                  value={followupInput}
                  onChange={e => setFollowupInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleFollowupSubmit();   // honours the selected target, incl. "all"
                    }
                  }}
                  rows={2}
                  placeholder={(() => {
                    const sel = selectedFollowupModels();
                    if (sel.length === 1) return `Ask ${modelLabel(sel[0])} a follow-up…`;
                    return sel.length === followupCandidates().length
                      ? `Ask all ${sel.length} models a follow-up…`
                      : `Ask ${sel.length} models a follow-up…`;
                  })()}
                  className="flex-1 resize-none rounded-xl border border-white/10 bg-surface-1 px-4 py-3 text-base text-white placeholder:text-white/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 focus:border-transparent"
                  disabled={followupLoading}
                />
                <button
                  type="submit"
                  disabled={followupLoading || !followupInput.trim()}
                  aria-label="Send follow-up"
                  className="shrink-0 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-400 text-navy p-3.5 rounded-xl transition-all shadow-lg shadow-teal-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            </div>
            )
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center bg-surface-2 backdrop-blur-xl rounded-2xl border border-white/10 hover:border-white/20 focus-within:ring-2 focus-within:ring-teal-400/60 focus-within:border-transparent transition-colors shadow-2xl shadow-black/20">
              <textarea
                ref={questionInputRef}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                placeholder="What would you like to know?"
                aria-label="Ask a question"
                aria-describedby="ask-hint"
                rows={2}
                className="flex-1 resize-none bg-transparent text-white placeholder:text-white/45 px-6 py-4 text-base focus:outline-none rounded-2xl"
              />
              {loading ? (
                // While a request is in flight, the submit arrow becomes
                // a stop button that aborts the in-flight fetch. The
                // partial answers that already streamed in stay on screen
                // (matches ChatGPT's "stop generating" semantics) — we
                // just don't wait for the rest + summariser.
                <button
                  type="button"
                  onClick={stopGeneration}
                  className="m-2 bg-gradient-to-r from-red-500/90 to-red-400/90 hover:from-red-400 hover:to-red-400 text-white p-3.5 rounded-xl transition-all shadow-lg shadow-red-500/25"
                  aria-label="Stop generating"
                  title="Stop generating"
                >
                  <Square className="w-5 h-5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!question.trim()}
                  className="m-2 bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-400 text-navy p-3.5 rounded-xl transition-all shadow-lg shadow-teal-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Submit"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Small kbd hint so users know Enter submits and Shift+Enter is
                the escape hatch for a newline (referenced via the textarea's
                aria-describedby above). */}
            <p id="ask-hint" className="text-[11px] text-white/55 text-right -mt-2 px-1">
              <kbd className="font-mono">Enter</kbd> to send ·{" "}
              <kbd className="font-mono">Shift+Enter</kbd> for new line
            </p>

            {/* Model selector */}
            <ModelPicker
              all={allModels}
              selected={selected}
              onChange={handleSelectionChange}
              max={maxModels}
              lockedIds={lockedIds}
            />
          </form>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300"
            >
              {error}
            </div>
          )}

          {/* Loading state — skeleton blocks mirroring the real layout,
              with per-model blocks getting replaced by actual answer
              cards as the backend streams each model's response. */}
          {loading && (
            <div className="space-y-6">
              {/* Mirror the loaded result's "You asked: …" header so the user
                  can see their question while the comparison streams in. */}
              {pendingQuestion && (
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-400/15 text-[11px] font-semibold uppercase tracking-wide text-teal-200 ring-1 ring-inset ring-teal-300/20">You</span>
                  <p className="text-[15px] leading-relaxed font-medium text-white/90 min-w-0 break-words">{pendingQuestion}</p>
                </div>
              )}
              {intentHint === "compare" && selected.size > 1 ? (
              <div className="space-y-4">
                {/* Same panel a follow-up renders, and the same one this becomes
                    once `result` lands — so the phases advance in place instead of
                    swapping between three different-looking things. */}
                <SummaryPanel
                  result={null}
                  partialSummary={partialSummary}
                  models={[...selected]}
                  doneModels={streamingAnswers.map(a => a.model)}
                  partialAnswers={partialAnswers}
                  gradientId="ld-summary"
                />
                {/* Two-column grid with items-start. We tried CSS `columns`
                    masonry here, but it reorders cards column-major (model 3
                    jumps above model 2) and re-balances column heights every
                    time a model starts streaming — producing a jarring
                    stagger mid-stream. A grid keeps a stable left→right
                    reading order and aligned row tops; `items-start` stops a
                    collapsed/short card from stretching to its row-mate's
                    height (the original empty-gap complaint). */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  {[...selected].map(id => {
                    const streamed = streamingAnswers.find(a => a.model === id);
                    const partial = partialAnswers[id];
                    // Render priority: streamed (full answer + metadata)
                    // > partial (still typing in) > skeleton.
                    if (!streamed && !partial) return <ModelLoadingBlock key={id} modelId={id} />;
                    const answerText = streamed?.answer ?? partial ?? "";
                    const isStillTyping = !streamed;
                    const runtimeLabel = streamed ? `${(streamed.runtime_ms / 1000).toFixed(1)}s` : "typing…";
                    const tokenLabel = streamed
                      ? `${streamed.tokens} tok`
                      // While streaming, approximate tokens as chars/4 so
                      // the header isn't static. Real count lands with
                      // the final stage:answer event.
                      : `~${Math.ceil(answerText.length / 4)} tok`;
                    // Streaming answers default to expanded (we auto-add
                    // each model to expandedAnswers as its first chunk
                    // arrives), but the chevron lets the user collapse
                    // mid-stream if they don't want to read all three.
                    // Chunks keep accumulating in partialAnswers state
                    // either way — re-expanding shows the latest.
                    const isOpen = expandedAnswers.has(id);
                    return (
                      <div key={id} className="rounded-2xl border border-white/10 bg-surface-1 backdrop-blur-xl min-w-0 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleAnswer(id)}
                          aria-expanded={isOpen}
                          className="w-full flex items-center justify-between gap-2 p-5 text-left hover:bg-surface-1 transition-colors"
                        >
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-white/90 min-w-0">
                            <ProviderLogo provider={providerOf(id)} className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{modelLabel(id)}</span>
                            {streamed?.truncated && (
                              <span
                                title="The provider hit our token cap and the answer was cut off mid-response."
                                className="shrink-0 inline-flex items-center rounded-md border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-200"
                              >
                                Truncated
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-3 text-xs text-white/55 shrink-0">
                            <span>{runtimeLabel}</span>
                            <span>{tokenLabel}</span>
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
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answerText}</ReactMarkdown>
                            {isStillTyping && (
                              // Blinking caret at the end of the streaming
                              // text — visual cue that more is coming.
                              <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-teal-300/70 align-middle animate-pulse" aria-hidden="true" />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              ) : (
                <LoadingBlock title="Thinking…" gradientId="ld-initial" />
              )}
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <div className="space-y-6">
              {/* Conversation continuation (Phase 5a) — the follow-up thread,
                  newest-first. The composer itself lives in the top input block,
                  which morphs into it once the comparison is done. */}
              {result.type === "compare" && (
                <div className="space-y-6">
                  {!signedIn && (
                    <div className="rounded-2xl border border-white/10 bg-surface-1 p-4 text-sm text-white/50">
                      <a href="/login" className="text-teal-300 hover:text-teal-200 font-medium">Sign in</a>{" "}
                      to continue this conversation with a follow-up.
                    </div>
                  )}
                  {[...followups].reverse().map(f => {
                    const isExpanded = f.streaming || expandedFollowups.has(f.id);
                    return (
                    <div key={f.id} className="space-y-3">
                      {/* Question row = the collapse toggle. Older turns sit
                          collapsed to this one line; click to reopen. */}
                      <button
                        type="button"
                        onClick={() => { if (!f.streaming) toggleFollowup(f.id); }}
                        aria-expanded={isExpanded}
                        className="group flex w-full items-center gap-3 text-left"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-400/15 text-[11px] font-semibold uppercase tracking-wide text-teal-200 ring-1 ring-inset ring-teal-300/20">You</span>
                        <p className={`min-w-0 flex-1 break-words ${isExpanded ? "text-[15px] leading-relaxed font-medium text-white/90" : "truncate text-sm text-white/60 group-hover:text-white/80"}`}>{f.question}</p>
                        {!isExpanded && (
                          <span className="hidden sm:flex items-center gap-1.5 text-xs text-white/55 shrink-0">
                            {f.mode === "compare" ? (
                              <><Layers className="w-3 h-3" aria-hidden="true" /> {f.result?.type === "compare" ? `${f.result.answers.length} models` : "comparison"}</>
                            ) : (
                              <><ProviderLogo provider={providerOf(f.modelId)} className="w-3 h-3" /> {modelLabel(f.modelId)}</>
                            )}
                          </span>
                        )}
                        {!f.streaming && (
                          <ChevronDown className={`w-4 h-4 shrink-0 text-white/55 transition-transform ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="rounded-2xl border border-white/10 bg-surface-1 backdrop-blur-xl p-5 min-w-0 overflow-hidden">
                          {f.error ? (
                            <p className="text-sm text-amber-300">{f.error}</p>
                          ) : f.mode === "compare" ? (
                            // A compare follow-up IS a comparison, so it renders
                            // through the SAME SummaryPanel and RawAnswers as the
                            // first ask — synthesis, Aggr-Score rail, and the raw
                            // per-model cards all identical. Nothing here is a
                            // turn-only variant any more.
                            <div className="space-y-4">
                              {/* AGG-39: a follow-up shows its sources when this turn
                                  (or its persisted result) was grounded — live
                                  searchInfo first, then result.search. NO recency
                                  caveat on a follow-up: it continues a thread that
                                  may already be grounded (an earlier turn searched),
                                  so a standalone "no live access" warning is
                                  misleading. The caveat stays on the first ask only. */}
                              {(() => {
                                const s = f.searchInfo ?? (f.result?.type === "compare" ? f.result.search ?? null : null);
                                return s ? <SearchSources info={s} /> : null;
                              })()}
                              <SummaryPanel
                                result={f.result}
                                partialSummary={f.partialSummary}
                                models={f.models}
                                doneModels={f.doneModels}
                                partialAnswers={f.partialAnswers}
                                gradientId={`fu-${f.id}`}
                              />
                              {/* Before the result lands there are no Answer rows yet, so
                                  synthesise placeholders from the models + streamed text;
                                  RawAnswers hides the 0s runtime/token metadata until real
                                  numbers arrive with `result`. */}
                              <RawAnswers
                                answers={f.result?.type === "compare"
                                  ? f.result.answers
                                  : f.models.map(m => ({ model: m, answer: f.partialAnswers[m] ?? "", runtime_ms: 0, tokens: 0, cost_usd: null }))}
                                streamedText={f.partialAnswers}
                              />
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-white/90 mb-3">
                                <ProviderLogo provider={providerOf(f.modelId)} className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{modelLabel(f.modelId)}</span>
                                {f.streaming && <span className="text-white/55 font-normal">· thinking…</span>}
                              </div>
                              {f.answer ? (
                                <div className="prose prose-sm prose-invert max-w-none prose-p:my-2 prose-strong:text-white
                                  [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-words">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{f.answer}</ReactMarkdown>
                                </div>
                              ) : (
                                <p className="text-sm text-white/55">…</p>
                              )}
                              {/* AGG-39 D-converse: a grounded single follow-up shows
                                  its sources — the [1][2] markers in the text point here. */}
                              {f.searchInfo && <div className="mt-4"><SearchSources info={f.searchInfo} /></div>}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}

              {/* Asked question — a user-message row. For a comparison with
                  follow-ups it's a toggle that collapses the whole comparison
                  (it's a historical turn once you've continued). */}
              {result.type === "compare" ? (
                <button
                  type="button"
                  onClick={() => setComparisonExpanded(v => !v)}
                  aria-expanded={followups.length === 0 || comparisonExpanded}
                  className="group flex w-full items-center gap-3 text-left"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-400/15 text-[11px] font-semibold uppercase tracking-wide text-teal-200 ring-1 ring-inset ring-teal-300/20">You</span>
                  <p className={`min-w-0 flex-1 break-words ${(followups.length === 0 || comparisonExpanded) ? "text-[15px] leading-relaxed font-medium text-white/90" : "truncate text-sm text-white/60 group-hover:text-white/80"}`}>{result.question}</p>
                  {followups.length > 0 && !comparisonExpanded && (
                    <span className="hidden sm:flex items-center gap-1.5 text-xs text-white/55 shrink-0">
                      <Layers className="w-3 h-3" /> {result.answers.length} models
                    </span>
                  )}
                  {followups.length > 0 && (
                    <ChevronDown className={`w-4 h-4 shrink-0 text-white/55 transition-transform ${comparisonExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-400/15 text-[11px] font-semibold uppercase tracking-wide text-teal-200 ring-1 ring-inset ring-teal-300/20">You</span>
                  <p className="text-[15px] leading-relaxed font-medium text-white/90 min-w-0 break-words">{result.question}</p>
                </div>
              )}

              {(followups.length === 0 || comparisonExpanded) && (
              <>
              {result.type === "product" || result.type === "direct" ? (
                <div className="rounded-2xl border border-white/10 bg-surface-2 backdrop-blur-xl p-6 shadow-xl">
                  <div className="mb-3">
                    <Logo height={28} symbolOnly gradientId="product-g" />
                  </div>
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.answer}</ReactMarkdown>
                  </div>
                  {/* AGG-39: a grounded direct answer (e.g. "who's the president")
                      shows its sources — the [1][2] markers in the text point here.
                      Live searchInfo first, then result.search so a revisited
                      grounded direct answer keeps its sources. */}
                  {(() => {
                    const s = searchInfo ?? (result.type === "direct" ? result.search ?? null : null);
                    return s ? <div className="mt-4"><SearchSources info={s} /></div> : null;
                  })()}
                  {/* Factual questions have one right answer, so we skip the
                      full multi-model comparison. A prominent, witty callout
                      explains why — turns "why only one answer?" into a
                      feature. Rotates a quip deterministically by question so
                      it varies across questions but is stable on re-render. */}
                  {result.type === "direct" && (() => {
                    const quips = [
                      "We could've asked five models, but they'd just agree, high-five, and still bill you for the group hug.",
                      "Three AIs would've said the exact same thing, split the tab, and left. We skipped to the part where you get the answer.",
                      "Putting this to a vote would waste good electricity and three very confident robots' entire afternoon.",
                      "Summoning the full AI council here is how you end up with a 40-slide deck answering a yes/no question.",
                      "The other models are sitting this one out — even they'd be a little embarrassed to charge you for it.",
                      "We saved the heavy machinery for the questions that actually keep the robots up at night. This wasn't one of them.",
                    ];
                    const quip = quips[[...result.question].reduce((s, c) => s + c.charCodeAt(0), 0) % quips.length];
                    return (
                      <div className="mt-5 flex items-start gap-3 rounded-xl border border-teal-300/25 bg-teal-300/[0.08] px-4 py-3.5 text-sm text-teal-50/90">
                        <span aria-hidden="true" className="text-lg leading-none">⚡</span>
                        <span><span className="font-semibold text-teal-200">No comparison needed.</span> {quip}</span>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <>
                  {/* AGG-39: if we grounded this ask on live search, show the
                      sources — and NOT the "no live access" caveat, which is now
                      false. Prefer the live searchInfo; fall back to result.search
                      so a RESTORED/revisited grounded ask still shows its sources
                      (the live event is gone on reload) instead of the false caveat. */}
                  {(searchInfo ?? result.search) ? (
                    <SearchSources info={(searchInfo ?? result.search)!} />
                  ) : result.recencyWarning && (
                    <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-xs text-amber-200/90 flex items-start gap-2">
                      <span aria-hidden="true" className="mt-px">⏳</span>
                      <span>
                        This looks time-sensitive. These models answer from their training data and don&apos;t have live access to current events — the latest facts, prices, or news may have changed since. Double-check anything that moves fast.
                      </span>
                    </div>
                  )}
                  {/* Multi-model results — top-down:
                      1. Strongest single answer + Continue CTA (next action).
                      2. Two-col main content:
                         - LEFT: Summary card = Contributions (where it came
                           from) on top, then Best Answer (the rewrite).
                         - RIGHT: Quality scores. */}
                  {/* Multi-model results. The Summary + Aggr-Score rail is the
                      SAME panel the loading state above renders and the same one
                      a follow-up turn renders — one component, three callers, so
                      it cannot drift between them again. */}
                  {result.answers.length > 1 && (
                    <SummaryPanel
                      result={result}
                      partialSummary=""
                      models={result.answers.map(a => a.model)}
                      doneModels={result.answers.map(a => a.model)}
                      partialAnswers={{}}
                      gradientId="res-summary"
                    />
                  )}

                  {/* Per-model answers — the same component a follow-up renders,
                      so raw answers look identical whether it's the first ask or
                      a later turn. */}
                  <RawAnswers answers={result.answers} />

                  {/* Failed models */}
                  {result.failed && result.failed.length > 0 && (
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-300">
                      Failed: {result.failed.map(f => modelLabel(f.model)).join(", ")}
                    </div>
                  )}
                </>
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
