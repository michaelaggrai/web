-- AGG-44 attribution: carry the first-touch acquisition ref (the aggrai_ref
-- cookie set by /share, e.g. 'share:<shareId>') from signup metadata onto the
-- profile, and echo it into profile_events so BOTH the signup and the later
-- upgrade/downgrade rows carry the acquisition source. This gives a direct
-- share -> signup -> paid chain instead of inferring it by matching anon_id.
--
-- Applied 2026-07-19 (Supabase migration: share_acquisition_ref_on_signup).
alter table public.profiles add column if not exists ref text;

comment on column public.profiles.ref is
  'First-touch acquisition ref from the aggrai_ref cookie (e.g. share:<shareId>). Consent-gated: null when analytics consent is absent.';

-- handle_new_user: also validate + persist the ref. Keeps the empty search_path
-- hardening, so every object stays fully qualified.
create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_anon text;
  v_ref  text;
begin
  begin
    v_anon := nullif(new.raw_user_meta_data->>'anon_id', '');
    if v_anon is not null and v_anon !~ '^[A-Za-z0-9_-]{1,64}$' then
      v_anon := null;
    end if;
  exception when others then
    v_anon := null;
  end;

  begin
    v_ref := nullif(new.raw_user_meta_data->>'ref', '');
    -- e.g. 'share:bqOiu4onj18'. Tight, bounded charset; anything else is dropped.
    if v_ref is not null and v_ref !~ '^[A-Za-z0-9_:.-]{1,80}$' then
      v_ref := null;
    end if;
  exception when others then
    v_ref := null;
  end;

  insert into public.profiles (id, email, anon_id, ref)
    values (new.id, new.email, v_anon, v_ref);
  return new;
end;
$function$;

-- log_profile_tier_event: include the acquisition ref on signup AND on every
-- tier change, so "which share produced this paying customer" is one query.
-- jsonb_strip_nulls keeps properties as {"via":"trigger"} when there's no ref.
create or replace function public.log_profile_tier_event()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  rank_old int;
  rank_new int;
begin
  if (tg_op = 'INSERT') then
    insert into public.profile_events (user_id, anon_id, event_type, to_tier, properties)
      values (new.id, new.anon_id, 'signup', new.tier,
              jsonb_strip_nulls(jsonb_build_object('via', 'trigger', 'ref', new.ref)));
  elsif (tg_op = 'UPDATE' and new.tier is distinct from old.tier) then
    rank_old := case old.tier when 'premium' then 2 when 'pro' then 1 else 0 end;
    rank_new := case new.tier when 'premium' then 2 when 'pro' then 1 else 0 end;
    insert into public.profile_events (user_id, anon_id, event_type, from_tier, to_tier, properties)
      values (
        new.id, new.anon_id,
        case when rank_new > rank_old then 'upgrade' else 'downgrade' end,
        old.tier, new.tier,
        jsonb_strip_nulls(jsonb_build_object('via', 'trigger', 'ref', new.ref))
      );
  end if;
  return new;
end;
$function$;
