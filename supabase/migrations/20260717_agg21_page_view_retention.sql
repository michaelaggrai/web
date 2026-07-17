-- AGG-21/AGG-30: page_view retention — ANONYMISE, don't delete.
--
-- A page_view row carrying anon_id / session_id / device is personal data for
-- consenting visitors, so it can't be kept indefinitely. But an UN-identified
-- page_view is not personal data — and deleting the row would destroy the
-- long-term traffic trend (funnel_daily could never look back beyond 90 days,
-- which is exactly the history you want as the product grows).
--
-- So strip the identifiers in place and keep the row. Counts survive forever;
-- the personal data doesn't. This mirrors the questions.ip purge (purge-old-ip)
-- — same 90-day window, same "null the PII, keep the record" shape.
--
-- If raw page_view volume ever dwarfs everything else, add a daily rollup table
-- and start deleting the raw rows behind it. Not needed at present volume.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'anonymise-old-page-views') then
    perform cron.unschedule('anonymise-old-page-views');
  end if;
end
$$;

-- Daily 03:25 UTC — just after purge-old-ip (03:20), before the GitHub-Actions
-- crons (extract-memory 03:30, tag-topics 03:45).
select cron.schedule(
  'anonymise-old-page-views',
  '25 3 * * *',
  $job$
    update public.events
       set anon_id = null, session_id = null, device = null
     where event_type = 'page_view'
       and created_at < now() - interval '90 days'
       and (anon_id is not null or session_id is not null or device is not null)
  $job$
);
