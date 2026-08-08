import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { currentAdminEmail, listAdmins } from "@/lib/admin";
import { addAdmin, removeAdmin } from "./actions";

// Internal dashboard — the handful of numbers worth glancing at daily. Ad-hoc
// exploration is deliberately NOT this page's job (see AGG-55: Metabase, deferred).
//
// Server component throughout: the session check, the allowlist lookup and the
// aggregation all happen server-side, so there is no /api/admin/* endpoint to
// attack and no service-role data reaching the browser beyond what's rendered.

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — aggrai", robots: { index: false, follow: false } };

type Row = Record<string, string | number | null>;
interface Metrics {
  days: number;
  spend_total: number; spend_user: number;
  spend_by_role: Row[] | null; spend_by_day: Row[] | null;
  asks_total: number; asks_user: number; asks_by_source: Row[] | null;
  active_users: number; signups: number; profiles_total: number; by_tier: Row[] | null;
  top_models: Row[] | null;
  summariser_p50_s: number | null; answer_p50_s: number | null;
}

const usd = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
const num = (n: unknown) => Number(n ?? 0).toLocaleString();

export default async function AdminPage({
  searchParams,
}: { searchParams: Promise<{ tab?: string; days?: string; error?: string }> }) {
  const sp = await searchParams;
  const me = await currentAdminEmail();

  if (!me) {
    return (
      <Shell>
        <div className="rounded-2xl border border-white/10 bg-surface-1 p-6">
          <h1 className="text-lg font-semibold text-white">Admin</h1>
          <p className="mt-2 text-sm text-white/60">
            This page is restricted. Sign in with an authorised account to continue.
          </p>
          <Link href="/signin?next=/admin" className="mt-4 inline-block text-sm font-medium text-teal-300 hover:text-teal-200">
            Sign in →
          </Link>
        </div>
      </Shell>
    );
  }

  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const tab = sp.tab === "access" ? "access" : "overview";

  return (
    <Shell>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Admin</h1>
          <p className="text-[11px] text-white/45">Signed in as {me}</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-surface-1 p-1">
          <Tab href="/admin" active={tab === "overview"}>Overview</Tab>
          <Tab href="/admin?tab=access" active={tab === "access"}>Access</Tab>
        </div>
      </div>

      {tab === "access" ? <AccessTab me={me} error={sp.error} /> : <OverviewTab days={days} />}
    </Shell>
  );
}

async function OverviewTab({ days }: { days: number }) {
  const { data, error } = await createAdminClient().rpc("admin_metrics", { p_days: days });
  if (error || !data) {
    return <Card><p className="text-sm text-red-300">Could not load metrics{error ? `: ${error.message}` : ""}.</p></Card>;
  }
  const m = data as unknown as Metrics;
  const costPerUserAsk = m.asks_user > 0 ? m.spend_user / m.asks_user : 0;
  const overheadPct = m.spend_total > 0 ? (1 - m.spend_user / m.spend_total) * 100 : 0;
  const maxDay = Math.max(1, ...(m.spend_by_day ?? []).map((d) => Number(d.spend) || 0));

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {[7, 30, 90].map((d) => (
          <Link key={d} href={`/admin?days=${d}`}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${d === days ? "bg-teal-400/15 text-teal-200 border border-teal-400/25" : "text-white/55 hover:text-white border border-white/10"}`}>
            {d}d
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={`Spend · ${days}d`} value={usd(m.spend_total)} />
        <Stat label="Serving real users" value={usd(m.spend_user)} sub={`${overheadPct.toFixed(0)}% is overhead`} tone={overheadPct > 80 ? "warn" : undefined} />
        <Stat label="Cost per real ask" value={`$${costPerUserAsk.toFixed(3)}`} sub={`${num(m.asks_user)} real asks`} />
        <Stat label="Active users" value={num(m.active_users)} sub={`${num(m.profiles_total)} accounts · ${num(m.signups)} new`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Where the money goes"
          note="The summariser runs once per ask but is the priciest component — it reads every answer.">
          <Bars rows={(m.spend_by_role ?? []).map((r) => ({
            label: String(r.role), value: Number(r.spend), right: usd(Number(r.spend)), sub: `${num(r.n)} runs`,
          }))} />
        </Card>

        <Card title="Traffic mix" note="Synthetic + warm are our own monitoring and cache-warming, not people.">
          <Bars rows={(m.asks_by_source ?? []).map((r) => ({
            label: String(r.source), value: Number(r.n), right: num(r.n),
          }))} />
        </Card>
      </div>

      <Card title="Speed">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Summariser p50" value={m.summariser_p50_s != null ? `${m.summariser_p50_s}s` : "—"}
            sub="last, serial, blocking" tone={Number(m.summariser_p50_s) > 32 ? "warn" : undefined} />
          <Stat label="Answer p50" value={m.answer_p50_s != null ? `${m.answer_p50_s}s` : "—"} sub="per model, parallel" />
        </div>
      </Card>

      <Card title="Top models by spend">
        <div className="space-y-1.5">
          {(m.top_models ?? []).map((r) => (
            <div key={String(r.model)} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-white/75">{String(r.model)}</span>
              <span className="shrink-0 text-xs tabular-nums text-white/50">
                {num(r.n)} runs · {r.p50_s ?? "—"}s · <span className="text-white/80">{usd(Number(r.spend))}</span>
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`Daily spend · ${days}d`}>
        <div className="flex h-24 items-end gap-[3px]">
          {(m.spend_by_day ?? []).map((d) => (
            <div key={String(d.d)} className="flex-1 rounded-t bg-teal-400/45"
              style={{ height: `${Math.max(3, (Number(d.spend) / maxDay) * 100)}%` }}
              title={`${d.d} — ${usd(Number(d.spend))}`} />
          ))}
        </div>
      </Card>

      <Card title="Accounts by tier">
        <Bars rows={(m.by_tier ?? []).map((r) => ({ label: String(r.tier), value: Number(r.n), right: num(r.n) }))} />
      </Card>
    </div>
  );
}

async function AccessTab({ me, error }: { me: string; error?: string }) {
  const admins = await listAdmins();
  return (
    <div className="space-y-4">
      <Card title="Who can open this page"
        note="Stored in the database, not an env var, so changes take effect immediately. You can't remove yourself, and the last admin can't be removed.">
        <form action={addAdmin} className="mb-4 flex flex-wrap gap-2">
          <input name="email" type="email" required placeholder="name@example.com"
            className="min-w-0 flex-1 rounded-lg border border-white/15 bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none" />
          <button type="submit"
            className="rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-teal-300">
            Add admin
          </button>
        </form>
        {error && <p className="mb-3 text-xs text-red-300">{error}</p>}

        <div className="space-y-1.5">
          {admins.map((a) => {
            const self = a.email === me;
            return (
              <div key={a.email} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-surface-2 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm text-white/85">
                    {a.email}{self && <span className="ml-2 text-[11px] text-teal-300/80">you</span>}
                  </div>
                  <div className="text-[11px] text-white/40">
                    added {a.added_by === "seed" ? "at setup" : `by ${a.added_by ?? "unknown"}`}
                  </div>
                </div>
                {!self && admins.length > 1 && (
                  <form action={removeAdmin}>
                    <input type="hidden" name="email" value={a.email} />
                    <button type="submit"
                      className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 transition hover:border-red-300/40 hover:text-red-200">
                      Remove
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-navy">
      <div className="mx-auto max-w-4xl px-4 py-10">{children}</div>
    </div>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${active ? "bg-white/10 text-white" : "text-white/55 hover:text-white"}`}>
      {children}
    </Link>
  );
}

function Card({ title, note, children }: { title?: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-1 p-4">
      {title && <div className="text-sm font-medium text-white">{title}</div>}
      {note && <p className="mt-0.5 mb-3 text-[11px] leading-relaxed text-white/45">{note}</p>}
      {!note && title && <div className="mb-3" />}
      {children}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div className="rounded-xl border border-white/10 bg-surface-1 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-white/45">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold tabular-nums ${tone === "warn" ? "text-amber-300" : "text-white"}`}>{value}</div>
      {sub && <div className="text-[11px] text-white/45">{sub}</div>}
    </div>
  );
}

function Bars({ rows }: { rows: { label: string; value: number; right: string; sub?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-white/75">{r.label}</span>
            <span className="shrink-0 tabular-nums text-white/55">
              {r.sub && <span className="text-white/35">{r.sub} · </span>}{r.right}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-teal-400/60" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
