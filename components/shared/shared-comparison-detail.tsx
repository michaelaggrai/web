"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";
import { BarChart3, Trophy, Plus, Minus, ChevronDown } from "lucide-react";
import { ProviderLogo, providerOf } from "@/components/brand-icons";
import { FALLBACK_MODELS } from "@/lib/models";
import type { ShareAnswer, ShareScores } from "@/lib/share";

// AGG-44 fidelity: render a SHARED conversation's Aggr-Score + raw answers with
// the SAME UI as the live app (app/app/page.tsx ScoresAndMetrics + RawAnswers) —
// per-model radar, dimension winners, strengths/weaknesses, folded answer cards.
// Deliberately a self-contained client component (the app's versions are wired
// to page-local streaming state). The scoring helpers below mirror the app's;
// keep them in sync if the rubric weights ever change.

const LABELS: Record<string, string> = Object.fromEntries(FALLBACK_MODELS.map((m) => [m.id, m.label]));
const label = (id: string) => LABELS[id] ?? id.split("/").pop() ?? id;

type ScoreDimension = "accuracy" | "completeness" | "calibration" | "clarity" | "insight";
const SCORE_KEYS: { key: ScoreDimension; label: string }[] = [
  { key: "accuracy", label: "Accuracy" },
  { key: "completeness", label: "Completeness" },
  { key: "calibration", label: "Calibration" },
  { key: "clarity", label: "Clarity" },
  { key: "insight", label: "Insight" },
];

const num = (v: number | undefined): number => (typeof v === "number" ? v : 0);

// Weighted 0-5 → 0-10 headline with the Accuracy fatal-flaw cap (mirrors the
// app's overallScore()).
function overallScore(s: ShareScores): number {
  const acc = num(s.accuracy);
  const weighted =
    acc * 0.3 + num(s.completeness) * 0.25 + num(s.calibration) * 0.2 + num(s.clarity) * 0.15 + num(s.insight) * 0.1;
  const raw = Math.round(weighted * 2 * 10) / 10;
  return acc <= 1.0 ? Math.min(raw, 4.0) : raw;
}

function isAccuracyCapped(s: ShareScores): boolean {
  const acc = num(s.accuracy);
  if (acc > 1.0) return false;
  const raw = acc * 0.3 + num(s.completeness) * 0.25 + num(s.calibration) * 0.2 + num(s.clarity) * 0.15 + num(s.insight) * 0.1;
  return Math.round(raw * 2 * 10) / 10 > 4.0;
}

// New snapshots carry the full rubric; legacy v1 shares carried only `overall`.
const hasDims = (s: ShareScores): boolean => typeof s.accuracy === "number";

const PALETTE = ["#5eead4", "#60a5fa", "#c084fc", "#fbbf24", "#f472b6"];

// Legacy fallback: pre-fidelity snapshots have only the headline number.
function LegacyScoreCards({ answers }: { answers: ShareAnswer[] }) {
  const scored = answers
    .map((a) => ({ a, overall: typeof a.scores?.overall === "number" ? a.scores!.overall : null }))
    .filter((x): x is { a: ShareAnswer; overall: number } => x.overall !== null);
  if (scored.length === 0) return null;
  const max = Math.max(...scored.map((x) => x.overall));
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-2 p-5">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-3.5 h-3.5 text-teal-300" />
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-300/80">Aggr-Score</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {scored.map(({ a, overall }) => (
          <div
            key={a.model}
            className={`flex items-center justify-between gap-2 rounded-xl border p-3 ${overall === max ? "border-teal-400/40 bg-teal-400/[0.06]" : "border-white/10 bg-surface-2"}`}
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold text-white/90 min-w-0">
              {overall === max && <Trophy className="w-3 h-3 text-teal-300 shrink-0" aria-label="Winner" />}
              <ProviderLogo provider={providerOf(a.model)} className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{label(a.model)}</span>
            </span>
            <span className="shrink-0 tabular-nums text-lg font-semibold text-teal-300">{overall.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SharedScores({ answers }: { answers: ShareAnswer[] }) {
  const [openDetail, setOpenDetail] = useState<Set<string>>(new Set());
  const toggleDetail = (model: string) =>
    setOpenDetail((prev) => {
      const next = new Set(prev);
      next.has(model) ? next.delete(model) : next.add(model);
      return next;
    });

  const scored = answers.filter((a): a is ShareAnswer & { scores: ShareScores } => !!a.scores && hasDims(a.scores));
  // Old shares (dims stripped) → compact headline cards; new shares → full radar.
  if (scored.length === 0) return <LegacyScoreCards answers={answers} />;

  const enriched = scored.map((a) => ({ ...a, overall: overallScore(a.scores) }));
  const maxOverall = Math.max(...enriched.map((a) => a.overall));
  const ranked = [...enriched].sort((a, b) => b.overall - a.overall);

  const dimWinner: Record<string, string> = {};
  if (scored.length > 1) {
    for (const { key } of SCORE_KEYS) {
      const top = ranked.reduce((p, c) =>
        num(c.scores[key]) > num(p.scores[key]) || (num(c.scores[key]) === num(p.scores[key]) && c.overall > p.overall) ? c : p,
      );
      dimWinner[key] = top.model;
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-surface-2 backdrop-blur-xl p-6 shadow-xl">
      <div className="mb-5 flex items-center gap-x-2 gap-y-1 flex-wrap">
        <BarChart3 className="w-3.5 h-3.5 text-teal-300 shrink-0" />
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-300/80 whitespace-nowrap">Aggr-Score</p>
        <span className="text-[11px] text-white/55">judged by Haiku · all scores 0–10 · <a href="/methodology" target="_blank" rel="noopener" className="text-teal-300/80 hover:text-teal-200 no-underline hover:underline">how it works</a></span>
      </div>

      {/* 1-up in the narrow lg rail (beside the summary), 2-up when full-width on md. */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2 lg:grid-cols-1 items-start">
        {ranked.map((a, i) => {
          const color = PALETTE[i % PALETTE.length];
          const isWinner = a.overall === maxOverall;
          const data = SCORE_KEYS.map(({ key, label: dimLabel }) => ({ dim: dimLabel, value: num(a.scores[key]) * 2 }));
          const valueByDim: Record<string, number> = Object.fromEntries(data.map((d) => [d.dim, d.value]));
          const winLabels = new Set(SCORE_KEYS.filter((k) => dimWinner[k.key] === a.model).map((k) => k.label));
          const renderAxisTick = (props: {
            payload: { value: string };
            x: number;
            y: number;
            cy: number;
            textAnchor: "start" | "middle" | "end" | "inherit";
          }) => {
            const { payload, x, y, cy, textAnchor } = props;
            const v = valueByDim[payload.value];
            const isWin = winLabels.has(payload.value);
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
          const hasDetail = (a.scores.strengths?.length ?? 0) + (a.scores.weaknesses?.length ?? 0) > 0;
          return (
            <div key={a.model} className="space-y-2 min-w-0">
              <div className="flex items-center gap-2 text-xs min-w-0">
                <ProviderLogo provider={providerOf(a.model)} className="w-3.5 h-3.5 shrink-0" />
                {isWinner && <Trophy className="w-3.5 h-3.5 text-teal-300 shrink-0" aria-label="Winner — highest overall score" />}
                <span className="font-medium text-white/90 flex-1 truncate">{label(a.model)}</span>
                {isAccuracyCapped(a.scores) && (
                  <span
                    title="Score limited — contains factual errors. Accuracy ≤ 1.0 caps the overall quality at 40."
                    className="shrink-0 inline-flex items-center rounded-md border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-200"
                  >
                    Limited
                  </span>
                )}
                {hasDetail && (
                  <button
                    type="button"
                    onClick={() => toggleDetail(a.model)}
                    aria-expanded={detailOpen}
                    aria-label={detailOpen ? `Hide ${label(a.model)} detail` : `Show ${label(a.model)} detail`}
                    className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-md border border-white/15 bg-white/5 text-white/60 hover:text-white hover:border-white/30 transition-colors"
                  >
                    {detailOpen ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  </button>
                )}
              </div>

              <div
                className={`relative ${hasDetail ? "cursor-pointer rounded-xl hover:bg-surface-1 transition-colors" : ""}`}
                role={hasDetail ? "button" : undefined}
                tabIndex={hasDetail ? 0 : undefined}
                aria-expanded={hasDetail ? detailOpen : undefined}
                aria-label={hasDetail ? `${detailOpen ? "Hide" : "Show"} ${label(a.model)} detail` : undefined}
                onClick={hasDetail ? () => toggleDetail(a.model) : undefined}
                onKeyDown={
                  hasDetail
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleDetail(a.model);
                        }
                      }
                    : undefined
                }
              >
                <ResponsiveContainer width="100%" height={184}>
                  <RadarChart data={data} outerRadius="58%">
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis dataKey="dim" tick={renderAxisTick} />
                    <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                    <Radar name={label(a.model)} dataKey="value" stroke={color} fill={color} fillOpacity={0.2} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-2xl font-semibold tabular-nums leading-none" style={{ color }}>
                    {a.overall.toFixed(1)}
                  </div>
                </div>
              </div>

              {detailOpen && (
                <div className="rounded-lg border border-white/10 bg-surface-1 p-3 space-y-2.5 text-xs">
                  {(a.scores.strengths?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-[11px] font-medium normal-case tracking-normal text-white/50 mb-1.5">Strengths</p>
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
                      <p className="text-[11px] font-medium normal-case tracking-normal text-white/50 mb-1.5">Weaknesses</p>
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

// Folded, collapsible raw-answer cards — the same affordance as the app's
// RawAnswers (single column here; the shared page is reading-width).
export function SharedAnswers({ answers }: { answers: ShareAnswer[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const multi = answers.length > 1;
  const allOpen = multi && open.size === answers.length;
  const toggle = (m: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(m) ? next.delete(m) : next.add(m);
      return next;
    });
  const isOpen = (m: string) => !multi || open.has(m);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/55">Raw answers</p>
        {multi && (
          <button
            type="button"
            onClick={() => setOpen(allOpen ? new Set() : new Set(answers.map((a) => a.model)))}
            className="text-xs text-white/50 hover:text-white/80 transition-colors"
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>
      <div className="space-y-4">
        {answers.map((a) => {
          const shown = isOpen(a.model);
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
                  <span className="truncate">{label(a.model)}</span>
                  {a.truncated && (
                    <span
                      title="The provider hit our token cap and the answer was cut off mid-response."
                      className="shrink-0 inline-flex items-center rounded-md border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-200"
                    >
                      Truncated
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-3 text-xs text-white/55 shrink-0">
                  {a.runtime_ms ? <span>{(a.runtime_ms / 1000).toFixed(1)}s</span> : null}
                  {a.tokens ? <span>{a.tokens} tok</span> : null}
                  {multi && <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${shown ? "rotate-180" : ""}`} aria-hidden="true" />}
                </div>
              </button>
              {shown && a.answer && (
                <div className="px-5 pb-5 prose prose-sm prose-invert max-w-prose prose-p:my-2 prose-strong:text-white [&_table]:block [&_table]:overflow-x-auto [&_table]:w-full [&_table]:text-xs [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_img]:max-w-full [&_code]:break-words">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{a.answer}</ReactMarkdown>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
