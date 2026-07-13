-- AGG-21 internal-analytics views (aggrai V2, Phase 1d).
-- Founder-only: created in a dedicated `analytics` schema that is NOT exposed to
-- the PostgREST API, so there is no anon/authenticated path to them. They run
-- with definer rights (see ALL rows — exactly what internal analytics needs).
-- Query via Supabase Studio SQL editor or psql:  SELECT * FROM analytics.<view>;
-- Applied to project kmkuajbtygqwbipcgxxa.

CREATE SCHEMA IF NOT EXISTS analytics;

-- Base: total LLM cost per question (answer runs + summariser). Classifier cost
-- is tracked separately in usage_events (it is not linked per-question).
CREATE OR REPLACE VIEW analytics.question_cost AS
SELECT q.id, q.ts, q.tier, q.source, q.user_id, q.email, q.anon_id, q.from_cache, q.example,
       COALESCE((SELECT sum(mr.cost_usd) FROM public.model_runs mr WHERE mr.question_id = q.id), 0)
       + COALESCE((q.summariser->>'cost_usd')::numeric, 0) AS cost_usd
FROM public.questions q;

-- Daily cost + ask volume per tier & source. Validates per-tier per-query cost.
CREATE OR REPLACE VIEW analytics.cost_by_tier_day AS
SELECT date_trunc('day', ts)::date AS day,
       COALESCE(tier, 'unknown') AS tier,
       source,
       count(*) AS asks,
       round(sum(cost_usd), 4) AS cost_usd,
       round(avg(cost_usd), 6) AS avg_cost_per_ask
FROM analytics.question_cost
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 5 DESC;

-- Daily cost + call volume per model (every role: answer/summary/classifier/...).
CREATE OR REPLACE VIEW analytics.cost_by_model_day AS
SELECT date_trunc('day', ts)::date AS day,
       model,
       count(*) AS calls,
       round(sum(cost_usd), 4) AS cost_usd
FROM public.usage_events
GROUP BY 1, 2
ORDER BY 1 DESC, 4 DESC;

-- Real users by asks/month, flagged when > 60/mo (Premium abuser tail).
CREATE OR REPLACE VIEW analytics.abuser_tail AS
SELECT date_trunc('month', ts)::date AS month,
       COALESCE(email, 'anon:' || left(anon_id, 8)) AS who,
       user_id, tier,
       count(*) AS asks,
       round(sum(cost_usd), 4) AS cost_usd
FROM analytics.question_cost
WHERE source = 'user'
GROUP BY 1, 2, 3, 4
HAVING count(*) > 60
ORDER BY 1 DESC, 5 DESC;

-- Weekly cache hit rate.
CREATE OR REPLACE VIEW analytics.cache_hit_rate AS
SELECT date_trunc('week', ts)::date AS week,
       count(*) AS asks,
       count(*) FILTER (WHERE from_cache) AS cache_hits,
       round(100.0 * count(*) FILTER (WHERE from_cache) / nullif(count(*), 0), 1) AS hit_rate_pct
FROM public.questions
GROUP BY 1
ORDER BY 1 DESC;

-- Daily funnel. `asked` is live from questions; landed/signed_up/upgraded fill
-- in once the frontend + Stripe webhook emit into the events table.
CREATE OR REPLACE VIEW analytics.funnel_daily AS
SELECT day,
       sum((kind = 'landed')::int)    AS landed,
       sum((kind = 'asked')::int)     AS asked,
       sum((kind = 'signed_up')::int) AS signed_up,
       sum((kind = 'upgraded')::int)  AS upgraded
FROM (
  SELECT date_trunc('day', ts)::date AS day, 'asked' AS kind
  FROM public.questions WHERE source = 'user'
  UNION ALL
  SELECT date_trunc('day', created_at)::date, event_type
  FROM public.events WHERE event_type IN ('landed', 'signed_up', 'upgraded')
) x
GROUP BY day
ORDER BY day DESC;

-- Signup-cohort retention (signed-in users): active users by weeks-since-signup.
CREATE OR REPLACE VIEW analytics.cohort_retention AS
WITH signup AS (
  SELECT id AS user_id, date_trunc('week', created_at)::date AS cohort_week FROM public.profiles
),
activity AS (
  SELECT DISTINCT user_id, date_trunc('week', ts)::date AS active_week
  FROM public.questions WHERE user_id IS NOT NULL
)
SELECT s.cohort_week,
       count(DISTINCT s.user_id) AS cohort_size,
       ((a.active_week - s.cohort_week) / 7) AS week_offset,
       count(DISTINCT a.user_id) AS active_users
FROM signup s
LEFT JOIN activity a ON a.user_id = s.user_id AND a.active_week >= s.cohort_week
GROUP BY s.cohort_week, week_offset
ORDER BY s.cohort_week DESC, week_offset;

-- Classifier volume + cost (proxy). True accuracy needs classifier_verdict
-- events vs outcome — deferred until those are emitted (plan Phase-1 note).
CREATE OR REPLACE VIEW analytics.classifier_activity AS
SELECT date_trunc('day', ts)::date AS day,
       count(*) AS classifier_calls,
       round(sum(cost_usd), 4) AS cost_usd,
       round(avg(runtime_ms)) AS avg_runtime_ms
FROM public.usage_events
WHERE role = 'classifier'
GROUP BY 1
ORDER BY 1 DESC;
