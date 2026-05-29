"use client";
import React, { Suspense } from "react";
import { useState, useEffect, useRef } from "react";
import * as Sentry from "@sentry/nextjs";
import { useSearchParams, usePathname } from "next/navigation";
import { generateConvId, storeConv, loadConv } from "@/lib/conv-id";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, Layers, BarChart3, Menu, ChevronDown, Trophy, MessageCircle, Square } from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ModelLoader } from "@/components/model-loader";
import { ModelPicker } from "@/components/model-picker";
import { AppSidebar } from "@/components/app-sidebar";
import { useTier } from "@/lib/use-tier";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { ProviderLogo, providerOf } from "@/components/brand-icons";
import { FALLBACK_MODELS, TIER_DEFAULTS, maxModelsForTier, lockedModelIds, parseModelsParam, type ModelEntry } from "@/lib/models";

// AGG-7 v2 (2026-05-25): switched from 4-dim (comprehension /
// thought_provoking / nuance / clarity) to research-backed 5-dim.
// Each sub-score is 0-5 from the judge; overallScore() weights them
// into a single 0-100 with a fatal-flaw cap on Accuracy.
// See /Users/ms/assistant/research/scoring-metric-2026-05-24.md.
type Scores = {
  accuracy:     number;
  completeness: number;
  calibration:  number;
  clarity:      number;
  insight:      number;
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

type Result =
  | { type: "product"; answer: string; question: string; cached?: boolean }
  | {
      type: "compare";
      summary: string;
      answers: Answer[];
      question: string;
      contributions?: Contribution[] | null;
      section_attributions?: SectionAttribution[] | null;
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

// Small chip rendered after each attributed heading — "via Claude · Gemini"
// in muted text. Validates the model IDs exist in answers before showing
// (silently drops invalid ones from the chip).
function AttributionChip({
  attribution,
  knownModelIds,
}: {
  attribution: SectionAttribution;
  knownModelIds: Set<string>;
}) {
  const primaryOk = knownModelIds.has(attribution.primary);
  if (!primaryOk) return null;
  const supporting = (attribution.supporting ?? []).filter(m => knownModelIds.has(m) && m !== attribution.primary);
  return (
    <span
      className="inline-flex items-center gap-1 ml-2 align-middle text-[10px] text-white/40 font-normal not-prose"
      title={`Summariser estimate — content for this section drew mostly from ${modelLabel(attribution.primary)}${supporting.length > 0 ? `, with input from ${supporting.map(modelLabel).join(", ")}` : ""}`}
    >
      <span>via</span>
      <ProviderLogo provider={providerOf(attribution.primary)} className="w-3 h-3 self-center" />
      <span className="text-white/55">{modelLabel(attribution.primary)}</span>
      {supporting.length > 0 && (
        <>
          <span className="text-white/30">·</span>
          {supporting.map(m => (
            <span key={m} className="inline-flex items-center gap-0.5 text-white/40">
              <ProviderLogo provider={providerOf(m)} className="w-3 h-3 self-center" />
              {modelLabel(m)}
            </span>
          ))}
        </>
      )}
    </span>
  );
}

// Factory: returns ReactMarkdown components that inject attribution chips
// after each heading-like element (h2 or bold-only paragraph) when a
// matching section_attribution exists. Used only for the Aggrai's answer
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
      className={`rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-xl flex flex-col items-center justify-center gap-2 min-h-[110px] p-4 ${className}`}
    >
      <Logo height={LOADING_AGGRAI_SIZE} spinning symbolOnly gradientId={gradientId} />
      <p className="text-xs text-white/40">{title}</p>
    </div>
  );
}

function ModelLoadingBlock({ modelId }: { modelId: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-xl flex flex-col items-center justify-center gap-2 min-h-[110px] p-4">
      <ModelLoader modelId={modelId} size={LOADING_BRAND_SIZE} label={modelLabel(modelId)} />
      <p className="text-xs text-white/40">{modelLabel(modelId)}</p>
    </div>
  );
}

// AGG-7 v2: Accuracy first (it's the most consequential dimension),
// Insight last (lowest weight, the "nice to have"). Order here is
// also the order they render in the 5-segment breakdown bar.
const SCORE_KEYS: { key: keyof Scores; label: string }[] = [
  { key: "accuracy",     label: "Accuracy" },
  { key: "completeness", label: "Completeness" },
  { key: "calibration",  label: "Calibration" },
  { key: "clarity",      label: "Clarity" },
  { key: "insight",      label: "Insight" },
];

// AGG-7 v2: weighted composite of the 5 sub-scores (each 0-5) into a
// single 0-100 quality score, plus a fatal-flaw cap: if Accuracy ≤ 1.0
// (confidently-wrong or fabricated) the composite is capped at 40 no
// matter how high the other dims are. "A beautifully-written wrong
// answer is not a good answer."
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
  // weighted sum and renders as "NaN /100" in the UI. Coalesce each
  // dim to 0 instead — a missing dim now reads as a 0 contribution
  // rather than a render glitch.
  const acc  = typeof s.accuracy     === 'number' ? s.accuracy     : 0;
  const comp = typeof s.completeness === 'number' ? s.completeness : 0;
  const cal  = typeof s.calibration  === 'number' ? s.calibration  : 0;
  const clar = typeof s.clarity      === 'number' ? s.clarity      : 0;
  const ins  = typeof s.insight      === 'number' ? s.insight      : 0;
  const weighted = acc * 0.30 + comp * 0.25 + cal * 0.20 + clar * 0.15 + ins * 0.10;
  const raw = Math.round((weighted / 5) * 100);
  return acc <= 1.0 ? Math.min(raw, 40) : raw;
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
  return Math.round((raw / 5) * 100) > 40;
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

  // When sub-scores tie across models (very common with frontier models —
  // four of them might all hit 5.0 on Accuracy), the previous strict `>`
  // reduce kept the first-in-array model, which is just user-selection
  // order. The overall winner could end up "Strongest on nothing" while
  // its tied-but-arbitrarily-first peer claimed every credit. Tie-break
  // on overall score now: when sub-scores match, the model with the
  // higher composite wins the highlight.
  const topByOverallAndScore = (key: keyof Scores) =>
    ranked.reduce((p, c) => {
      if (c.scores[key] > p.scores[key]) return c;
      if (c.scores[key] === p.scores[key] && c.overall > p.overall) return c;
      return p;
    });
  const wonOn = SCORE_KEYS.filter(({ key }) =>
    topByOverallAndScore(key).model === winner.model
  ).map(k => k.label);

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

// One radar per scored model, stacked top-down in ranked order. Each radar
// plots the 5 sub-metrics (Accuracy / Completeness / Calibration / Clarity /
// Insight) on 0-10 axes, with that model's overall 0-100 anchored in the
// middle as the punchline number. Per-model lets readers compare shapes
// side-by-side without polygons fighting for the same space.
function ScoresAndMetrics({ answers }: { answers: Answer[] }) {
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

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl p-6 shadow-xl">
      <div className="mb-5 flex items-center gap-2">
        <BarChart3 className="w-3.5 h-3.5 text-teal-300" />
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-300/80">
          Aggr-Score
        </p>
        <span className="text-[10px] text-white/30">judged by Haiku · sub-scores 0–10 · headline 0–100</span>
      </div>

      <div className="space-y-6">
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
          return (
            <div key={a.model} className="space-y-2">
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
                <span className="font-medium text-white/90 flex-1 truncate">{modelLabel(a.model)}</span>
                {isAccuracyCapped(a.scores) && (
                  <span
                    title="Score limited — contains factual errors. Accuracy ≤ 1.0 caps the overall quality at 40."
                    className="shrink-0 inline-flex items-center rounded-md border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-200"
                  >
                    Limited
                  </span>
                )}
                {isWinner && (
                  <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-teal-300">
                    Winner
                  </span>
                )}
              </div>

              {/* Radar — position:relative so the overall 0-100 can be
                  absolutely centred on top. pointer-events-none on the
                  overlay leaves any future Tooltip hook free to receive
                  mouse events on the polygon. */}
              <div className="relative">
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={data} outerRadius="68%">
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis
                      dataKey="dim"
                      tick={{ fontSize: 10, fill: "rgba(255,255,255,0.55)" }}
                    />
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
                  <div className="text-center">
                    <div
                      className="text-2xl font-semibold tabular-nums leading-none"
                      style={{ color }}
                    >
                      {a.overall}
                    </div>
                    <div className="text-[10px] text-white/40 mt-0.5">/100</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
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
  const [allModels, setAllModels] = useState<ModelEntry[]>(FALLBACK_MODELS);
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
  // When the final result lands we collapse all per-model blocks so the
  // user's eye goes straight to the summary. The streaming-answer
  // handler below re-expands individual blocks as their answers arrive.
  useEffect(() => { setExpandedAnswers(new Set()); }, [result]);
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);
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
  const userOwnsSelection = useRef(explicitModels !== null);

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
    submitQuestion(initialQuestion, new Set(TIER_DEFAULTS[tier]), urlConvId ?? undefined);
    // submitQuestion + setQuestion are stable closures over this render;
    // we want this effect to fire exactly once on the relevant trigger
    // (mount when explicitModels is set, or tierResolved flip otherwise).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierResolved]);

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
    setResult(null);
    setStreamingAnswers([]);
    setPartialAnswers({});
    setError("");
    setIntentHint(null);
    setQuestion("");
    // Fresh AbortController for this request so stopGeneration() can
    // cancel it. We don't reuse across requests (an aborted controller
    // stays aborted).
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.trim(), models: [...models] }),
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

          if (evt.stage === "intent" && (evt.intent === "compare" || evt.intent === "product" || evt.intent === "direct")) {
            setIntentHint(evt.intent);
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
    <div className="relative min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547]">
      {/* Soft gradient orbs — fixed so they stay anchored to the
          viewport while the body scrolls. */}
      <div className="pointer-events-none fixed top-20 left-1/3 w-[500px] h-[500px] bg-teal-500/12 rounded-full blur-[120px]" />
      <div className="pointer-events-none fixed bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/8 rounded-full blur-[100px]" />

      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewComparison={newComparison}
        recents={sessionRecents.map(r => ({ id: r.id, question: r.question }))}
        activeId={activeRecentId}
        onSelectRecent={selectRecent}
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

          {/* Input */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center bg-white/[0.08] backdrop-blur-xl rounded-2xl border border-white/10 hover:border-white/20 transition-colors shadow-2xl shadow-black/20">
              <textarea
                ref={questionInputRef}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                placeholder="What would you like to know?"
                aria-label="Ask a question"
                aria-describedby="ask-hint"
                rows={2}
                className="flex-1 resize-none bg-transparent text-white placeholder:text-white/30 px-6 py-4 text-base focus:outline-none rounded-2xl"
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
                  className="m-2 bg-gradient-to-r from-rose-500/90 to-rose-400/90 hover:from-rose-400 hover:to-rose-400 text-white p-3.5 rounded-xl transition-all shadow-lg shadow-rose-500/25"
                  aria-label="Stop generating"
                  title="Stop generating"
                >
                  <Square className="w-5 h-5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!question.trim()}
                  className="m-2 bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-400 text-white p-3.5 rounded-xl transition-all shadow-lg shadow-teal-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Submit"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Small kbd hint so users know Enter submits and Shift+Enter is
                the escape hatch for a newline (referenced via the textarea's
                aria-describedby above). */}
            <p id="ask-hint" className="text-[11px] text-white/30 text-right -mt-2 px-1">
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
            intentHint === "compare" && selected.size > 1 ? (
              <div className="space-y-4">
                <LoadingBlock title="Strongest single answer" gradientId="ld-winner" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <LoadingBlock title="Summary" gradientId="ld-summary" className="lg:h-full min-h-[280px]" />
                  <LoadingBlock title="Aggr-Score" gradientId="ld-sm" />
                </div>
                {/* Masonry-style two-column flow. CSS Grid would force every
                    row's height to the tallest card in that row — exactly
                    the gap problem we want to avoid. `columns-2` lets each
                    card size to its own content and the browser balances
                    column heights, so a fast model that finishes a short
                    answer doesn't leave dead space below it. `break-inside-
                    avoid` on each card keeps a single card from being split
                    across the column boundary mid-paragraph. */}
                <div className="space-y-4 sm:columns-2 sm:gap-4 sm:space-y-0">
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
                      <div key={id} className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl min-w-0 overflow-hidden break-inside-avoid sm:mb-4">
                        <button
                          type="button"
                          onClick={() => toggleAnswer(id)}
                          aria-expanded={isOpen}
                          className="w-full flex items-center justify-between gap-2 p-5 text-left hover:bg-white/[0.02] transition-colors"
                        >
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-white/90 min-w-0">
                            <ProviderLogo provider={providerOf(id)} className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{modelLabel(id)}</span>
                            {streamed?.truncated && (
                              <span
                                title="The provider hit our token cap and the answer was cut off mid-response."
                                className="shrink-0 inline-flex items-center rounded-md border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-200"
                              >
                                Truncated
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-3 text-xs text-white/40 shrink-0">
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
                        {/* 70/30 split — Aggr-Score block only needs room for
                            5 axis labels + a centred 0-100; everything else
                            (long-form Best Answer rewrite, contributions
                            bars, structured sub-headings) wants the wider
                            column. Was 5fr_3fr (62/38), nudging slimmer. */}
                        <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-4 items-start">
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
                              {(() => {
                                // If we have section attributions, use the
                                // attribution-aware components factory so each
                                // section heading gets a "via X" chip.
                                // Otherwise fall back to plain markdown — no
                                // visual difference for users on legacy cached
                                // responses without attributions.
                                const attrs = result.section_attributions ?? [];
                                const knownIds = new Set(result.answers.map(a => a.model));
                                const components = attrs.length > 0
                                  ? makeAggraiAnswerComponents(attrs, knownIds)
                                  : MARKDOWN_COMPONENTS;
                                return (
                                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                                    {best || result.summary}
                                  </ReactMarkdown>
                                );
                              })()}
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
                  {/* Same masonry column-flow as the streaming layout. Single
                      card stays one column; 2+ cards split into two and the
                      browser balances heights so a 200-line Gemini answer
                      next to a 30-line GPT-4o answer doesn't leave a half-
                      screen of empty space below the short one. */}
                  <div className={`space-y-4 ${result.answers.length > 1 ? "sm:columns-2 sm:gap-4 sm:space-y-0" : ""}`}>
                    {result.answers.map(a => {
                      const isOpen = expandedAnswers.has(a.model);
                      return (
                        <div key={a.model} className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl min-w-0 overflow-hidden break-inside-avoid sm:mb-4">
                          <button
                            type="button"
                            onClick={() => toggleAnswer(a.model)}
                            aria-expanded={isOpen}
                            className="w-full flex items-center justify-between gap-2 p-5 text-left hover:bg-white/[0.02] transition-colors"
                          >
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-white/90 min-w-0">
                              <ProviderLogo provider={providerOf(a.model)} className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{modelLabel(a.model)}</span>
                              {a.truncated && (
                                <span
                                  title="The provider hit our token cap and the answer was cut off mid-response. Aggr-Score below reflects what was returned, not what the model intended."
                                  className="shrink-0 inline-flex items-center rounded-md border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-200"
                                >
                                  Truncated
                                </span>
                              )}
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
