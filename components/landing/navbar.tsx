"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { AccountMenu } from "@/components/account-menu"

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()

  // On the landing itself, clicking the logo while we're already at /
  // would be a no-op Link navigation — so the user only sees the
  // logo animation play and nothing else happens. Intercept and turn
  // it into a "refresh" feel: smooth-scroll to top + router.refresh()
  // re-fetches any RSC payload. From any other page (shouldn't happen
  // — Navbar only renders on /, but cheap to defend) the Link's
  // normal behaviour navigates home as before.
  function handleLogoClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (pathname === "/") {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: "smooth" })
      router.refresh()
    }
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" aria-label="aggrai" onClick={handleLogoClick}>
            <Logo height={28} gradientId="nav-g" />
          </Link>
          <div className="flex items-center gap-3">
            <Button
              className="bg-white/10 hover:bg-white/15 text-white font-medium text-sm rounded-full px-5 border border-white/10"
              asChild
            >
              <Link href="/app">Get started</Link>
            </Button>
            <AccountMenu />
          </div>
        </div>
      </div>
    </nav>
  )
}
