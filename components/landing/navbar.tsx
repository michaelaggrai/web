"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { AccountMenu } from "@/components/account-menu"
import { useTier } from "@/lib/use-tier"

// Primary site navigation. Renders on the landing page AND the static content
// pages (via LegalShell) so there's one consistent menu across the marketing
// surface — previously the only links anywhere were "/" and "/app", so pages
// like Docs/Pricing/Models were unreachable from the chrome.
const NAV_LINKS = [
  { href: "/models", label: "Models" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/help", label: "Help" },
]

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // Logged-in users shouldn't see "Get started" (it reads as a sign-up CTA
  // next to their own account avatar). Swap it for "Open app" once we know
  // they're authenticated. Pre-resolve we default to "Get started" — the
  // anonymous case, and what SSR renders, so there's no hydration mismatch.
  const { authenticated, resolved } = useTier()
  const loggedIn = resolved && authenticated

  // On the landing itself, clicking the logo is a no-op Link navigation — turn
  // it into a "refresh" feel instead. On any other page the Link navigates
  // home normally.
  function handleLogoClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (pathname === "/") {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: "smooth" })
      router.refresh()
    }
  }

  const linkClass = (href: string) =>
    `text-sm transition-colors ${
      pathname === href ? "text-white font-medium" : "text-white/60 hover:text-white"
    }`

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" aria-label="aggrai" onClick={handleLogoClick}>
              <Logo height={28} gradientId="nav-g" />
            </Link>
            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map(l => (
                <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              className="bg-white/10 hover:bg-white/15 text-white font-medium text-sm rounded-full px-5 border border-white/10"
              asChild
            >
              <Link href="/app">{loggedIn ? "Open app" : "Get started"}</Link>
            </Button>
            <AccountMenu />
            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
              className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      {open && (
        <div className="md:hidden border-t border-white/5 bg-navy/95 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col">
            {NAV_LINKS.map(l => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`py-2.5 ${pathname === l.href ? "text-white font-medium" : "text-white/70 hover:text-white"}`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
