"use client";

// Aggr-Score radar loader — the aggrai icon's gather → merge → burst gesture,
// quoted on the radar's five spokes, with the burst timed so it BECOMES the
// landing when the verdict arrives (see aggr-score-loading-v3 mockup + globals
// .asr-* keyframes). One element does the whole life: while `values` is null the
// five provider-coloured dots inhale/gather/burst on a 1.6s heartbeat; when
// `values` lands we wait for the next burst phase, add `.asr-scored`, and the
// dots spring out to their real radii in the model's colour, rings stamp each
// vertex, the polygon draws through, and the centre number counts up.
import { useEffect, useRef, useState } from "react";

const DEFAULT_AXES = ["Accuracy", "Completeness", "Calibration", "Clarity", "Insight"];
const NODECOLS = ["#2dd4bf", "#22d3ee", "#38bdf8", "#60a5fa", "#818cf8"];
const CX = 110, CY = 100, R = 62, CYCLE = 1600, BURST = 0.95, REST = -34;

function pt(i: number, v: number): [number, number] {
  const a = ((-90 + i * 72) * Math.PI) / 180;
  return [CX + R * v * Math.cos(a), CY + R * v * Math.sin(a)];
}
const ringPts = (v: number, n: number) =>
  Array.from({ length: n }, (_, i) => pt(i, v).join(",")).join(" ");

const cssVars = (o: Record<string, string>) => o as React.CSSProperties;

export function ScoreRadar({
  values, score, color, axes = DEFAULT_AXES,
}: {
  values: number[] | null; // 5 sub-scores 0–10, or null while judging
  score: number | null;    // overall 0–10 for the centre number
  color: string;           // the model's slot colour (verdict colour)
  axes?: string[];
}) {
  const startRef = useRef(0);
  const numRef = useRef<SVGTextElement>(null);
  const [scored, setScored] = useState(false);
  const n = axes.length;

  // Record the CSS animation's start (≈ first paint) so the commit can align to
  // a burst phase (t = start + (k + 0.95)·1.6s ≥ ready) instead of snapping.
  useEffect(() => { startRef.current = performance.now(); }, []);

  useEffect(() => {
    if (!values) {
      setScored(false);
      if (numRef.current) numRef.current.textContent = "0.0";
      return;
    }
    const start = startRef.current || performance.now();
    const elapsed = performance.now() - start;
    const k = Math.ceil(elapsed / CYCLE - BURST);
    const commitAt = start + (k + BURST) * CYCLE;
    const delay = Math.max(0, commitAt - performance.now());
    let raf = 0;
    let countTimer = 0;
    const t = window.setTimeout(() => {
      setScored(true);
      const target = score ?? values.reduce((a, b) => a + b, 0) / values.length;
      countTimer = window.setTimeout(() => {
        let t0 = 0;
        const step = (ts: number) => {
          if (!t0) t0 = ts;
          const p = Math.min(1, (ts - t0) / 650);
          if (numRef.current) numRef.current.textContent = (target * p).toFixed(1);
          if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      }, 450);
    }, delay);
    return () => { clearTimeout(t); clearTimeout(countTimer); cancelAnimationFrame(raf); };
  }, [values, score]);

  const fr = (i: number) => (values ? -((values[i] ?? 0) / 10) * R : REST);
  const polyPts = values
    ? values.map((v, i) => pt(i, v / 10).join(",")).join(" ")
    : ringPts(0.5, n);

  return (
    <svg viewBox="0 0 220 200" className={`block w-full ${scored ? "asr-scored" : ""}`}
      style={{ overflow: "visible", ...cssVars({ "--slot": color }) }} aria-hidden="true">
      {[0.25, 0.5, 0.75, 1].map((v) => (
        <polygon key={v} points={ringPts(v, n)} fill="none" stroke="rgba(255,255,255,.09)" strokeWidth={1} />
      ))}
      {axes.map((ax, i) => {
        const [x, y] = pt(i, 1);
        const a = ((-90 + i * 72) * Math.PI) / 180;
        const lx = CX + (R + 16) * Math.cos(a), ly = CY + (R + 16) * Math.sin(a) + 3;
        return (
          <g key={ax}>
            <line x1={CX} y1={CY} x2={x} y2={y} stroke="rgba(255,255,255,.07)" strokeWidth={1} />
            <text x={lx} y={ly} textAnchor="middle" fontSize={10} fontWeight={500} fill="rgba(255,255,255,.5)">{ax}</text>
          </g>
        );
      })}
      <circle className="asr-rip" cx={CX} cy={CY} r={R * 0.6} />
      {axes.map((_, i) => (
        <g key={i} className={`asr-g${i + 1}`} style={{ transform: `rotate(${i * 72}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
          <circle className="asr-node" cx={CX} cy={CY} r={3.6} fill={NODECOLS[i % NODECOLS.length]}
            style={cssVars({ "--rest": `${REST}px`, "--fr": `${fr(i)}px` })} />
          <circle className="asr-ringv" cx={CX} cy={CY} r={3} style={cssVars({ "--fr": `${fr(i)}px` })} />
        </g>
      ))}
      <circle className="asr-core" cx={CX} cy={CY} r={5} />
      <polygon className="asr-poly" points={polyPts} style={{ stroke: "var(--slot)" }} />
      <polygon className="asr-polyfill" points={polyPts} style={{ fill: "color-mix(in srgb, var(--slot) 20%, transparent)" }} />
      <text ref={numRef} className="asr-num" x={CX} y={CY + 8} textAnchor="middle" fontSize={24} fontWeight={700} fill="var(--slot)">0.0</text>
    </svg>
  );
}
