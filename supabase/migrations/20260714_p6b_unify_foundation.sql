-- P6 step-0 (Model B — one source of truth) · Phase 1: additive foundation.
--
-- Non-destructive. Adds the columns/table the unified model needs so the app
-- can eventually render threads from questions + model_runs alone (retiring the
-- messages table) and so we have an append-only account-lifecycle log. Nothing
-- READS these yet — messages/conversations keep working unchanged — so this is
-- safe to apply on the live DB. Applied to project kmkuajbtygqwbipcgxxa.

-- 1. model_runs.answer — the per-model answer TEXT. In the unified model,
--    model_runs is what the app renders a turn's answers from. Populated for
--    SIGNED-IN conversation turns ONLY (anonymous answers stay unpersisted —
--    the V1 privacy contract); null everywhere else.
alter table public.model_runs
  add column if not exists answer text;

-- 2. questions.result — the compare-turn aggregation blob (summary +
--    contributions + section_attributions), moved off messages/conversations so
--    a comparison turn renders from questions + model_runs alone.
alter table public.questions
  add column if not exists result jsonb;

-- 3. profile_events — append-only account-lifecycle log. The current tier stays
--    on the live `profiles` table (enforcement reads it on the hot path); this
--    table is the HISTORY (signup / up- / downgrade / cancel / delete), keyed on
--    user_id + anon_id so a pre-signup journey can be stitched to the account.
create table if not exists public.profile_events (
  id          uuid primary key default gen_random_uuid(),
  ts          timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete cascade,
  anon_id     text,
  event_type  text not null,   -- snapshot | signup | upgrade | downgrade | cancel | resume | delete
  from_tier   text,
  to_tier     text,
  cycle       text,            -- monthly | annual (billing context)
  properties  jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists profile_events_user_ts on public.profile_events (user_id, created_at desc);
create index if not exists profile_events_anon    on public.profile_events (anon_id);
create index if not exists profile_events_type    on public.profile_events (event_type, created_at desc);

-- Owner can read their own history; all WRITES are service-role (bypass RLS),
-- keeping the log append-only from the client's perspective.
alter table public.profile_events enable row level security;
drop policy if exists profile_events_owner on public.profile_events;
create policy profile_events_owner on public.profile_events
  for select using (auth.uid() = user_id);

-- 4. Seed a baseline `snapshot` event per existing user so the log has a
--    starting point (idempotent — safe to re-run).
insert into public.profile_events (user_id, event_type, to_tier, created_at, properties)
  select p.id, 'snapshot', p.tier, p.created_at, jsonb_build_object('seeded', true)
  from public.profiles p
  where not exists (
    select 1 from public.profile_events pe
    where pe.user_id = p.id and pe.event_type = 'snapshot'
  );
