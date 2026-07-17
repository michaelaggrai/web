-- AGG-21/AGG-27: make `events` the raw client-signal log (page views).
--
-- The table already had the right bones (user_id, anon_id, event_type, properties
-- jsonb, created_at + an (event_type, created_at DESC) index) — it was built for a
-- write side that never arrived. Two columns finish it:
--
--   session_id — a JOIN KEY. Page views are sessionised into "visits" by grouping
--                on this, which is what a funnel actually counts. Keys you GROUP BY
--                get columns; payload (path/referrer/utm_*) stays in properties.
--   device     — mirrors questions.device {type,os,browser,ua} so the same
--                expression (device->>'type') works across both tables and a
--                landed→asked cut by device is a plain join.
--
-- Both are CONSENT-GATED at the collector (opt-in, mirroring the AGG-30 posture):
-- populated only when aggrai_consent_v1 = 'accepted', null otherwise. Page-view
-- COUNTS stay complete for 100% of traffic (an un-identified row isn't personal
-- data); only the dimensional cuts are consent-limited.

alter table public.events add column if not exists session_id text;
alter table public.events add column if not exists device jsonb;

create index if not exists idx_events_session on public.events (session_id);

comment on column public.events.session_id is
  'Per-tab session id (consent-gated, null without accept). Join key for sessionising page views into visits.';
comment on column public.events.device is
  'Coarse device bucket {type,os,browser,ua} — mirrors questions.device. Consent-gated (opt-in), null without accept.';
