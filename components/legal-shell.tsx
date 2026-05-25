import Link from "next/link";
import { Logo } from "@/components/logo";
import { AccountMenu } from "@/components/account-menu";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

/**
 * Shared layout for static informational pages (about, help, docs, etc.).
 * Same dark navy treatment as /terms and /privacy so the site reads as
 * one product, not a stack of unrelated pages. Top row shows the Logo
 * on the left and the AccountMenu avatar (or "Sign in" link for
 * anonymous users) on the right so account access is one click away
 * from every static page.
 */
export function LegalShell({ title, subtitle, children }: Props) {
  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547] px-4 py-12 overflow-hidden">
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-3xl">
        <div className="mb-10 flex items-center justify-between gap-3">
          <Link href="/" aria-label="aggrai" className="inline-block">
            <Logo height={28} gradientId="page-logo" />
          </Link>
          <AccountMenu variant="topbar" />
        </div>

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
