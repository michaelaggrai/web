-- P6b · enforce the model_runs grain: one row per (question_id, model, role).
--
-- After the role unification (answer/summariser/classifier rows) + the summariser
-- backfill, (question_id, model, role) is the natural key — verified 0 dups across
-- all rows. This makes it a real DB guarantee: analytics + the frontend readers can
-- rely on it, and it lets the live write use ON CONFLICT DO NOTHING so a duplicate
-- (e.g. a /converse retry with the same pre-generated qid) is a clean no-op instead
-- of failing the whole model_runs insert batch. Applied to kmkuajbtygqwbipcgxxa.

alter table public.model_runs
  add constraint model_runs_qid_model_role_key unique (question_id, model, role);
