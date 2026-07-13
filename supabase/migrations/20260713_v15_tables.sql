-- V1.5 raw operational tables (aggrai V2, Phase 1).
-- Moves the per-ask data that today lives in local JSONL logs on the Mac mini
-- (logs/user-tracking.jsonl, logs/usage.jsonl) into Postgres. Foundation for:
--   • internal analytics (AGG-21)  • GDPR export/delete (AGG-30)
--   • Conversation & Memory (AGG-29, FKs to questions.id)
--   • user analytics (AGG-27, uses questions.topics)
--
-- WRITES come from the backend service-role client (server.js `supabaseAdmin`,
-- SUPABASE_SECRET_KEY) which BYPASSES RLS. The owner-SELECT policies below exist
-- only so the signed-in browser client can read its OWN rows in the Phase-6
-- analytics dashboard. Anonymous rows (user_id null) are service-role-only.
-- Additive + idempotent (safe to re-run). Applied to project kmkuajbtygqwbipcgxxa.

-- One row per /ask (multi-model compare AND single-answer). Maps recordTracking.
CREATE TABLE IF NOT EXISTS questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- AGG-29 conversations/messages FK to this
  ts          TIMESTAMPTZ NOT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- null = anonymous
  email       TEXT,                                          -- snapshot of user.email at ask time (null anon)
  anon_id     TEXT,
  session_id  TEXT,
  country     TEXT,
  ip          TEXT,
  device      TEXT,
  tier        TEXT,
  question    TEXT,
  type        TEXT,                                          -- 'compare' | single-answer variants
  source      TEXT,                                          -- 'user' | 'synthetic' | 'warm' | 'internal'
  example     BOOLEAN,
  from_cache  BOOLEAN,
  models      JSONB,                                         -- active model ids
  summariser  JSONB,                                         -- {model,runtime_ms,tokens,cost_usd} | null
  topics      TEXT[],                                        -- forward-compat for AGG-27 (null until Phase 6)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_questions_user_ts ON questions (user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_questions_ts      ON questions (ts DESC);
CREATE INDEX IF NOT EXISTS idx_questions_source  ON questions (source);

-- One row per model per ask. Maps recordTracking.runs[].
CREATE TABLE IF NOT EXISTS model_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id       UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  model             TEXT NOT NULL,
  from_cache        BOOLEAN,
  runtime_ms        INTEGER,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  total_tokens      INTEGER,
  cost_usd          NUMERIC(16,10),
  truncated         BOOLEAN,
  scores            JSONB,                                   -- {overall,accuracy,completeness,calibration,clarity,insight,sub} | null
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_model_runs_question ON model_runs (question_id);
CREATE INDEX IF NOT EXISTS idx_model_runs_model    ON model_runs (model);

-- Complete cost ledger — one row per model call (answer|summary|classifier|
-- product|direct). Faithful 1:1 map of usage.jsonl; finance source of truth.
CREATE TABLE IF NOT EXISTS usage_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts                TIMESTAMPTZ NOT NULL,
  question          TEXT,
  model             TEXT,
  role              TEXT,                                    -- answer|summary|classifier|product|direct
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  total_tokens      INTEGER,
  cost_usd          NUMERIC(16,10),
  runtime_ms        INTEGER,
  ttft_ms           INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usage_events_ts    ON usage_events (ts DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_model ON usage_events (model);
CREATE INDEX IF NOT EXISTS idx_usage_events_role  ON usage_events (role);

-- Funnel + product events (AGG-21). Backend emits asked/cache_hit/cache_miss/
-- classifier_verdict; frontend + Stripe webhook will emit landed/signed_up/
-- upgraded/downgraded (wired incrementally on the Vercel side).
CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anon_id     TEXT,
  event_type  TEXT NOT NULL,
  properties  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_type_created ON events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_user         ON events (user_id);

-- RLS: enable on all; owner-SELECT for signed-in browser reads (Phase 6). All
-- writes are service-role (bypass RLS). usage_events has no user_id → no owner
-- policy, so it is service-role-only (internal finance ledger).
ALTER TABLE questions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_runs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS questions_select_own ON questions;
CREATE POLICY questions_select_own ON questions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS model_runs_select_own ON model_runs;
CREATE POLICY model_runs_select_own ON model_runs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM questions q WHERE q.id = model_runs.question_id AND q.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS events_select_own ON events;
CREATE POLICY events_select_own ON events
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE questions    IS 'V1.5 raw: one row per /ask. PII (question, email, ip). ON DELETE CASCADE via user_id. Dual-written from server.js recordTracking; JSONL kept as fallback through Phase 2.';
COMMENT ON TABLE model_runs   IS 'V1.5 raw: one row per model per ask (scores as jsonb). Maps recordTracking.runs[].';
COMMENT ON TABLE usage_events IS 'V1.5 raw: complete cost ledger, 1:1 with usage.jsonl. Internal only.';
COMMENT ON TABLE events       IS 'AGG-21 funnel/product events. Backend + frontend + Stripe-webhook emitters.';
