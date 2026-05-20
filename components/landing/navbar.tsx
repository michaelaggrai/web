"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="38" height="26" viewBox="0 0 76 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lg" x1="38" y1="3" x2="38" y2="41" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2DD4BF" />
            <stop offset="100%" stopColor="#00B5A3" />
          </linearGradient>
        </defs>
        {/* Left C — opens to the right */}
        <path d="M 30,3 C 16,3 4,11 4,22 C 4,33 16,41 30,41"
          stroke="url(#lg)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
        {/* Right C — opens to the left */}
        <path d="M 46,3 C 60,3 72,11 72,22 C 72,33 60,41 46,41"
          stroke="url(#lg)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
        {/* Left dot — inside left C */}
        <circle cx="19" cy="22" r="3.5" fill="url(#lg)" />
        {/* Right dot — inside right C */}
        <circle cx="57" cy="22" r="3.5" fill="url(#lg)" />
      </svg>
      <span className="text-2xl font-semibold tracking-tight">
        <span className="text-white">aggr</span>
        <span className="bg-gradient-to-r from-teal-400 to-teal-300 bg-clip-text text-transparent">ai</span>
      </span>
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
