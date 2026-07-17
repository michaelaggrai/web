-- P7 (AGG-48): serverless-safe rate limiting for the public Vercel routes
-- (/api/login, /api/events, /api/contact). Applied to kmkuajbtygqwbipcgxxa
-- 2026-07-17. In-memory limits don't survive across serverless invocations, so
-- the shared state lives in Postgres; the RPC is an atomic check-and-increment
-- (fixed window). Called only via the service role (RLS on, no policies →
-- deny-all), from lib/rate-limit.ts.
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0
);
alter table public.rate_limits enable row level security;

comment on table public.rate_limits is
  'AGG-48: per-key fixed-window rate-limit counters for the public API routes. Service-role only; churned hourly by the rate-limits-cleanup pg_cron job.';

-- Atomic: bump the key's counter (resetting if its window expired), return TRUE
-- when the request is under the limit (allow), FALSE to block.
create or replace function public.check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
as $$
declare v_count int;
begin
  insert into public.rate_limits as r (key, window_start, count)
    values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                 then 1 else r.count + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                 then now() else r.window_start end
  returning r.count into v_count;
  return v_count <= p_max;
end;
$$;

-- Keep the table small: drop windows older than a day (pg_cron, already used for
-- the IP-retention purge). Re-runnable.
do $$ begin perform cron.unschedule('rate-limits-cleanup'); exception when others then null; end $$;
select cron.schedule('rate-limits-cleanup', '17 * * * *',
  $$delete from public.rate_limits where window_start < now() - interval '1 day'$$);
