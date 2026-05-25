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

// Each outer node carries a brand-coloured class so the pentagon visually
// reads as "five model providers around the synthesised core". Colours
// chosen from each provider's primary brand palette:
//   anthropic = Claude orange, openai = green/teal, google = Gemini blue,
//   meta = Meta blue, mistral = Mistral orange. Spokes stay neutral so the
//   coloured dots are the visual focus.
const MESH = (
  <g className="aggrai-mesh">
    <path className="aggrai-edge" d="M50 20 L78 41 L68 74 L32 74 L22 41 Z" />
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
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Only enable mouseenter/leave animations on devices that actually
  // have a hover-capable pointer (desktop). On touch, the mouseenter
  // fires on tap and the resulting animation visually competes with
  // the link navigation — users perceive "the logo lit up but nothing
  // happened". Gating on (hover: hover) leaves touch navigation crisp.
  const [hoverable, setHoverable] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mq = window.matchMedia("(hover: hover)")
    const apply = () => setHoverable(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  // Measure the wrapper's natural width once after mount, then pin it.
  // We deliberately measure BEFORE the collapsed state ever applies so
  // we always get the full icon+wordmark width.
  useLayoutEffect(() => {
    if (!symbolOnly && wrapperRef.current) {
      setLockedWidth(wrapperRef.current.offsetWidth)
    }
  }, [symbolOnly, height])

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
        {CORE}
      </svg>
    )
  }

  return (
    <span
      ref={wrapperRef}
      className="aggrai-logo-wrap"
      onMouseEnter={hoverable ? () => {
        if (expandTimer.current) clearTimeout(expandTimer.current)
        setExpanding(false)
        setCollapsed(true)
      } : undefined}
      onMouseLeave={hoverable ? () => {
        setCollapsed(false)
        setExpanding(true)
        if (expandTimer.current) clearTimeout(expandTimer.current)
        expandTimer.current = setTimeout(() => setExpanding(false), 900)
      } : undefined}
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
        className={`aggrai-logo ${collapsed ? "is-collapsed" : ""} ${expanding ? "is-expanding" : ""} ${className}`}
        aria-label="aggrai"
        style={{ ["--aggrai-size" as keyof CSSProperties]: `${height}px` } as CSSProperties}
      >
        <svg className="aggrai-icon" viewBox="-12 -12 124 124" aria-hidden="true">
          {MESH}
          {CORE}
        </svg>
        <span className="aggrai-word">
          <b>a</b><b>g</b><b>g</b><b>r</b><b>a</b><b>i</b>
        </span>
      </span>
    </span>
  )
}
