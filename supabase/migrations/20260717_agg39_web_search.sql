-- AGG-39 Option D web search (applied to kmkuajbtygqwbipcgxxa 2026-07-17).
-- Two facts, two homes (mirrors how classifier/summariser are modelled):
--   questions.web_search  — per-question boolean: was this ask grounded? The
--     dimension analytics cuts by. TRUE even if the search FAILED (we tried;
--     the answer is ungrounded but should have been).
--   model_runs role='search' — the search CALL's cost/latency, so a question's
--     full cost = sum(model_runs.cost_usd) stays whole once search adds spend.
alter table public.questions add column if not exists web_search boolean not null default false;

comment on column public.questions.web_search is
  'AGG-39: was this ask grounded by a live web search (Option D shared search)? True even if the search failed — the intent, not just the successful call.';

-- Widen the role CHECK to admit the search cost row.
alter table public.model_runs drop constraint if exists model_runs_role_chk;
alter table public.model_runs add constraint model_runs_role_chk
  check (role = any (array['answer'::text, 'summariser'::text, 'classifier'::text, 'search'::text]));
