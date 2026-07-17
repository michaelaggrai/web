-- AGG-21: stop funnel_daily counting test accounts as signups/customers.
--
-- The view mixed units: `asked` filters questions.source='user' (classifySource
-- already excluded internal traffic at write time), but signed_up/upgraded read
-- profile_events with NO filter — so test1@test.com signing up and upgrading
-- showed as "2 signups, 1 conversion". A number that invites a false belief is
-- worse than no number.
--
-- profile_events has no email, so we join profiles and apply the same internal
-- rule the backend uses.
--
-- MIRROR CONTRACT — api/server.js classifySource() (~783):
--     no '@' in the email                    → internal (seeded/admin login)
--     email ∈ INTERNAL_EMAILS (env var)      → internal   ← NOT mirrorable here
--     domain ∈ {test.com, example.com}       → internal
--     otherwise                              → user
-- INTERNAL_EMAILS is an env var, so SQL can't see it: if you ever flag a
-- real-looking address there, the funnel will still count it. The domain rule
-- covers the test.com/example.com accounts, which is the actual case today.
-- Keep this in sync with server.js (see the aggrai-mirror-check skill).

create or replace function analytics.is_internal_email(p_email text)
returns boolean
language sql
immutable
as $$
  select case
    when p_email is null or p_email = '' then false                              -- anonymous → 'user'
    when position('@' in p_email) = 0 then true                                  -- seeded/admin login
    when lower(split_part(p_email, '@', 2)) in ('test.com', 'example.com') then true
    else false
  end
$$;

comment on function analytics.is_internal_email(text) is
  'Mirrors classifySource() in api/server.js: is this account internal/test traffic? Cannot see the INTERNAL_EMAILS env var — domains + no-@ only.';

drop view if exists analytics.funnel_daily;

create view analytics.funnel_daily as
  select day,
    sum((kind = 'page_view')::int) as page_views,
    sum((kind = 'asked')::int)     as asked,
    sum((kind = 'signup')::int)    as signed_up,
    sum((kind = 'upgrade')::int)   as upgraded,
    sum((kind = 'downgrade')::int) as downgraded
  from (
    -- Page views can't be attributed to an account pre-signup, so they're not
    -- filterable by email. Bots are filtered by the collector being client-side.
    select date_trunc('day', e.created_at)::date as day, 'page_view'::text as kind
      from public.events e
     where e.event_type = 'page_view'
    union all
    select date_trunc('day', q.ts)::date as day, 'asked'::text as kind
      from public.questions q
     where q.source = 'user'
    union all
    -- LEFT JOIN + null-email-is-external matches classifySource (no email → 'user')
    -- and survives any orphaned lifecycle row.
    select date_trunc('day', pe.ts)::date as day, pe.event_type
      from public.profile_events pe
      left join public.profiles pr on pr.id = pe.user_id
     where pe.event_type in ('signup', 'upgrade', 'downgrade')
       and not analytics.is_internal_email(pr.email)
  ) x
  group by day
  order by day desc;
