-- GDPR (Phase 4b): record the analytics-consent state on each activity row.
--
-- Lets us (a) tell WHY a row is anonymised — the user opted out, not a bug —
-- and (b) measure the accept/reject rate straight from data we already write
-- (select analytics_consent, count(*) from questions group by 1), WITHOUT any
-- new persistent identifier or a separate consent table.
--
-- Nullable: NULL = no choice recorded (pre-consent, or the header wasn't
-- forwarded). Non-null is constrained to the two real choices. NULLs pass the
-- CHECK (null IN (...) is unknown, which a CHECK treats as satisfied).
alter table public.questions
  add column if not exists analytics_consent text
  check (analytics_consent in ('accepted', 'rejected'));
