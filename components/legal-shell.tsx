import Link from "next/link";
import { Navbar } from "@/components/landing/navbar";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

/**
 * Shared layout for static informational pages (about, help, docs, etc.).
 * Same dark navy treatment as /terms and /privacy so the site reads as
 * one product, not a stack of unrelated pages. Renders the shared Navbar
 * (logo + Models/Pricing/Docs/Help menu + account + Get started) at the
 * top so every static page has the same global navigation as the landing
 * page — previously these pages had only a bare logo + account avatar and
 * no way to reach the rest of the site. pt-24 clears the fixed navbar.
 */
export function LegalShell({ title, subtitle, children }: Props) {
  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547] px-4 pt-24 pb-12 overflow-hidden">
      <Navbar />
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 text-base text-white/50 max-w-xl">{subtitle}</p>
        )}

        <div className="mt-10">{children}</div>

        <div className="mt-14 pt-6 border-t border-white/5 flex items-center gap-5 text-sm">
          <Link href="/" className="text-white/40 hover:text-white">Home</Link>
          <Link href="/help" className="text-white/40 hover:text-white">Help</Link>
          <Link href="/privacy" className="text-white/40 hover:text-white">Privacy</Link>
          <Link href="/terms" className="text-white/40 hover:text-white">Terms</Link>
        </div>
      </div>
    </div>
  );
}
