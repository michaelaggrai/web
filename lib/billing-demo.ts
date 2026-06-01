import type { Cycle, Tier } from "@/lib/plans";

// Frontend-only mock of subscription state. There is no Stripe / billing
// backend yet — the real tier still lives in Supabase (flipped by /api/upgrade),
// but the *subscription* details a paying user expects to see (billing cycle,
// renewal date, cancel-at-period-end) have nowhere to live server-side. We stash
// them in localStorage at checkout so Settings can render a coherent, consistent
// "active subscription" view in the demo. When Stripe is wired, this module gets
// replaced by the real subscription object from the billing backend.

const KEY = "aggrai_billing_demo_v1";

export interface DemoBilling {
  tier: Tier;
  cycle: Cycle;
  /** ms epoch when the (mock) subscription started. */
  startedAt: number;
  /** ms epoch when the user scheduled cancellation, if any. */
  canceledAt?: number;
}

function read(): DemoBilling | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as DemoBilling;
    if (v && typeof v.startedAt === "number" && (v.tier === "pro" || v.tier === "premium")) {
      return v;
    }
    return null;
  } catch {
    return null;
  }
}

function write(v: DemoBilling | null) {
  if (typeof window === "undefined") return;
  try {
    if (v === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* private mode / storage full — non-fatal for a demo */
  }
}

export function getDemoBilling(): DemoBilling | null {
  return read();
}

/** Record a (mock) successful checkout. Resets any prior cancellation. */
export function startDemoBilling(tier: Tier, cycle: Cycle, now: number = Date.now()): void {
  write({ tier, cycle, startedAt: now });
}

/** Schedule cancellation at period end (keeps access until renewal in the demo). */
export function cancelDemoBilling(now: number = Date.now()): void {
  const cur = read();
  if (cur) write({ ...cur, canceledAt: now });
}

/** Undo a scheduled cancellation. */
export function resumeDemoBilling(): void {
  const cur = read();
  if (cur) write({ tier: cur.tier, cycle: cur.cycle, startedAt: cur.startedAt });
}

export function clearDemoBilling(): void {
  write(null);
}
