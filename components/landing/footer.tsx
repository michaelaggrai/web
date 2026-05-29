import Link from "next/link"
import { Logo as BrandLogo } from "@/components/logo"

type FooterLink = { label: string; href: string }

const FOOTER_LINKS: Record<string, FooterLink[]> = {
  Product: [
    { label: "Models",    href: "/models"  },
    { label: "Pricing",   href: "/pricing" },
    { label: "Try it",    href: "/app"     },
  ],
  Resources: [
    { label: "Docs",   href: "/docs"   },
    { label: "Help",   href: "/help"   },
    { label: "Status", href: "/status" },
  ],
  Company: [
    { label: "About",   href: "/about" },
    { label: "Contact", href: "/contact" },
  ],
  Legal: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms",   href: "/terms"   },
  ],
}

export function Footer() {
  return (
    <footer className="bg-navy">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" aria-label="aggrai" className="inline-block">
              <BrandLogo height={28} gradientId="footer-logo" />
            </Link>
            <p className="mt-3 text-sm text-white/40 leading-relaxed">
              Compare AI models.
              <br />
              Get better answers.
            </p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-medium text-white/70 text-sm mb-4">{category}</h4>
              <ul className="space-y-2.5">
                {links.map(link => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/40 hover:text-white/70 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">
            © {new Date().getFullYear()} aggrai. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <a
              href="https://x.com/aggrai"
              target="_blank"
              rel="noreferrer"
              className="text-white/30 hover:text-white/60 transition-colors"
              aria-label="X (Twitter)"
            >
              {/* X.com logo — the slashed-X glyph */}
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <Link
              href="/contact"
              className="text-white/30 hover:text-white/60 transition-colors"
              aria-label="Contact"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2 6.5A2.5 2.5 0 014.5 4h15A2.5 2.5 0 0122 6.5v11a2.5 2.5 0 01-2.5 2.5h-15A2.5 2.5 0 012 17.5v-11zm2.5-.5a.5.5 0 00-.5.5v.7l8 5 8-5v-.7a.5.5 0 00-.5-.5h-15zM20 9.4l-7.47 4.67a1 1 0 01-1.06 0L4 9.4v8.1a.5.5 0 00.5.5h15a.5.5 0 00.5-.5V9.4z"/>
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
