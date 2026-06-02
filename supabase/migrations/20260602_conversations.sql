-- Persistent comparison history for signed-in users (cross-device).
-- One row per saved comparison (the /app/c/{id} short id is the PK). The full
-- rendered result (summary + per-model answers + scores) is stored as JSONB so
-- this does NOT depend on the normalized raw-tables refactor. Multi-turn
-- conversations are V2 — this is history persistence only.
-- Applied to project kmkuajbtygqwbipcgxxa on 2026-06-02.

CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY,                          -- app-generated short id; matches /app/c/{id}
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '',
  question    TEXT NOT NULL DEFAULT '',
  models      JSONB NOT NULL DEFAULT '[]'::jsonb,        -- array of model ids
  result      JSONB,                                     -- full rendered result blob (null until complete)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations (user_id, updated_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Owner-only. Writes come from the signed-in browser client (anon key + the
-- user's session), so explicit client policies are required.
CREATE POLICY "conversations_select_own" ON conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "conversations_insert_own" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "conversations_update_own" ON conversations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "conversations_delete_own" ON conversations FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE conversations IS 'Persistent comparison history for signed-in users (cross-device). PII (question + answers). GDPR export/delete deferred to V2; ON DELETE CASCADE purges on account deletion.';
