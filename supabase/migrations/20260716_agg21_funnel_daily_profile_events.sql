-- AGG-21: repair analytics.funnel_daily.
--
-- It read the `events` table for landed / signed_up / upgraded — but nothing in
-- either repo has ever emitted those event types (only bad_result and
-- provider_failure reach `events`). So three of its four columns were
-- structurally always 0, while `profile_events` — trigger-driven on every
-- profiles tier write, so it catches the upgrade route, the Stripe webhook and
-- any future path — already carried signup / upgrade / downgrade.
-- Point the funnel at the data that actually exists.
--
-- `landed` is DROPPED rather than kept as a permanent zero: there is no
-- page-view source today. Re-add it if/when one lands (Vercel Analytics or an
-- explicit emitter). A column that can only ever read 0 is worse than an absent
-- one — it invites belief.
--
-- `downgraded` is added: profile_events has it for free and it's the churn
-- counterpart to upgraded.
--
-- DROP + CREATE (not CREATE OR REPLACE) because the column list changes.
-- Verified: no other view depends on funnel_daily.

drop view if exists analytics.funnel_daily;

create view analytics.funnel_daily as
  select day,
    sum((kind = 'asked')::int)     as asked,
    sum((kind = 'signup')::int)    as signed_up,
    sum((kind = 'upgrade')::int)   as upgraded,
    sum((kind = 'downgrade')::int) as downgraded
  from (
    -- Real human asks only (excludes synthetic / warm / internal traffic).
    select date_trunc('day', q.ts)::date as day, 'asked'::text as kind
      from public.questions q
     where q.source = 'user'
    union all
    -- Account lifecycle. 'snapshot' rows are the one-time seed, not events.
    select date_trunc('day', pe.ts)::date as day, pe.event_type
      from public.profile_events pe
     where pe.event_type in ('signup', 'upgrade', 'downgrade')
  ) x
  group by day
  order by day desc;
