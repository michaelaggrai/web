"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="34" height="28" viewBox="0 0 52 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lg" x1="26" y1="4" x2="26" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2DD4BF" />
            <stop offset="100%" stopColor="#00B5A3" />
          </linearGradient>
        </defs>
        {/* Left C */}
        <path d="M 28,4 C 14,4 7,12 7,21 C 7,30 14,38 28,38"
          stroke="url(#lg)" strokeWidth="5" strokeLinecap="round" fill="none" />
        {/* Right C */}
        <path d="M 24,4 C 38,4 45,12 45,21 C 45,30 38,38 24,38"
          stroke="url(#lg)" strokeWidth="5" strokeLinecap="round" fill="none" />
        {/* Dots */}
        <circle cx="17" cy="21" r="3" fill="url(#lg)" />
        <circle cx="35" cy="21" r="3" fill="url(#lg)" />
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
