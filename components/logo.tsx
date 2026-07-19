"use client"

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react"

type LogoProps = {
  height?: number
  spinning?: boolean
  className?: string
  /** Kept for backwards-compat with old callers — unused by the new logo. */
  gradientId?: string
  symbolOnly?: boolean
}

// Size-adaptive mark — logo spec 2026-07-19, variant C. One drawing rendered
// identically at every size read as sub-pixel fuzz below ~48px (dots ~2.7px at
// the header, dashed spokes aliasing to grey), so the drawing now SIMPLIFIES as
// it shrinks. Three tiers, branched off the `height` prop — no CSS media queries:
//   FULL    (≥48px)                 edge + spokes + 5 nodes r6.5 + core r8
//                                   — hero/large use; also the loading spinner @84.
//   COMPACT (<48px)                 edge (heavier) + 5 nodes r7 + core r9, NO spokes
//                                   — every nav / header / sidebar / gate row.
//   DOTS    (≤20px, symbol-only)    5 nodes r9 + core r11, no edge/spokes
//                                   — favicon parity (the file lives in app/icon.svg).
// Node/core/ripple keep their classes so the thinking + page-load-assemble +
// hover-collapse animations (globals.css) drive them unchanged — only which
// elements exist and their radii vary by tier. Node positions & colours are
// constant across tiers.
type Tier = "full" | "compact" | "dots"

const EDGE_D = "M50 20 L78 41 L68 74 L32 74 L22 41 Z"
// class · cx · cy — clockwise from the top (teal-green → cyan → sky → blue → indigo).
const NODES = [
  ["aggrai-node-anthropic", 50, 20],
  ["aggrai-node-openai", 78, 41],
  ["aggrai-node-google", 68, 74],
  ["aggrai-node-meta", 32, 74],
  ["aggrai-node-mistral", 22, 41],
] as const

function tierFor(height: number, symbolOnly: boolean, spinning: boolean): Tier {
  if (height >= 48) return "full"
  // DOTS only for a static tiny symbol — never while spinning, since the
  // loading burst needs the ripple/core the dots tier omits.
  if (symbolOnly && !spinning && height <= 20) return "dots"
  return "compact"
}

// The mark's geometry for a tier. Nodes/edge/spokes stay inside `.aggrai-mesh`
// (its scale + hover transition) for FULL/COMPACT; DOTS is raw dots+core in a
// tight favicon box, no mesh transform.
function Mark({ tier }: { tier: Tier }) {
  const nodeR = tier === "dots" ? 9 : tier === "compact" ? 7 : 6.5
  const coreR = tier === "dots" ? 11 : tier === "compact" ? 9 : 8
  const nodes = NODES.map(([cls, cx, cy]) => (
    <circle key={cls} className={`aggrai-node ${cls}`} cx={cx} cy={cy} r={nodeR} />
  ))

  if (tier === "dots") {
    return (
      <>
        {nodes}
        <circle className="aggrai-core" cx="50" cy="50" r={coreR} />
      </>
    )
  }

  return (
    <>
      <g className="aggrai-mesh">
        {/* COMPACT drops the spokes but keeps a heavier, more opaque edge so the
            outline still reads once the spokes are gone. Set inline (not a class)
            so it can't be lost to CSS-layer ordering; the assemble edge-draw and
            the is-loading hide are CSS animations/higher-specificity rules that
            still win over it — and compact never enters the loading state anyway
            (the 84px spinner is the full tier). */}
        <path
          className="aggrai-edge"
          style={tier === "compact" ? { strokeWidth: 3.2, opacity: 0.55 } : undefined}
          d={EDGE_D}
        />
        {/* Perimeter comet overlay — invisible at rest; lit during load / hover /
            assemble. pathLength=100 normalises the dash maths to percentages. */}
        <path className="aggrai-edge-flow" pathLength={100} d={EDGE_D} />
        {tier === "full" &&
          NODES.map(([, x, y], i) => (
            <line key={i} className="aggrai-spoke" x1="50" y1="50" x2={x} y2={y} />
          ))}
        {nodes}
      </g>
      {/* Radiates from behind the core each loading loop. Inert unless is-loading. */}
      <circle className="aggrai-ripple" cx="50" cy="50" r="12" />
      <circle className="aggrai-core" cx="50" cy="50" r={coreR} />
    </>
  )
}

export function Logo({
  height = 36,
  spinning = false,
  className = "",
  symbolOnly = false,
}: LogoProps) {
  // Hover state managed in JS instead of via CSS :hover so the trigger
  // surface (the outer wrapper) can be locked to the natural expanded
  // width. Without that lock, the wordmark collapse shrinks the parent's
  // bounding box, the cursor falls out of the hover area, and we get
  // a flicker loop. See app/globals.css comment on `.aggrai-logo.is-collapsed`.
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const [lockedWidth, setLockedWidth] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  // `expanding` is set briefly after mouseleave so the icon re-pulses
  // outward-then-back as it un-collapses. Cleared after the animation
  // window completes so subsequent hovers play the pulse fresh.
  const [expanding, setExpanding] = useState(false)
  // Plays the one-shot "assemble" reveal on mount, then drops the class
  // ~2.6s later so the resting logo never depends on the animation running.
  const [assembling, setAssembling] = useState(true)
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Measure the wrapper's natural width once after mount, then pin it.
  // We deliberately measure BEFORE the collapsed state ever applies so
  // we always get the full icon+wordmark width.
  useLayoutEffect(() => {
    if (!symbolOnly && wrapperRef.current) {
      setLockedWidth(wrapperRef.current.offsetWidth)
    }
  }, [symbolOnly, height])

  // Remove the assemble class after the reveal completes so the resting
  // logo is never dependent on the animation having run (e.g. if the tab
  // was backgrounded). symbol-only spinners don't get the reveal.
  useEffect(() => {
    if (symbolOnly) return
    const t = setTimeout(() => setAssembling(false), 2600)
    return () => clearTimeout(t)
  }, [symbolOnly])

  if (symbolOnly) {
    const tier = tierFor(height, true, spinning)
    // Spinning animates the mesh gathering to centre — fits 0 0 100 100.
    // Idle full/compact keep the 1.32x mesh padding; dots use the tight box.
    const viewBox = spinning ? "0 0 100 100" : tier === "dots" ? "6 6 88 88" : "-12 -12 124 124"
    return (
      <svg
        className={`aggrai-icon ${spinning ? "is-loading" : ""} ${className}`}
        viewBox={viewBox}
        aria-label="aggrai"
        /* inline style beats the .aggrai-icon { width:1.16em } CSS rule */
        style={{ width: `${height}px`, height: `${height}px` }}
      >
        <Mark tier={tier} />
      </svg>
    )
  }

  const tier = tierFor(height, false, false)

  return (
    <span
      ref={wrapperRef}
      className="aggrai-logo-wrap"
      onMouseEnter={() => {
        if (expandTimer.current) clearTimeout(expandTimer.current)
        setAssembling(false) // a hover during the intro ends it cleanly
        setExpanding(false)
        setCollapsed(true)
      }}
      onMouseLeave={() => {
        setCollapsed(false)
        setExpanding(true)
        if (expandTimer.current) clearTimeout(expandTimer.current)
        expandTimer.current = setTimeout(() => setExpanding(false), 900)
      }}
      style={{
        display: "inline-block",
        // Lock the bounding box at the natural expanded width. The inner
        // .aggrai-logo can shrink/grow visually inside without affecting
        // our hover hitbox.
        minWidth: lockedWidth ?? undefined,
        lineHeight: 0,
      }}
    >
      <span
        className={`aggrai-logo ${assembling ? "is-assembling" : ""} ${collapsed ? "is-collapsed" : ""} ${expanding ? "is-expanding" : ""} ${className}`}
        aria-label="aggrai"
        style={{ ["--aggrai-size" as keyof CSSProperties]: `${height}px` } as CSSProperties}
      >
        <svg className="aggrai-icon" viewBox="-12 -12 124 124" aria-hidden="true">
          <Mark tier={tier} />
        </svg>
        <span className="aggrai-word">
          <b>a</b><b>g</b><b>g</b><b>r</b><b>a</b><b>i</b>
        </span>
      </span>
    </span>
  )
}
