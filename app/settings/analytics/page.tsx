"use client";

import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { Logo } from "@/components/logo";
import { AnalyticsDashboard } from "@/components/settings/analytics";

// AGG-27 P6a: dedicated route for the analytics dashboard (linked from Settings).
// Auth is handled by the endpoint — the dashboard shows a sign-in prompt on 401.

export default function AnalyticsPage() {
  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547] px-4 py-10">
      <div className="pointer-events-none absolute top-24 left-1/4 h-[420px] w-[420px] rounded-full bg-teal-500/10 blur-[120px]" />
      <div className="relative z-10 mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" aria-label="aggrai"><Logo height={24} gradientId="analytics-logo" /></Link>
          <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Settings
          </Link>
        </div>

        <div className="mb-6 flex items-center gap-2.5">
          <BarChart3 className="h-5 w-5 text-teal-300" />
          <h1 className="text-2xl font-semibold tracking-tight text-white">Your analytics</h1>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <AnalyticsDashboard />
        </div>
      </div>
    </div>
  );
}
