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
type Tab = "overview" | "models";

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
interface AnalyticsData {
  tier: string;
  range: Range;
  clampedFromAll: boolean;
  overview: Overview;
  models: ModelRow[];
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
        <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.02] p-0.5">
          <SegBtn active={tab === "overview"} onClick={() => setTab("overview")}>Overview</SegBtn>
          <SegBtn active={tab === "models"} onClick={() => setTab("models")}>Models</SegBtn>
        </div>
        <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.02] p-0.5">
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
            : <ModelsTab models={data.models} />}
        </div>
      ) : null}

      {data?.clampedFromAll && (
        <p className="mt-4 text-xs text-white/40">
          Showing the last 30 days. <Link href="/upgrade" className="text-teal-300 hover:underline">Upgrade to Pro</Link> for your full history.
        </p>
      )}
    </div>
  );
}

function OverviewTab({ overview, range }: { overview: Overview; range: Range }) {
  const o = overview;
  const cards: { label: string; value: string; sub?: string }[] = [
    { label: "Conversations", value: fmt(o.conversations) },
    { label: "Questions", value: fmt(o.questions) },
    { label: "Total tokens", value: compact(o.totalTokens) },
    { label: "Active days", value: fmt(o.activeDays) },
    { label: "Current streak", value: `${o.currentStreak}d` },
    { label: "Longest streak", value: `${o.longestStreak}d` },
    { label: "Peak hour", value: o.peakHour ?? "—", sub: o.peakHour ? "UTC" : undefined },
    { label: "Top model", value: o.topModel ? modelLabel(o.topModel) : "—", sub: o.modelsTried ? `${o.modelsTried} tried` : undefined },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>
      <div>
        <div className="mb-2 text-[11px] uppercase tracking-wider text-white/40">Activity</div>
        {o.dailyActivity.length
          ? <Heatmap data={o.dailyActivity} range={range} />
          : <div className="text-sm text-white/40">No activity in this range yet.</div>}
        {o.totalTokens > 0 && <p className="mt-3 text-xs text-white/40">{o.funFact} of generated text.</p>}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold text-white" title={value}>{value}</div>
      {sub && <div className="truncate text-[11px] text-white/40">{sub}</div>}
    </div>
  );
}

// GitHub-style calendar heatmap. Cells are UTC days; columns are weeks (Sun→Sat).
// The window follows the selected range; "all" is capped at ~26 weeks of display.
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

  const weeks: { key: string; count: number; inRange: boolean }[][] = [];
  for (let ms = gridStart; ms <= todayUTC; ms += MS) {
    const d = new Date(ms);
    if (d.getUTCDay() === 0) weeks.push([]);
    const key = d.toISOString().slice(0, 10);
    weeks[weeks.length - 1].push({ key, count: counts.get(key) ?? 0, inRange: ms >= startMs });
  }

  const bucket = (c: number) => (c <= 0 ? 0 : c / max > 0.66 ? 3 : c / max > 0.33 ? 2 : 1);
  const shade = ["bg-white/[0.05]", "bg-teal-400/25", "bg-teal-400/55", "bg-teal-400/90"];

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((cell) => (
              <div
                key={cell.key}
                title={cell.inRange ? `${cell.key}: ${cell.count} question${cell.count === 1 ? "" : "s"}` : undefined}
                className={`h-3.5 w-3.5 rounded-sm ${cell.inRange ? shade[bucket(cell.count)] : "bg-transparent"}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ModelsTab({ models }: { models: ModelRow[] }) {
  if (!models.length) {
    return <div className="text-sm text-white/40">No model runs in this range yet — this fills in as you compare models.</div>;
  }
  const maxQ = Math.max(...models.map((m) => m.questions));
  return (
    <div className="space-y-2">
      {models.map((m) => (
        <div key={m.model} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{modelLabel(m.model)}</div>
              <div className="text-[11px] text-white/40">
                {m.questions} answer{m.questions === 1 ? "" : "s"} · {compact(m.tokens)} tokens
              </div>
            </div>
            {m.avgScore != null && (
              <span className="shrink-0 rounded-full border border-teal-400/20 bg-teal-400/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-teal-200">
                {m.avgScore.toFixed(1)}<span className="text-teal-300/50">/10</span>
              </span>
            )}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-teal-400/70" style={{ width: `${Math.max(4, (m.questions / maxQ) * 100)}%` }} />
          </div>
        </div>
      ))}
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
            ? "cursor-not-allowed text-white/25"
            : "text-white/60 hover:text-white/90"
      }`}
    >
      {children}
    </button>
  );
}

function SignInPrompt() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center">
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
          <div key={i} className="h-[68px] animate-pulse rounded-xl border border-white/10 bg-white/[0.02]" />
        ))}
      </div>
      <div className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/[0.02]" />
    </div>
  );
}
