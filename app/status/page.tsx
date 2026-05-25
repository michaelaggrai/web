import { LegalShell } from "@/components/legal-shell";

export const metadata = {
  title: "Status — aggrai",
  description: "Current service availability for aggrai.",
};

type SystemStatus = "operational" | "degraded" | "outage";

const SYSTEMS: { name: string; status: SystemStatus; note?: string }[] = [
  { name: "Web app", status: "operational" },
  { name: "Model routing (OpenRouter)", status: "operational" },
  { name: "Authentication (Supabase)", status: "operational" },
  { name: "Example cache", status: "operational" },
];

const COLORS: Record<SystemStatus, { dot: string; text: string; label: string }> = {
  operational: { dot: "bg-emerald-400 shadow-emerald-400/40", text: "text-emerald-300", label: "Operational" },
  degraded:    { dot: "bg-amber-400 shadow-amber-400/40",     text: "text-amber-300",   label: "Degraded" },
  outage:      { dot: "bg-red-400 shadow-red-400/40",         text: "text-red-300",     label: "Outage"   },
};

export default function StatusPage() {
  const worst: SystemStatus = SYSTEMS.some(s => s.status === "outage")
    ? "outage"
    : SYSTEMS.some(s => s.status === "degraded") ? "degraded" : "operational";

  const overall = COLORS[worst];
  const overallText = worst === "operational"
    ? "All systems operational"
    : worst === "degraded"
      ? "Partial degradation"
      : "Service disruption";

  return (
    <LegalShell
      title="Status"
      subtitle="Live state of the aggrai stack. A synthetic uptime check probes the API every 5 minutes and reports failures to Sentry; the per-system summary below is updated manually when an incident is confirmed. A fully live status page (driven directly from the synthetic check) is on the V2 roadmap."
    >
      {/* Headline banner */}
      <div className={`rounded-2xl border bg-white/[0.04] p-5 flex items-center gap-3 ${
        worst === "operational" ? "border-emerald-400/30" : worst === "degraded" ? "border-amber-400/30" : "border-red-400/30"
      }`}>
        <span className={`inline-block h-2.5 w-2.5 rounded-full shadow-[0_0_10px] ${overall.dot}`} aria-hidden />
        <span className={`text-sm font-medium ${overall.text}`}>{overallText}</span>
      </div>

      {/* Per-system breakdown */}
      <ul className="mt-6 divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {SYSTEMS.map(s => {
          const c = COLORS[s.status];
          return (
            <li key={s.name} className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{s.name}</p>
                {s.note && <p className="text-xs text-white/40 mt-0.5">{s.note}</p>}
              </div>
              <span className="flex items-center gap-2 shrink-0">
                <span className={`inline-block h-2 w-2 rounded-full shadow-[0_0_8px] ${c.dot}`} aria-hidden />
                <span className={`text-xs font-medium ${c.text}`}>{c.label}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-xs text-white/40">
        Something looks broken from where you are? Email{" "}
        <a href="mailto:hello@aggrai.com" className="text-teal-300 hover:underline underline-offset-2">
          hello@aggrai.com
        </a>{" "}
        — we&apos;d rather hear it twice than not at all.
      </p>
    </LegalShell>
  );
}
