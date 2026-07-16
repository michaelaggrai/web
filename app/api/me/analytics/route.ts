import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// AGG-27 P6a: per-user analytics — Overview + Models. RLS-scoped read of the
// caller's OWN questions + model_runs (Pattern B, cookie client — no admin),
// aggregated in JS. Neither tab needs topic tagging (that's the Insights phase);
// everything here comes from questions + model_runs, which are fully populated.
//
// Tier window: Free sees at most the last 30 days and no cost figures; Pro/Premium
// see all history + cost. The window is enforced HERE (server-side), never trusted
// from the client.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const DAY_MS = 86_400_000;
type Range = "7d" | "30d" | "all";

function clientFrom(req: NextRequest) {
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} },
  });
}

// Free is capped at 30 days; paid may request "all". An out-of-range param falls
// back to the tier's default (paid → all, free → 30d).
function clampRange(requested: string | null, paid: boolean): { range: Range; clamped: boolean } {
  const r = requested === "7d" || requested === "30d" || requested === "all"
    ? requested
    : (paid ? "all" : "30d");
  if (r === "all" && !paid) return { range: "30d", clamped: true };
  return { range: r as Range, clamped: false };
}

function sinceFor(range: Range): string | null {
  if (range === "all") return null;
  return new Date(Date.now() - (range === "7d" ? 7 : 30) * DAY_MS).toISOString();
}

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

const dayKey = (iso: string) => iso.slice(0, 10); // UTC YYYY-MM-DD

// Longest run of consecutive active days, and the streak ending today/yesterday.
// Days are keyed in UTC (a tz refinement can come later).
function computeStreaks(days: string[]): { current: number; longest: number } {
  if (days.length === 0) return { current: 0, longest: 0 };
  const set = new Set(days);
  const sorted = [...set].sort();
  let longest = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = Date.parse(sorted[i - 1] + "T00:00:00Z");
    const cur = Date.parse(sorted[i] + "T00:00:00Z");
    if (cur - prev === DAY_MS) { run++; longest = Math.max(longest, run); } else { run = 1; }
  }
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - DAY_MS).toISOString());
  let current = 0;
  if (set.has(today) || set.has(yesterday)) {
    let cursor = set.has(today) ? today : yesterday;
    while (set.has(cursor)) {
      current++;
      cursor = dayKey(new Date(Date.parse(cursor + "T00:00:00Z") - DAY_MS).toISOString());
    }
  }
  return { current, longest };
}

function peakHourLabel(hours: number[]): string | null {
  if (hours.length === 0) return null;
  const counts = new Array(24).fill(0);
  for (const h of hours) counts[h]++;
  let best = 0;
  for (let h = 1; h < 24; h++) if (counts[h] > counts[best]) best = h;
  const ampm = best < 12 ? "AM" : "PM";
  return `${best % 12 === 0 ? 12 : best % 12} ${ampm}`;
}

// A playful comparison for the token total (matches the dashboard's caption).
function funFact(tokens: number): string {
  const words = Math.round(tokens * 0.75);
  const MOBY = 206_052; // words in Moby-Dick
  if (words >= MOBY) {
    const x = words / MOBY;
    return `≈ ${x < 10 ? x.toFixed(1) : Math.round(x)}× the length of Moby-Dick`;
  }
  const pages = Math.round(words / 300); // ~300 words per book page
  if (pages >= 2) return `≈ ${pages.toLocaleString()} pages of a book`;
  return `≈ ${words.toLocaleString()} words of text`;
}

interface Run {
  question_id: string;
  model: string;
  role: string;
  total_tokens: number | null;
  cost_usd: number | null;
  scores: { overall?: number } | null;
}

export async function GET(req: NextRequest) {
  const supabase = clientFrom(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("tier").eq("id", user.id).maybeSingle();
  const tier = (profile?.tier as string) || "free";
  const paid = tier === "pro" || tier === "premium";

  const { range, clamped } = clampRange(req.nextUrl.searchParams.get("range"), paid);
  const since = sinceFor(range);

  // 1) the caller's own questions (RLS policy questions_select_own scopes to owner)
  let query = supabase.from("questions").select("id, ts, conversation_id").eq("user_id", user.id);
  if (since) query = query.gte("ts", since);
  const { data: questions, error: qErr } = await query;
  if (qErr) {
    console.error("[me/analytics]", qErr.message);
    return NextResponse.json({ error: "Could not load analytics" }, { status: 500 });
  }
  const qs = questions ?? [];
  const ids = qs.map((r) => r.id as string);

  // 2) their model_runs (RLS-scoped via question ownership), chunked so a heavy
  // user can't blow the IN() limit. All roles → true token/cost totals.
  const runs: Run[] = [];
  for (const c of chunk(ids, 200)) {
    const { data } = await supabase
      .from("model_runs")
      .select("question_id, model, role, total_tokens, cost_usd, scores")
      .in("question_id", c);
    runs.push(...((data ?? []) as Run[]));
  }

  // --- Overview aggregation ---
  const convSet = new Set<string>();
  let standalone = 0;
  const dayCounts = new Map<string, number>();
  const hours: number[] = [];
  for (const r of qs) {
    const ts = r.ts as string;
    if (r.conversation_id) convSet.add(r.conversation_id as string); else standalone++;
    const dk = dayKey(ts);
    dayCounts.set(dk, (dayCounts.get(dk) ?? 0) + 1);
    hours.push(new Date(ts).getUTCHours());
  }
  const totalTokens = runs.reduce((s, r) => s + (Number(r.total_tokens) || 0), 0);
  const { current, longest } = computeStreaks([...dayCounts.keys()]);

  // --- Per answer-model tallies (the Models tab) ---
  const byModel = new Map<string, { questions: number; tokens: number; cost: number; scoreSum: number; scoreN: number }>();
  for (const r of runs) {
    if (r.role !== "answer") continue;
    const m = byModel.get(r.model) ?? { questions: 0, tokens: 0, cost: 0, scoreSum: 0, scoreN: 0 };
    m.questions++;
    m.tokens += Number(r.total_tokens) || 0;
    m.cost += Number(r.cost_usd) || 0;
    const ov = r.scores?.overall;
    if (typeof ov === "number") { m.scoreSum += ov; m.scoreN++; }
    byModel.set(r.model, m);
  }
  let topModel: string | null = null, topN = 0;
  for (const [m, v] of byModel) if (v.questions > topN) { topN = v.questions; topModel = m; }

  const models = [...byModel.entries()]
    .map(([model, v]) => ({
      model,
      questions: v.questions,
      tokens: v.tokens,
      avgScore: v.scoreN > 0 ? Math.round((v.scoreSum / v.scoreN) * 10) / 10 : null,
      scoredCount: v.scoreN,
      ...(paid ? { cost: Math.round(v.cost * 1e6) / 1e6 } : {}),
    }))
    .sort((a, b) => b.questions - a.questions);

  const dailyActivity = [...dayCounts.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json(
    {
      tier,
      range,
      clampedFromAll: clamped,
      overview: {
        conversations: convSet.size + standalone,
        questions: qs.length,
        totalTokens,
        activeDays: dayCounts.size,
        currentStreak: current,
        longestStreak: longest,
        peakHour: peakHourLabel(hours),
        topModel,
        modelsTried: byModel.size,
        dailyActivity,
        funFact: funFact(totalTokens),
      },
      models,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
