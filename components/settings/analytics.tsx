"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FALLBACK_MODELS } from "@/lib/models";

// AGG-27 P6a: the per-user analytics dashboard — Overview + Models tabs. Reads
// /api/me/analytics (RLS-scoped to the signed-in user), which aggregates the
// caller's own questions + model_runs. No charting lib: stat cards, a calendar
// heatmap, and usage bars are all plain markup. Topic-based views live in the
// later Insights tab.

const MODEL_LABEL = new Map(FALLBACK_MODELS.map((m) => [m.id, m.label]));
function modelLabel(id: string): string {
  return MODEL_LABEL.get(id) ?? id.split("/").pop() ?? id;
}

type Range = "7d" | "30d" | "all";
type Tab = "overview" | "models" | "insights";

const DEPRECATED_MODELS = new Set(
  FALLBACK_MODELS.filter((m) => m.status === "deprecated").map((m) => m.id),
);

interface ModelRow {
  model: string;
  questions: number;
  tokens: number;
  avgScore: number | null;
  scoredCount: number;
}
/** One dot on the quality-vs-speed scatter. Comparison runs only (see the API). */
interface ScoreSpeedPoint {
  model: string;
  n: number;
  avgScore: number;
  vsPeers: number;
  medianMs: number;
  p90Ms: number;
}
interface Overview {
  conversations: number;
  questions: number;
  totalTokens: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  peakHour: string | null;
  topModel: string | null;
  modelsTried: number;
  dailyActivity: { date: string; count: number }[];
  funFact: string;
}
interface Insights {
  topicBreakdown: { topic: string; count: number }[];
  bestPerTopic: { topic: string; model: string; avgScore: number; samples: number }[];
  scoreTrend: { date: string; avgScore: number; n: number }[];
  tagged: number;
  totalQuestions: number;
}
interface AnalyticsData {
  tier: string;
  range: Range;
  clampedFromAll: boolean;
  overview: Overview;
  models: ModelRow[];
  scoreVsSpeed: ScoreSpeedPoint[];
  insights: Insights;
}

const fmt = (n: number) => n.toLocaleString();
function compact(n: number): string {
  if (n >= 1e9) return +(n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return +(n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M";
  if (n >= 1e3) return +(n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + "K";
  return String(n);
}

export function AnalyticsDashboard() {
  const [range, setRange] = useState<Range>("30d");
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needAuth, setNeedAuth] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/me/analytics?range=${range}`, { cache: "no-store" });
        if (res.status === 401) {
          if (!cancelled) { setNeedAuth(true); setError(null); }
          return;
        }
        if (!res.ok) throw new Error("Request failed");
        const d = (await res.json()) as AnalyticsData;
        if (!cancelled) { setData(d); setNeedAuth(false); setError(null); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [range]);

  const paid = data ? data.tier === "pro" || data.tier === "premium" : false;

  return (
    <div>
      {/* Tabs + range */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-white/10 bg-surface-1 p-0.5">
          <SegBtn active={tab === "overview"} onClick={() => setTab("overview")}>Overview</SegBtn>
          <SegBtn active={tab === "models"} onClick={() => setTab("models")}>Models</SegBtn>
          <SegBtn active={tab === "insights"} onClick={() => setTab("insights")}>Insights</SegBtn>
        </div>
        <div className="inline-flex rounded-lg border border-white/10 bg-surface-1 p-0.5">
          {(["all", "30d", "7d"] as Range[]).map((r) => {
            const locked = r === "all" && data != null && !paid;
            return (
              <SegBtn
                key={r}
                active={range === r}
                locked={locked}
                onClick={() => { if (!locked) setRange(r); }}
                title={locked ? "Full history is a Pro feature" : undefined}
              >
                {r === "all" ? "All" : r}
              </SegBtn>
            );
          })}
        </div>
      </div>

      {needAuth ? (
        <SignInPrompt />
      ) : loading && !data ? (
        <DashSkeleton />
      ) : error && !data ? (
        <div className="rounded-xl border border-red-400/20 bg-red-400/[0.04] px-4 py-3 text-sm text-red-200">
          Couldn&apos;t load your analytics. {error}
        </div>
      ) : data ? (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {tab === "overview"
            ? <OverviewTab overview={data.overview} range={data.range} />
            : tab === "models"
              ? <ModelsTab models={data.models} scoreVsSpeed={data.scoreVsSpeed ?? []} />
              : <InsightsTab insights={data.insights} />}
        </div>
      ) : null}

      {data?.clampedFromAll && (
        <p className="mt-4 text-xs text-white/55">
          Showing the last 30 days. <Link href="/upgrade" className="text-teal-300 hover:underline">Upgrade to Pro</Link> for your full history.
        </p>
      )}
    </div>
  );
}

function OverviewTab({ overview, range }: { overview: Overview; range: Range }) {
  const o = overview;
  const cards: { label: string; value: string; sub?: string; small?: boolean }[] = [
    { label: "Conversations", value: fmt(o.conversations) },
    { label: "Questions", value: fmt(o.questions) },
    { label: "Active days", value: fmt(o.activeDays) },
    { label: "Current streak", value: `${o.currentStreak}d` },
    { label: "Longest streak", value: `${o.longestStreak}d` },
    { label: "Peak hour", value: o.peakHour ?? "—", sub: o.peakHour ? "UTC" : undefined },
    { label: "Top model", value: o.topModel ? modelLabel(o.topModel) : "—", sub: o.modelsTried ? `${o.modelsTried} tried` : undefined, small: true },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>
      <div>
        <div className="mb-2 text-[11px] uppercase tracking-wider text-white/55">Activity</div>
        {o.dailyActivity.length
          ? <Heatmap data={o.dailyActivity} range={range} />
          : <div className="text-sm text-white/55">No activity in this range yet.</div>}
        {o.totalTokens > 0 && <p className="mt-3 text-xs text-white/55">{o.funFact} of generated text.</p>}
      </div>
    </div>
  );
}

// `small` is for text values (e.g. a model name) that would otherwise truncate
// at the numeric 18px size.
function StatCard({ label, value, sub, small }: { label: string; value: string; sub?: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-surface-1 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-white/55">{label}</div>
      <div className={`truncate font-semibold text-white ${small ? "mt-1.5 text-sm" : "mt-1 text-lg"}`} title={value}>{value}</div>
      {sub && <div className="truncate text-[11px] text-white/55">{sub}</div>}
    </div>
  );
}

// GitHub-style calendar heatmap. Cells are UTC days; columns are weeks (Sun→Sat),
// with a month axis across the top and weekday labels down the left so the grid
// is actually readable as dates. Window follows the range; "all" caps at ~26 weeks.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW_LABEL = ["", "Mon", "", "Wed", "", "Fri", ""]; // index = UTC day (0=Sun)

function Heatmap({ data, range }: { data: { date: string; count: number }[]; range: Range }) {
  const MS = 86_400_000;
  const counts = new Map(data.map((d) => [d.date, d.count]));
  const max = Math.max(1, ...data.map((d) => d.count));

  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let startMs: number;
  if (range === "7d") startMs = todayUTC - 6 * MS;
  else if (range === "30d") startMs = todayUTC - 29 * MS;
  else {
    const earliest = data.length ? Date.parse(data[0].date + "T00:00:00Z") : todayUTC;
    startMs = Math.max(earliest, todayUTC - 181 * MS);
  }
  const gridStart = startMs - new Date(startMs).getUTCDay() * MS; // snap back to Sunday

  // Each column is a week; `label` carries the month name when a new month's
  // first in-range day falls in that column (so the axis reads Jun → Jul …).
  const weeks: { cells: { key: string; count: number; inRange: boolean }[]; label: string }[] = [];
  let lastMonth = -1;
  for (let ms = gridStart; ms <= todayUTC; ms += MS) {
    const d = new Date(ms);
    if (d.getUTCDay() === 0) weeks.push({ cells: [], label: "" });
    const w = weeks[weeks.length - 1];
    const key = d.toISOString().slice(0, 10);
    const inRange = ms >= startMs;
    w.cells.push({ key, count: counts.get(key) ?? 0, inRange });
    if (inRange && d.getUTCMonth() !== lastMonth && !w.label) {
      w.label = MONTHS[d.getUTCMonth()];
      lastMonth = d.getUTCMonth();
    }
  }

  const bucket = (c: number) => (c <= 0 ? 0 : c / max > 0.66 ? 3 : c / max > 0.33 ? 2 : 1);
  const shade = ["bg-surface-2", "bg-teal-400/25", "bg-teal-400/55", "bg-teal-400/90"];
  const fmtDay = (key: string) => {
    const d = new Date(key + "T00:00:00Z");
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  };

  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-block">
        {/* Month axis — labels sit above the week column where the month starts. */}
        <div className="mb-1 flex gap-1 pl-8">
          {weeks.map((w, wi) => (
            <div key={wi} className="w-3.5 whitespace-nowrap text-[11px] leading-none text-white/55">{w.label}</div>
          ))}
        </div>
        <div className="flex gap-1">
          {/* Weekday axis */}
          <div className="flex w-7 flex-col gap-1">
            {DOW_LABEL.map((lbl, i) => (
              <div key={i} className="h-3.5 text-right text-[11px] leading-[14px] text-white/55">{lbl}</div>
            ))}
          </div>
          {weeks.map((w, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {w.cells.map((cell) => (
                <div
                  key={cell.key}
                  title={cell.inRange ? `${fmtDay(cell.key)}: ${cell.count} question${cell.count === 1 ? "" : "s"}` : undefined}
                  className={`h-3.5 w-3.5 rounded-sm ${cell.inRange ? shade[bucket(cell.count)] : "bg-transparent"}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Quality vs speed, from the caller's own comparisons — the thing a score-only
// leaderboard can't tell you: whether the model you wait longest for is actually
// better. Plain inline SVG, matching the rest of this dashboard (no chart lib).
// Fast+good is the TOP-LEFT corner; the caption says so, since "better = right"
// is the more common reflex.
function ScoreSpeedChart({ points }: { points: ScoreSpeedPoint[] }) {
  // Hovered/tapped model id. Native SVG <title> tooltips were tried first and are
  // a poor fit — they need a long dwell, can silently not fire, and never work on
  // touch. Real state instead: highlight the dot and print detail in a fixed row
  // below, so there's no layout shift and no tooltip clipping at the edges.
  const [active, setActive] = useState<string | null>(null);
  if (points.length < 2) return null;

  const W = 560, H = 290, L = 40, R = 14, T = 14, B = 52;
  const secs = points.map((p) => p.medianMs / 1000);
  const xMax = Math.max(...secs) * 1.15;
  const lo = Math.min(...points.map((p) => p.avgScore));
  const hi = Math.max(...points.map((p) => p.avgScore));
  const yLo = Math.max(0, lo - 0.5), yHi = Math.min(10, hi + 0.5);
  const px = (s: number) => L + (s / (xMax || 1)) * (W - L - R);
  const py = (v: number) => T + (1 - (v - yLo) / (yHi - yLo || 1)) * (H - T - B);
  const maxN = Math.max(...points.map((p) => p.n));

  // Label placement. Labels sit beside their dot, flipping to the left when they'd
  // run off the right edge. Then a greedy pass per side pushes overlapping labels
  // apart vertically — without it a dozen models in a tight score band produce an
  // unreadable pile. Each label keeps a leader line back to its dot.
  const laid = points
    .map((p) => {
      const label = modelLabel(p.model);
      const cx = px(p.medianMs / 1000), cy = py(p.avgScore);
      const w = label.length * 4.5;
      const r = 3.5 + (p.n / maxN) * 4.5;
      const right = cx + r + 5 + w < W - R;
      return { p, label, cx, cy, r, right, lx: right ? cx + r + 5 : cx - r - 5, ly: cy + 3 };
    });
  for (const side of [true, false]) {
    const col = laid.filter((d) => d.right === side).sort((a, b) => a.ly - b.ly);
    let prev = -99;
    for (const d of col) {
      if (d.ly - prev < 11) d.ly = prev + 11;
      prev = d.ly;
    }
  }

  const cur = active ? points.find((p) => p.model === active) ?? null : null;

  return (
    <div className="rounded-xl border border-white/10 bg-surface-1 p-4">
      <div className="mb-1 text-sm font-medium text-white">Quality vs speed</div>
      <p className="mb-2 text-[11px] leading-relaxed text-white/55">
        From comparisons where each model answered the same question as at least one rival.
        Top-left is best: high score, short wait. Bubble size = number of answers.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={`Quality versus speed for ${points.length} models. ${points.map((p) => `${modelLabel(p.model)} ${p.avgScore.toFixed(1)} out of 10 in ${(p.medianMs / 1000).toFixed(1)} seconds`).join("; ")}.`}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const v = yLo + f * (yHi - yLo);
          return (
            <g key={f}>
              <line x1={L} y1={py(v)} x2={W - R} y2={py(v)} stroke="rgba(255,255,255,.07)" strokeWidth="1" />
              <text x={L - 6} y={py(v) + 3} textAnchor="end" fontSize="9" fill="rgba(255,255,255,.45)">{v.toFixed(1)}</text>
            </g>
          );
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <text key={f} x={px(f * xMax)} y={H - B + 15} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,.45)">
            {(f * xMax).toFixed(0)}s
          </text>
        ))}

        {/* Axis titles */}
        <text x={L + (W - L - R) / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,.6)">
          Median time to answer  ·  ← faster
        </text>
        <text x={11} y={T + (H - T - B) / 2} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,.6)"
          transform={`rotate(-90 11 ${T + (H - T - B) / 2})`}>
          Aggr-Score /10  ·  better ↑
        </text>

        {laid.map((d) => {
          const dead = DEPRECATED_MODELS.has(d.p.model);
          const on = active === d.p.model;
          return (
            <g key={d.p.model}
              onMouseEnter={() => setActive(d.p.model)}
              onMouseLeave={() => setActive(null)}
              onClick={() => setActive(on ? null : d.p.model)}
              style={{ cursor: "pointer" }}>
              {/* Leader line to the nudged label */}
              <line x1={d.cx + (d.right ? d.r : -d.r)} y1={d.cy} x2={d.lx - (d.right ? 2 : -2)} y2={d.ly - 3}
                stroke="rgba(255,255,255,.18)" strokeWidth="0.75" />
              {/* Generous invisible hit area — the dots are only a few px across */}
              <circle cx={d.cx} cy={d.cy} r={Math.max(11, d.r + 7)} fill="transparent" />
              <circle cx={d.cx} cy={d.cy} r={on ? d.r + 2 : d.r}
                fill={dead ? "rgba(255,255,255,.18)" : "rgba(45,212,191,.55)"}
                stroke={dead ? "rgba(255,255,255,.5)" : "#2DD4BF"} strokeWidth={on ? 2 : 1.25} />
              <text x={d.lx} y={d.ly} textAnchor={d.right ? "start" : "end"} fontSize="9"
                fill={on ? "#fff" : dead ? "rgba(255,255,255,.4)" : "rgba(255,255,255,.62)"}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Fixed-height detail row: no layout shift as you move between dots. */}
      <div className="mt-1 min-h-[34px] rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-[11px] leading-relaxed">
        {cur ? (
          <span className="text-white/80">
            <span className="font-medium text-white">{modelLabel(cur.model)}</span>
            {DEPRECATED_MODELS.has(cur.model) && <span className="text-white/45"> · retired</span>}
            {" — "}{cur.avgScore.toFixed(1)}/10 · {(cur.medianMs / 1000).toFixed(1)}s typical
            <span className="text-white/50"> (slowest 10% ≥ {(cur.p90Ms / 1000).toFixed(1)}s)</span>
            {" · "}{cur.n} answers ·{" "}
            <span className={cur.vsPeers >= 0 ? "text-teal-300" : "text-amber-300/90"}>
              {cur.vsPeers >= 0 ? "+" : ""}{cur.vsPeers.toFixed(2)} vs rivals
            </span>
          </span>
        ) : (
          <span className="text-white/45">Hover or tap a dot for detail — including how it scored against the models it was compared with.</span>
        )}
      </div>

      {points.some((p) => DEPRECATED_MODELS.has(p.model)) && (
        <p className="mt-2 text-[11px] text-white/45">
          Grey dots are models that have since been retired — kept here so your history still makes sense, but you can no longer pick them.
        </p>
      )}
    </div>
  );
}

function ModelsTab({ models, scoreVsSpeed }: { models: ModelRow[]; scoreVsSpeed: ScoreSpeedPoint[] }) {
  if (!models.length) {
    return <div className="text-sm text-white/55">No model runs in this range yet — this fills in as you compare models.</div>;
  }
  const maxQ = Math.max(...models.map((m) => m.questions));
  const speedBy = new Map(scoreVsSpeed.map((p) => [p.model, p]));
  return (
    <div className="space-y-2">
      <ScoreSpeedChart points={scoreVsSpeed} />
      {models.map((m) => {
        const sp = speedBy.get(m.model);
        return (
        <div key={m.model} className="rounded-xl border border-white/10 bg-surface-1 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{modelLabel(m.model)}</div>
              <div className="text-[11px] text-white/55">
                {m.questions} answer{m.questions === 1 ? "" : "s"} · {compact(m.tokens)} tokens
                {sp && <> · {(sp.medianMs / 1000).toFixed(1)}s typical</>}
              </div>
            </div>
            {m.avgScore != null && (
              <span className="shrink-0 rounded-full border border-teal-400/20 bg-teal-400/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-teal-200">
                {m.avgScore.toFixed(1)}<span className="text-teal-300/50">/10</span>
              </span>
            )}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-teal-400/70" style={{ width: `${Math.max(4, (m.questions / maxQ) * 100)}%` }} />
          </div>
        </div>
        );
      })}
    </div>
  );
}

function InsightsTab({ insights }: { insights: Insights }) {
  const i = insights;
  if (!i.topicBreakdown.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-surface-1 px-4 py-6 text-center text-sm text-white/50">
        {i.totalQuestions === 0
          ? "Ask a few questions and your topic insights will appear here."
          : "Your questions are still being categorised — topics are tagged nightly. Check back soon."}
      </div>
    );
  }
  // Scale bars to the biggest *real* topic, not "Other" (the catch-all), so a
  // fat "Other" bar can't dwarf the topics people actually care about. Falls
  // back to 1 if somehow only "Other" exists.
  const realMax = Math.max(1, ...i.topicBreakdown.filter((t) => t.topic !== "Other").map((t) => t.count));
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 text-[11px] uppercase tracking-wider text-white/55">Topic breakdown</div>
        <div className="space-y-1.5">
          {i.topicBreakdown.map((t) => (
            <div key={t.topic} className="flex items-center gap-3">
              <div className={`w-44 shrink-0 text-xs leading-tight ${t.topic === "Other" ? "text-white/40" : "text-white/70"}`} title={t.topic}>{t.topic}</div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${t.topic === "Other" ? "bg-white/20" : "bg-teal-400/70"}`}
                  style={{ width: `${Math.min(100, Math.max(3, (t.count / realMax) * 100))}%` }}
                />
              </div>
              <div className="w-8 shrink-0 text-right text-xs tabular-nums text-white/50">{t.count}</div>
            </div>
          ))}
        </div>
      </div>

      {i.bestPerTopic.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-wider text-white/55">Best model per topic</div>
          <div className="space-y-2">
            {i.bestPerTopic.map((b) => (
              <div key={b.topic} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-surface-1 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-xs text-white/55">{b.topic}</div>
                  <div className="truncate text-sm font-medium text-white">{modelLabel(b.model)}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full border border-teal-400/20 bg-teal-400/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-teal-200">
                    {b.avgScore.toFixed(1)}<span className="text-teal-300/50">/10</span>
                  </span>
                  <span className="text-[11px] text-white/55">n={b.samples}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-white/55">Highest average aggrai score across your questions in each topic.</p>
        </div>
      )}

      {i.scoreTrend.length > 1 && <ScoreTrend data={i.scoreTrend} />}

      {/* Freshness: Overview + Models are live, but topics come from the nightly
          tag-topics cron — so this tab alone can lag by up to a day. */}
      <p className="text-[11px] text-white/55">
        {i.tagged < i.totalQuestions
          ? `${i.tagged} of ${i.totalQuestions} questions categorised so far — topics are tagged nightly, so your most recent ones may not appear yet.`
          : "Topics are tagged nightly, so questions you ask today may not appear here until tomorrow."}
      </p>
    </div>
  );
}

// Hand-built sparkline of the average aggrai answer score over the days the user
// was active — no charting lib, matching the rest of the dashboard.
function ScoreTrend({ data }: { data: { date: string; avgScore: number; n: number }[] }) {
  const W = 600, H = 90, pad = 10;
  const xs = data.map((_, idx) => (data.length === 1 ? W / 2 : pad + (idx / (data.length - 1)) * (W - 2 * pad)));
  const ys = data.map((d) => H - pad - (d.avgScore / 10) * (H - 2 * pad));
  const pts = xs.map((x, idx) => `${x.toFixed(1)},${ys[idx].toFixed(1)}`).join(" ");
  return (
    <div>
      <div className="mb-2 text-[11px] uppercase tracking-wider text-white/55">Score trend</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Average answer score over time">
        <polyline points={pts} fill="none" stroke="#2dd4bf" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {xs.map((x, idx) => <circle key={idx} cx={x} cy={ys[idx]} r={2.5} fill="#2dd4bf" />)}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-white/55">
        <span>{data[0].date}</span>
        <span>avg aggrai score · 0–10</span>
        <span>{data[data.length - 1].date}</span>
      </div>
    </div>
  );
}

function SegBtn({
  active, locked, onClick, title, children,
}: {
  active: boolean;
  locked?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={locked}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-white/90 text-neutral-900"
          : locked
            ? "cursor-not-allowed text-white/55"
            : "text-white/60 hover:text-white/90"
      }`}
    >
      {children}
    </button>
  );
}

function SignInPrompt() {
  return (
    <div className="rounded-xl border border-white/10 bg-surface-1 px-4 py-6 text-center">
      <p className="text-sm text-white/60">Sign in to see your analytics.</p>
      <Link
        href="/signin?next=/settings/analytics"
        className="mt-3 inline-block rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-teal-300"
      >
        Sign in
      </Link>
    </div>
  );
}

function DashSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[68px] animate-pulse rounded-xl border border-white/10 bg-surface-1" />
        ))}
      </div>
      <div className="h-24 animate-pulse rounded-xl border border-white/10 bg-surface-1" />
    </div>
  );
}
