import Link from "next/link"

function Logo() {
  return (
    <span className="text-xl font-semibold tracking-tight">
      <span className="text-white/90">aggr</span>
      <span className="bg-gradient-to-r from-teal-400 to-teal-300 bg-clip-text text-transparent">ai</span>
    </span>
  )
}

type FooterLink = { label: string; href: string; external?: boolean }

const FOOTER_LINKS: Record<string, FooterLink[]> = {
  Product: [
    { label: "Features",  href: "/#features" },
    { label: "Models",    href: "/models"    },
    { label: "Pricing",   href: "/pricing"   },
    { label: "Try it",    href: "/app"       },
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
            <Logo />
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
                    {link.external ? (
                      <a
                        href={link.href}
                        className="text-sm text-white/40 hover:text-white/70 transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-white/40 hover:text-white/70 transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
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
              href="https://github.com/michaelaggrai/web"
              target="_blank"
              rel="noreferrer"
              className="text-white/30 hover:text-white/60 transition-colors"
              aria-label="GitHub"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </a>
            <a
              href="mailto:hello@aggrai.com"
              className="text-white/30 hover:text-white/60 transition-colors"
              aria-label="Email"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2 6.5A2.5 2.5 0 014.5 4h15A2.5 2.5 0 0122 6.5v11a2.5 2.5 0 01-2.5 2.5h-15A2.5 2.5 0 012 17.5v-11zm2.5-.5a.5.5 0 00-.5.5v.7l8 5 8-5v-.7a.5.5 0 00-.5-.5h-15zM20 9.4l-7.47 4.67a1 1 0 01-1.06 0L4 9.4v8.1a.5.5 0 00.5.5h15a.5.5 0 00.5-.5V9.4z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
