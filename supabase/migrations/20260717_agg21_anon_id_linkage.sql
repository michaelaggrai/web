-- AGG-21: stitch the funnel — carry the browser's anon_id through signup.
--
-- profile_events.anon_id has existed AND been indexed (profile_events_anon) since
-- the P6b foundation, but nothing ever populated it. That's the difference
-- between an aggregate funnel (100 landed, 20 asked, 3 signed up) and a cohort
-- funnel (of the visitors who landed, THESE asked and THESE converted).
--
-- profiles rows aren't written by app code — the on_auth_user_created trigger on
-- auth.users creates them, and a DB trigger can't see the browser. So the anon_id
-- has to ride in on the signup call's user metadata:
--
--   browser (getAnonId)
--     → supabase.auth.signUp({ options: { data: { anon_id } } })
--       → auth.users.raw_user_meta_data
--         → handle_new_user()        → profiles.anon_id
--           → log_profile_tier_event() → profile_events.anon_id
--
-- Then the whole journey joins: events.anon_id → questions.anon_id → profile_events.anon_id
--
-- The value is CLIENT-SUPPLIED, so it is charset-validated before being stored
-- (garbage would simply never match, but don't persist junk). It is null without
-- analytics consent (getAnonId() returns null), so the cohort funnel covers
-- consenting visitors — same limit as every other dimension.
--
-- SAFETY: handle_new_user is the account-creation path. The anon_id is a
-- nice-to-have analytics field and must NEVER be able to break a signup, so its
-- extraction sits in its own exception-guarded block. Both functions keep their
-- exact original attributes: SECURITY DEFINER, and search_path '' / 'public'
-- respectively — changing those would break signup or the tier log.

alter table public.profiles add column if not exists anon_id text;
create index if not exists profiles_anon on public.profiles (anon_id);

comment on column public.profiles.anon_id is
  'The browser anon_id that created this account (consent-gated; null without accept). Set from signUp metadata by handle_new_user(); copied onto profile_events for funnel attribution.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anon text;
begin
  -- Client-supplied via signUp metadata. Guarded so a malformed/absent value can
  -- never abort account creation.
  begin
    v_anon := nullif(new.raw_user_meta_data->>'anon_id', '');
    if v_anon is not null and v_anon !~ '^[A-Za-z0-9_-]{1,64}$' then
      v_anon := null;
    end if;
  exception when others then
    v_anon := null;
  end;

  insert into public.profiles (id, email, anon_id) values (new.id, new.email, v_anon);
  return new;
end;
$$;

create or replace function public.log_profile_tier_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rank_old int;
  rank_new int;
begin
  if (tg_op = 'INSERT') then
    insert into public.profile_events (user_id, anon_id, event_type, to_tier, properties)
      values (new.id, new.anon_id, 'signup', new.tier, jsonb_build_object('via', 'trigger'));
  elsif (tg_op = 'UPDATE' and new.tier is distinct from old.tier) then
    rank_old := case old.tier when 'premium' then 2 when 'pro' then 1 else 0 end;
    rank_new := case new.tier when 'premium' then 2 when 'pro' then 1 else 0 end;
    insert into public.profile_events (user_id, anon_id, event_type, from_tier, to_tier, properties)
      values (
        new.id, new.anon_id,
        case when rank_new > rank_old then 'upgrade' else 'downgrade' end,
        old.tier, new.tier,
        jsonb_build_object('via', 'trigger')
      );
  end if;
  return new;
end;
$$;
