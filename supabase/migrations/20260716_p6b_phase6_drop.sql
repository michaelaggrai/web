-- P6b Phase 6: drop the retired tables/columns — the raw-model collapse endgame.
--
-- First re-point the AGG-21 analytics views off the retiring objects onto
-- model_runs (the unified per-call ledger: answer + summariser + classifier rows).
-- Same columns → CREATE OR REPLACE is safe and keeps the dependent views
-- (abuser_tail + cost_by_tier_day read question_cost). This also fixes a live
-- double-count: question_cost summed model_runs.cost_usd AND questions.summariser
-- .cost_usd, but the summariser is a model_runs row now — same bug the digest had.

-- question_cost: cost = sum(model_runs.cost_usd) only (now the full per-question
-- cost); drops the summariser jsonb read + the double-count.
create or replace view analytics.question_cost as
  select id, ts, tier, source, user_id, email, anon_id, from_cache, example,
    coalesce((select sum(mr.cost_usd) from public.model_runs mr where mr.question_id = q.id), 0::numeric) as cost_usd
  from public.questions q;

-- cost_by_model_day: from model_runs (created_at) instead of usage_events (ts).
create or replace view analytics.cost_by_model_day as
  select date_trunc('day', created_at)::date as day,
    model,
    count(*) as calls,
    round(sum(cost_usd), 4) as cost_usd
  from public.model_runs
  group by date_trunc('day', created_at)::date, model
  order by date_trunc('day', created_at)::date desc, round(sum(cost_usd), 4) desc;

-- classifier_activity: from model_runs role='classifier'.
create or replace view analytics.classifier_activity as
  select date_trunc('day', created_at)::date as day,
    count(*) as classifier_calls,
    round(sum(cost_usd), 4) as cost_usd,
    round(avg(runtime_ms)) as avg_runtime_ms
  from public.model_runs
  where role = 'classifier'
  group by date_trunc('day', created_at)::date
  order by date_trunc('day', created_at)::date desc;

-- Now nothing references the retired objects. Safe because everything is dead,
-- deployed + verified: readers switched to questions+model_runs (frontend
-- lib/thread.ts + backend loadConversationMessages), writers retired, gdpr.ts +
-- daily-digest + these views updated. Data preserved (8 answers + 5,086 summariser
-- rows backfilled to model_runs; per-call cost is model_runs). conversations
-- turn-cache is intentionally KEPT (root still renders from it → root-switch first).
drop table if exists public.messages;
drop table if exists public.usage_events;
alter table public.questions drop column if exists summariser;
