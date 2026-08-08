"use client";

import { useState } from "react";

// Charts for /admin. Client components purely so hover works — the page itself
// stays server-rendered. Native title="" tooltips were tried on the first pass
// and are not good enough: they need a long dwell, and give no y-axis context.
// Each chart therefore draws real axis labels and prints the hovered value in a
// fixed-height row (no layout shift, nothing clipped at the edges).
//
// EVERY prop here must be JSON-serializable: /admin is a Server Component, so
// React serializes these props across the RSC boundary. A formatter was first
// passed in as a `fmt` callback — tsc and the build both accepted it, and the
// page then 500'd on every request ("Functions cannot be passed directly to
// Client Components"). Hence `unit`, a plain string the client resolves itself.

const ANSWER_COLOUR = "#2DD4BF";     // teal — the models answering
const SUMMARISER_COLOUR = "#FBBF24"; // amber — matches the "warn" tone; it is the cost centre
/** Below this many asks in a week, a median is noise. Drawn hatched, and said so. */
const MIN_SAMPLE = 5;

/**
 * Provisional (thin-sample) fill. Hatching, NOT reduced opacity: fading amber
 * over this navy drags it to olive, so a dimmed bar reads as a third CATEGORY
 * rather than the same series held loosely. The stripes are full-strength
 * colour, so the hue survives and only the texture says "don't trust this yet".
 */
const hatched = (colour: string) =>
  `repeating-linear-gradient(45deg, ${colour} 0 5px, transparent 5px 10px)`;

const TIER_COLOURS: Record<string, string> = {
  free: "rgba(255,255,255,.28)",
  pro: "#60A5FA",
  premium: "#2DD4BF",
};

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / mag) * mag;
}

const shortDate = (d: string) => {
  const [, m, day] = d.split("-");
  return `${day} ${["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m)]}`;
};

/** Drops the decimals once a value is big enough not to need them. */
function fmtValue(n: number, unit: Unit): string {
  return unit === "usd"
    ? `$${n.toFixed(n < 10 ? 2 : 0)}`
    : `${n.toFixed(n < 10 ? 1 : 0)}s`;
}

type Unit = "usd" | "s";

/** Always 1dp. The split readout compares 34.8 vs 23.5 — rounding both to whole
 *  seconds throws away the difference the chart exists to show. */
const secs = (n: number) => `${n.toFixed(1)}s`;

/** Single-series weekly bars with a y-axis. `unit` renders both axis + readout. */
export function WeeklyBars({
  data, unit, label, height = 120,
}: {
  data: { w: string; v: number; extra?: string }[];
  unit: Unit;
  label: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <Empty />;
  const max = niceMax(Math.max(...data.map((d) => d.v)));
  const cur = hover != null ? data[hover] : null;

  return (
    <div>
      <div className="flex gap-2">
        {/* y-axis */}
        <div className="flex shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-white/35"
          style={{ height }}>
          <span>{fmtValue(max, unit)}</span>
          <span>{fmtValue(max / 2, unit)}</span>
          <span>0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height }}>
            {[0, 0.5, 1].map((f) => (
              <div key={f} className="absolute inset-x-0 border-t border-white/[0.07]" style={{ top: `${f * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-[3px]">
              {data.map((d, i) => (
                <button key={d.w} type="button"
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                  aria-label={`${shortDate(d.w)}: ${fmtValue(d.v, unit)}`}
                  className="group relative flex-1 rounded-t transition-colors"
                  style={{
                    height: `${Math.max(2, (d.v / max) * 100)}%`,
                    background: hover === i ? "#2DD4BF" : "rgba(45,212,191,.45)",
                  }} />
              ))}
            </div>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-white/35">
            <span>{shortDate(data[0].w)}</span>
            {data.length > 1 && <span>{shortDate(data[data.length - 1].w)}</span>}
          </div>
        </div>
      </div>
      <Readout>
        {cur
          ? <><span className="text-white/85">week of {shortDate(cur.w)}</span> — <span className="font-medium text-white">{fmtValue(cur.v, unit)}</span>{cur.extra && <span className="text-white/45"> · {cur.extra}</span>}</>
          : <span className="text-white/40">Hover a bar for the weekly {label}.</span>}
      </Readout>
    </div>
  );
}

/** Weekly active users, stacked by the tier they were on at ask time. */
export function StackedUserBars({
  data, height = 120,
}: {
  data: { w: string; free: number; pro: number; premium: number; total: number }[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <Empty />;
  const max = Math.max(1, ...data.map((d) => d.total));
  const cur = hover != null ? data[hover] : null;
  const tiers = ["premium", "pro", "free"] as const;

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-white/55">
        {tiers.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: TIER_COLOURS[t] }} />{t}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="flex shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-white/35" style={{ height }}>
          <span>{max}</span><span>{Math.round(max / 2)}</span><span>0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height }}>
            {[0, 0.5, 1].map((f) => (
              <div key={f} className="absolute inset-x-0 border-t border-white/[0.07]" style={{ top: `${f * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-[3px]">
              {data.map((d, i) => (
                <button key={d.w} type="button"
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                  aria-label={`${shortDate(d.w)}: ${d.total} active`}
                  className="flex flex-1 flex-col-reverse justify-start"
                  style={{ height: "100%", opacity: hover == null || hover === i ? 1 : 0.55 }}>
                  {tiers.map((t) => (
                    d[t] > 0 ? (
                      <span key={t} className="w-full first:rounded-t"
                        style={{ height: `${(d[t] / max) * 100}%`, background: TIER_COLOURS[t] }} />
                    ) : null
                  ))}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-white/35">
            <span>{shortDate(data[0].w)}</span>
            {data.length > 1 && <span>{shortDate(data[data.length - 1].w)}</span>}
          </div>
        </div>
      </div>
      <Readout>
        {cur
          ? <><span className="text-white/85">week of {shortDate(cur.w)}</span> — <span className="font-medium text-white">{cur.total} active</span> <span className="text-white/45">· {cur.premium} premium · {cur.pro} pro · {cur.free} free</span></>
          : <span className="text-white/40">Hover a bar for that week&apos;s active users by tier.</span>}
      </Readout>
    </div>
  );
}

/**
 * Ask -> complete, split into its two SERIAL parts: the slowest answer, then the
 * summariser that reads them all. A single total bar hid the thing that actually
 * matters — P3d (judge || rewrite, 2026-07-17) cut the summariser ~26s -> ~20s,
 * while the answer half went 7.5s -> 34.8s as Opus 5 (32s p50) became the Premium
 * default. Same total, opposite causes.
 *
 * Segment heights are two independent medians, so they sum to slightly more or
 * less than the headline p50 of the total — stated on the card, not hidden.
 */
export function SplitTimeBars({
  data, height = 140,
}: {
  data: { w: string; ans: number; sum: number; n: number }[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <Empty />;
  // Scale to the WELL-SAMPLED weeks. Otherwise one 2-ask week (a 95s median on
  // two asks, in the real data) sets the axis and squashes every honest bar flat
  // — the chart would hide the trend it exists to show. A thin week above the
  // scale is drawn full-height with a caret; hovering gives its true number.
  const trusted = data.filter((d) => d.n >= MIN_SAMPLE);
  const max = niceMax(Math.max(...(trusted.length ? trusted : data).map((d) => d.ans + d.sum)));
  const cur = hover != null ? data[hover] : null;
  const thin = data.some((d) => d.n < MIN_SAMPLE);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-white/55">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: ANSWER_COLOUR }} />slowest answer
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: SUMMARISER_COLOUR }} />summariser
        </span>
        {thin && (
          <span className="inline-flex items-center gap-1.5 text-white/35">
            <span className="h-2 w-3 rounded-[2px]"
              style={{ background: `repeating-linear-gradient(45deg, ${ANSWER_COLOUR} 0 2px, transparent 2px 4px)` }} />
            hatched = fewer than {MIN_SAMPLE} asks, treat as provisional
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <div className="flex shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-white/35" style={{ height }}>
          <span>{fmtValue(max, "s")}</span><span>{fmtValue(max / 2, "s")}</span><span>0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height }}>
            {[0, 0.5, 1].map((f) => (
              <div key={f} className="absolute inset-x-0 border-t border-white/[0.07]" style={{ top: `${f * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-[3px]">
              {data.map((d, i) => {
                const total = d.ans + d.sum;
                // Off-scale bars fill exactly to the top, keeping their internal
                // proportions, rather than overflowing the plot area.
                const squeeze = total > max ? max / total : 1;
                const thinWeek = d.n < MIN_SAMPLE;
                return (
                  <button key={d.w} type="button"
                    onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                    aria-label={`${shortDate(d.w)}: ${secs(d.ans)} answers plus ${secs(d.sum)} summariser, ${d.n} asks`}
                    className="relative flex flex-1 flex-col-reverse justify-start"
                    style={{ height: "100%", opacity: hover == null || hover === i ? 1 : 0.6 }}>
                    <span className="w-full"
                      style={{
                        height: `${(d.ans * squeeze / max) * 100}%`,
                        background: thinWeek ? hatched(ANSWER_COLOUR) : ANSWER_COLOUR,
                      }} />
                    <span className="w-full rounded-t"
                      style={{
                        height: `${(d.sum * squeeze / max) * 100}%`,
                        background: thinWeek ? hatched(SUMMARISER_COLOUR) : SUMMARISER_COLOUR,
                      }} />
                    {total > max && (
                      <span className="absolute inset-x-0 top-0 text-center text-[9px] leading-none text-white/70" aria-hidden>▲</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-white/35">
            <span>{shortDate(data[0].w)}</span>
            {data.length > 1 && <span>{shortDate(data[data.length - 1].w)}</span>}
          </div>
        </div>
      </div>
      <Readout>
        {cur
          ? <>
              <span className="text-white/85">week of {shortDate(cur.w)}</span> —{" "}
              <span className="font-medium" style={{ color: ANSWER_COLOUR }}>{secs(cur.ans)}</span>
              <span className="text-white/45"> answers + </span>
              <span className="font-medium" style={{ color: SUMMARISER_COLOUR }}>{secs(cur.sum)}</span>
              <span className="text-white/45"> summariser = </span>
              <span className="font-medium text-white">{secs(cur.ans + cur.sum)}</span>
              <span className="text-white/45"> · {cur.n} ask{cur.n === 1 ? "" : "s"}
                {cur.n < MIN_SAMPLE ? " — too few to trust" : ""}
                {cur.ans + cur.sum > max ? " · above the scale" : ""}</span>
            </>
          : <span className="text-white/40">Hover a bar to split that week&apos;s wait.</span>}
      </Readout>
    </div>
  );
}

function Readout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 min-h-[28px] rounded-lg border border-white/10 bg-surface-2 px-3 py-1.5 text-[11px] leading-relaxed text-white/70">
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-[11px] text-white/40">Not enough data in this range yet.</p>;
}
