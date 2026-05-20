"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

function Logo() {
  return (
    <img src="/logo-light.svg" alt="aggrai" style={{ height: 36, width: 'auto' }} />
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
