-- P6b · profile_events emit on tier change (task #33).
--
-- profile_events is the append-only account-lifecycle log; Phase 1 seeded a
-- 'snapshot' per existing profile. This makes it GROW: a trigger on profiles
-- logs a 'signup' when a profile row is created and an 'upgrade'/'downgrade'
-- whenever its tier changes — from ANY path (the /api/upgrade route, the Stripe
-- webhook, a manual admin update, or anything built later). A DB trigger beats
-- emitting from each app site: one bulletproof choke point that can't be
-- bypassed, with from_tier/to_tier captured automatically. SECURITY DEFINER so
-- it can write the RLS-protected log regardless of the invoking role.
--
-- Coarse by design (V1): a cancel that drops premium->free logs as 'downgrade',
-- a resume as 'upgrade', and `cycle` (monthly/annual — lives on subscriptions,
-- not profiles) isn't captured here; the webhook can enrich those later. The tier
-- TIMELINE (who was at what tier, when) is fully captured. 'delete' is
-- intentionally NOT logged: profile_events.user_id CASCADEs on auth.users delete,
-- so a delete event would erase itself.

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
    insert into public.profile_events (user_id, event_type, to_tier, properties)
      values (new.id, 'signup', new.tier, jsonb_build_object('via', 'trigger'));
  elsif (tg_op = 'UPDATE' and new.tier is distinct from old.tier) then
    rank_old := case old.tier when 'premium' then 2 when 'pro' then 1 else 0 end;
    rank_new := case new.tier when 'premium' then 2 when 'pro' then 1 else 0 end;
    insert into public.profile_events (user_id, event_type, from_tier, to_tier, properties)
      values (
        new.id,
        case when rank_new > rank_old then 'upgrade' else 'downgrade' end,
        old.tier, new.tier,
        jsonb_build_object('via', 'trigger')
      );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profile_tier_event on public.profiles;
create trigger trg_profile_tier_event
  after insert or update on public.profiles
  for each row execute function public.log_profile_tier_event();
