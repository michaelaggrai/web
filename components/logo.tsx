"use client"

import type { CSSProperties } from "react"

type LogoProps = {
  height?: number
  spinning?: boolean
  className?: string
  /** Kept for backwards-compat with old callers — unused by the new logo. */
  gradientId?: string
  symbolOnly?: boolean
}

const MESH = (
  <g className="aggrai-mesh">
    <path className="aggrai-edge" d="M50 20 L78 41 L68 74 L32 74 L22 41 Z" />
    <line className="aggrai-spoke" x1="50" y1="50" x2="50" y2="20" />
    <line className="aggrai-spoke" x1="50" y1="50" x2="78" y2="41" />
    <line className="aggrai-spoke" x1="50" y1="50" x2="68" y2="74" />
    <line className="aggrai-spoke" x1="50" y1="50" x2="32" y2="74" />
    <line className="aggrai-spoke" x1="50" y1="50" x2="22" y2="41" />
    <circle className="aggrai-node" cx="50" cy="20" r="4" />
    <circle className="aggrai-node" cx="78" cy="41" r="4" />
    <circle className="aggrai-node" cx="68" cy="74" r="4" />
    <circle className="aggrai-node" cx="32" cy="74" r="4" />
    <circle className="aggrai-node" cx="22" cy="41" r="4" />
  </g>
)

const CORE = <circle className="aggrai-core" cx="50" cy="50" r="7" />

export function Logo({
  height = 36,
  spinning = false,
  className = "",
  symbolOnly = false,
}: LogoProps) {
  if (symbolOnly) {
    return (
      <svg
        className={`aggrai-icon ${spinning ? "is-loading" : ""} ${className}`}
        viewBox="0 0 100 100"
        width={height}
        height={height}
        aria-label="aggrai"
      >
        {MESH}
        {CORE}
      </svg>
    )
  }

  return (
    <span
      className={`aggrai-logo ${className}`}
      aria-label="aggrai"
      style={{ ["--aggrai-size" as keyof CSSProperties]: `${height}px` } as CSSProperties}
    >
      <svg className="aggrai-icon" viewBox="0 0 100 100" aria-hidden="true">
        {MESH}
        {CORE}
      </svg>
      <span className="aggrai-word">
        <b>a</b><b>g</b><b>g</b><b>r</b><b>a</b><b>i</b>
      </span>
    </span>
  )
}
