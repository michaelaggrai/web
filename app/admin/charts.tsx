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

const ANSWER_COLOUR = "#2DD4BF"; // teal
/** Below this many samples in a week, a median is noise. Drawn hatched, and said so. */
const MIN_SAMPLE = 5;

/**
 * Provisional (thin-sample) fill. Hatching, NOT reduced opacity: dimming a warm
 * colour over this navy drags it toward olive, so a faded bar reads as a third
 * CATEGORY rather than the same series held loosely. The stripes are
 * full-strength colour, so the hue survives and only the texture says
 * "don't trust this yet".
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

type Unit = "usd" | "s" | "ms" | "n";

/** Drops the decimals once a value is big enough not to need them. */
function fmtValue(v: number, unit: Unit): string {
  const d = v < 10 ? 1 : 0;
  switch (unit) {
    case "usd": return `$${v.toFixed(v < 10 ? 2 : 0)}`;
    case "s":   return `${v.toFixed(d)}s`;
    case "ms":  return `${v.toFixed(d)}ms`;
    case "n":   return v.toFixed(d);
  }
}

/**
 * Single-series weekly bars with a y-axis. `unit` renders both axis + readout.
 * Pass `n` per point (the sample behind that week) to get thin-week hatching and
 * axis scaling that ignores under-sampled weeks — on this dataset a single 2-ask
 * week can otherwise set the scale and flatten every honest bar.
 */
export function WeeklyBars({
  data, unit, label, height = 120,
}: {
  data: { w: string; v: number; extra?: string; n?: number }[];
  unit: Unit;
  label: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <Empty />;
  const trusted = data.filter((d) => d.n == null || d.n >= MIN_SAMPLE);
  const max = niceMax(Math.max(...(trusted.length ? trusted : data).map((d) => d.v)));
  const cur = hover != null ? data[hover] : null;
  const thin = data.some((d) => d.n != null && d.n < MIN_SAMPLE);

  return (
    <div>
      {thin && (
        <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] text-white/35">
          <span className="h-2 w-3 rounded-[2px]"
            style={{ background: `repeating-linear-gradient(45deg, ${ANSWER_COLOUR} 0 2px, transparent 2px 4px)` }} />
          hatched = fewer than {MIN_SAMPLE}, treat as provisional
        </div>
      )}
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
              {data.map((d, i) => {
                const thinWeek = d.n != null && d.n < MIN_SAMPLE;
                const solid = hover === i ? ANSWER_COLOUR : "rgba(45,212,191,.45)";
                return (
                  <button key={d.w} type="button"
                    onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                    aria-label={`${shortDate(d.w)}: ${fmtValue(d.v, unit)}${d.n != null ? `, n=${d.n}` : ""}`}
                    className="group relative flex-1 rounded-t transition-colors"
                    style={{
                      // Clamp so an off-scale thin week fills the plot rather than
                      // overflowing it; the readout still gives its true value.
                      height: `${Math.min(100, Math.max(2, (d.v / max) * 100))}%`,
                      background: thinWeek ? hatched(solid) : solid,
                    }} />
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
              <span className="font-medium text-white">{fmtValue(cur.v, unit)}</span>
              {cur.extra && <span className="text-white/45"> · {cur.extra}</span>}
              {cur.n != null && cur.n < MIN_SAMPLE && <span className="text-white/45"> — too few to trust</span>}
            </>
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
