-- AGG-21: complete analytics.funnel_daily — the page-view beacon now feeds it.
--
-- Restores the top of the funnel, which has been missing since the view was
-- written (it read `events` for a `landed` type nothing ever emitted). The
-- beacon (POST /api/events ← components/page-view-beacon.tsx) now writes real
-- page_view rows, so the funnel finally spans the whole pipeline:
--
--   page_views → asked → signed_up → upgraded   (+ downgraded as the churn counterpart)
--
-- Each step reads its OWN pillar — no duplication:
--   page_views          ← events         (the only signal with no entity table)
--   asked               ← questions      (source='user' = real humans)
--   signed_up/upgraded  ← profile_events (trigger-driven, catches every path)
--
-- NAMING: this is `page_views`, deliberately not `landed`. A true "landing" is a
-- session, which needs session_id — and session_id is consent-gated, so a
-- session-based column would silently undercount to consenting visitors only.
-- Raw page views are complete for 100% of traffic. Count what you actually count.
--
-- Bot filtering is handled by the collector being client-side (bots mostly don't
-- run JS); device->>'type'='bot' can't be used as a filter here because device is
-- itself consent-gated and bots don't accept cookies.

drop view if exists analytics.funnel_daily;

create view analytics.funnel_daily as
  select day,
    sum((kind = 'page_view')::int) as page_views,
    sum((kind = 'asked')::int)     as asked,
    sum((kind = 'signup')::int)    as signed_up,
    sum((kind = 'upgrade')::int)   as upgraded,
    sum((kind = 'downgrade')::int) as downgraded
  from (
    select date_trunc('day', e.created_at)::date as day, 'page_view'::text as kind
      from public.events e
     where e.event_type = 'page_view'
    union all
    select date_trunc('day', q.ts)::date as day, 'asked'::text as kind
      from public.questions q
     where q.source = 'user'
    union all
    select date_trunc('day', pe.ts)::date as day, pe.event_type
      from public.profile_events pe
     where pe.event_type in ('signup', 'upgrade', 'downgrade')
  ) x
  group by day
  order by day desc;
