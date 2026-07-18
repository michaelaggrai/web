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

// Each outer node carries its own class so the pentagon reads as "five
// models around the synthesised core". Colours are a cool teal→indigo
// ramp anchored to the brand teal (see globals.css .aggrai-node-*):
// constant saturation/lightness, hue varies within one tight cool family,
// so the dots read as a single ownable brand object and survive down to
// favicon size. The per-provider rainbow lives on as a *moment*: during
// the page-load reveal each node pops in with its old hue and settles into
// the ramp (see .aggrai-logo.is-assembling in globals.css). Spokes stay
// neutral so the dots lead.
const MESH = (
  <g className="aggrai-mesh">
    <path className="aggrai-edge" d="M50 20 L78 41 L68 74 L32 74 L22 41 Z" />
    {/* Overlay of the same pentagon outline, invisible except while loading
        / collapsing / assembling, where it animates a bright "comet" of
        light sweeping clockwise around the perimeter — water flowing from
        one dot to the next. pathLength=100 normalises the dash maths to
        percentages of the perimeter. */}
    <path className="aggrai-edge-flow" pathLength={100} d="M50 20 L78 41 L68 74 L32 74 L22 41 Z" />
    <line className="aggrai-spoke" x1="50" y1="50" x2="50" y2="20" />
    <line className="aggrai-spoke" x1="50" y1="50" x2="78" y2="41" />
    <line className="aggrai-spoke" x1="50" y1="50" x2="68" y2="74" />
    <line className="aggrai-spoke" x1="50" y1="50" x2="32" y2="74" />
    <line className="aggrai-spoke" x1="50" y1="50" x2="22" y2="41" />
    <circle className="aggrai-node aggrai-node-anthropic" cx="50" cy="20" r="4" />
    <circle className="aggrai-node aggrai-node-openai"    cx="78" cy="41" r="4" />
    <circle className="aggrai-node aggrai-node-google"    cx="68" cy="74" r="4" />
    <circle className="aggrai-node aggrai-node-meta"      cx="32" cy="74" r="4" />
    <circle className="aggrai-node aggrai-node-mistral"   cx="22" cy="41" r="4" />
  </g>
)

const CORE = <circle className="aggrai-core" cx="50" cy="50" r="7" />

// Radiates from behind the core on each loading loop — the synthesised answer
// leaving the aggregation. Inert (opacity:0) unless .aggrai-icon.is-loading.
const RIPPLE = <circle className="aggrai-ripple" cx="50" cy="50" r="12" />

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
    // Spinning state animates the mesh at scale(1) — fits in 0 0 100 100.
    // Idle symbol-only still uses the default 1.32x mesh — needs padding.
    const symbolViewBox = spinning ? "0 0 100 100" : "-12 -12 124 124"
    return (
      <svg
        className={`aggrai-icon ${spinning ? "is-loading" : ""} ${className}`}
        viewBox={symbolViewBox}
        aria-label="aggrai"
        /* inline style beats the .aggrai-icon { width:1.16em } CSS rule */
        style={{ width: `${height}px`, height: `${height}px` }}
      >
        {MESH}
        {RIPPLE}
        {CORE}
      </svg>
    )
  }

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
          {MESH}
          {RIPPLE}
          {CORE}
        </svg>
        <span className="aggrai-word">
          <b>a</b><b>g</b><b>g</b><b>r</b><b>a</b><b>i</b>
        </span>
      </span>
    </span>
  )
}
