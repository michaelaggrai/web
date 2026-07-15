-- P6b role unification · additive migration (Phase 2 cont.).
--
-- Makes model_runs ONE row per LLM call of ANY role — answer | summariser |
-- classifier — so a question's full cost = sum(model_runs.cost_usd) where
-- question_id = X, one join, everything keyed on question_id. The summariser
-- (currently in questions.summariser jsonb) and classifier (currently in
-- usage_events, keyed by question TEXT) stop hiding and become their own rows.
--
-- Additive + safe on the live DB: every existing model_runs row IS an answer
-- call, so the 'answer' default is correct for all 7,021 of them. Nothing reads
-- `role` yet. The unique(question_id, model, role) constraint is deferred to
-- Phase 3 — added after the historical summariser backfill so it can't trip on
-- in-flight data. Applied to project kmkuajbtygqwbipcgxxa.

-- 1. role — which kind of LLM call this row records. Default 'answer' backfills
--    every existing row correctly (they're all answer calls today).
alter table public.model_runs
  add column if not exists role text not null default 'answer';

-- 2. ttft_ms — time-to-first-token. Lives on usage_events but not model_runs;
--    add it here so folding usage_events into model_runs (Phase 6 drop) loses
--    no latency signal. Null for rows/roles where TTFT isn't measured.
alter table public.model_runs
  add column if not exists ttft_ms integer;

-- 3. Constrain role to the known set. Single-answer paths (direct/product,
--    /converse single) also record as 'answer'. Re-runnable.
alter table public.model_runs drop constraint if exists model_runs_role_chk;
alter table public.model_runs
  add constraint model_runs_role_chk check (role in ('answer', 'summariser', 'classifier'));
