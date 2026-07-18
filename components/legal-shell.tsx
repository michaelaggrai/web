import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

/**
 * Shared layout for static informational pages (about, help, docs, etc.).
 * Same dark navy treatment as /terms and /privacy so the site reads as one
 * product, not a stack of unrelated pages. Renders the shared Navbar at the
 * top and the full site-map Footer at the bottom, so every static page has
 * the same global navigation as the landing page (previously these pages had
 * only a bare logo + a thin Home/Help/Privacy/Terms row).
 *
 * flex-col + flex-1 content keeps the footer pinned to the bottom even on
 * short pages (e.g. /status). pt-24 clears the fixed navbar.
 */
export function LegalShell({ title, subtitle, children }: Props) {
  return (
    <div className="relative min-h-dvh flex flex-col bg-navy">
      <Navbar />
      <div className="relative flex-1 px-4 pt-24 pb-16 overflow-hidden">
        <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px]" />

        <div className="relative z-10 mx-auto max-w-3xl">
          <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-base text-white/50 max-w-xl">{subtitle}</p>
          )}

          <div className="mt-10">{children}</div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
