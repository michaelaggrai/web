"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

function Logo() {
  // SVG is 3120×800 HD sheet with 5 stacked variants.
  // Rendered at height=200 → 780×200, so each row = 40px.
  // Clip container to 40px height → shows only palette 1 (top row).
  // Width 540px shows symbol + full "aggrai" wordmark.
  // White bg needed because the wordmark uses dark navy ink.
  return (
    <div className="bg-white rounded-lg overflow-hidden" style={{ height: 40, width: 540 }}>
      <img
        src="/logo.svg"
        alt="aggrai"
        style={{ height: 200, width: 'auto', maxWidth: 'none' }}
      />
    </div>
  )
}

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Logo />
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="text-white/60 hover:text-white hover:bg-white/5 font-normal text-sm"
              asChild
            >
              <Link href="/login">Log in</Link>
            </Button>
            <Button
              className="bg-white/10 hover:bg-white/15 text-white font-medium text-sm rounded-full px-5 border border-white/10"
              asChild
            >
              <Link href="/app">Get started</Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
