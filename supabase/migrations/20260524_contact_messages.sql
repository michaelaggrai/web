-- Contact form submissions from /contact page.
-- Inserted via service-role from /api/contact. Users never read this table
-- directly, so RLS is enabled but only the service role can do anything.

CREATE TABLE IF NOT EXISTS contact_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  topic       TEXT NOT NULL CHECK (topic IN ('general', 'bug', 'feature', 'partnership', 'press')),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  message     TEXT NOT NULL,
  user_agent  TEXT,
  country     TEXT,   -- 2-letter ISO from Cloudflare / Vercel header. No raw IP.
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'replied', 'spam', 'closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  replied_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created  ON contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status   ON contact_messages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_user     ON contact_messages (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- No client-side policies. Service role bypasses RLS so the API inserts
-- work; nobody else can read or write.

COMMENT ON TABLE contact_messages IS 'Submissions from /contact form. PII (name, email, message) — purge on user account deletion via the ON DELETE SET NULL cascade and a periodic anonymisation job (TBD).';
