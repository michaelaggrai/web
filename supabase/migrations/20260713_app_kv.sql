-- app_kv: durable backing store for backend app-state that used to live in local
-- files on the Mac mini — the warm example-cache and the prompt-pool. Makes the
-- backend STATELESS for the Fly.io migration (aggrai V2, Phase 2a): the server
-- loads these into memory on boot and writes through here, so any machine (or a
-- fresh container on every deploy) comes up warm with no local disk.
-- Service-role only — no user access. Applied to project kmkuajbtygqwbipcgxxa.

CREATE TABLE IF NOT EXISTS app_kv (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_kv ENABLE ROW LEVEL SECURITY;
-- No policies → only the service-role key (the backend) can read/write. Keys:
-- 'example_cache' ({answers,responses}), 'prompt_pool' + 'prompt_pool_staging'
-- ({prompts,generated_at,source}).

COMMENT ON TABLE app_kv IS 'Backend app-state KV (example_cache, prompt_pool, prompt_pool_staging). Stateless-backend backing store (aggrai V2 Phase 2). Service-role only.';
