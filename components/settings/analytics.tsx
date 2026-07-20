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

interface ModelRow {
  model: string;
  questions: number;
  tokens: number;
  avgScore: number | null;
  scoredCount: number;
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
              ? <ModelsTab models={data.models} />
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

function ModelsTab({ models }: { models: ModelRow[] }) {
  if (!models.length) {
    return <div className="text-sm text-white/55">No model runs in this range yet — this fills in as you compare models.</div>;
  }
  const maxQ = Math.max(...models.map((m) => m.questions));
  return (
    <div className="space-y-2">
      {models.map((m) => (
        <div key={m.model} className="rounded-xl border border-white/10 bg-surface-1 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{modelLabel(m.model)}</div>
              <div className="text-[11px] text-white/55">
                {m.questions} answer{m.questions === 1 ? "" : "s"} · {compact(m.tokens)} tokens
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
      ))}
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
