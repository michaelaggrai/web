-- AGG-30 (GDPR): raw-IP retention.
--
-- questions.ip is the raw visitor IP — PII. As of AGG-30 it is stored OPT-IN
-- (only when the visitor Accepted analytics; see server.js consent enforcement).
-- This caps its lifetime: a daily pg_cron job NULLs the ip column on rows older
-- than 90 days, leaving the anonymised row (question, cost, model, coarse country)
-- intact for analytics. Honours the /privacy commitment that operational logs /
-- IP addresses are retained for up to 90 days.
--
-- Applies to ALL rows (signed-in + anonymous): the IP is operational data, not
-- account/contract data, so it ages out regardless of user_id. Anchored on `ts`
-- (the ask timestamp).

create extension if not exists pg_cron;

-- Idempotent (re)schedule: drop any prior definition of this job first so the
-- migration can be re-applied cleanly.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-old-ip') then
    perform cron.unschedule('purge-old-ip');
  end if;
end
$$;

-- Daily at 03:20 UTC — off-peak, and spaced from the 03:30 memory-extraction cron.
select cron.schedule(
  'purge-old-ip',
  '20 3 * * *',
  $job$
    update public.questions
       set ip = null
     where ip is not null
       and ts < now() - interval '90 days'
  $job$
);
