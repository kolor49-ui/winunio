ALTER TABLE arguments
  ADD COLUMN IF NOT EXISTS reasoning TEXT,
  ADD COLUMN IF NOT EXISTS quote TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT;

UPDATE arguments
SET reasoning = content
WHERE reasoning IS NULL;

ALTER TABLE closing_statements
  ADD COLUMN IF NOT EXISTS reasoning TEXT,
  ADD COLUMN IF NOT EXISTS quote TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT;

UPDATE closing_statements
SET reasoning = content
WHERE reasoning IS NULL;

CREATE TABLE content_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  context_type TEXT NOT NULL,
  context_id TEXT NOT NULL,
  reasoning TEXT NOT NULL DEFAULT '',
  quote TEXT,
  source TEXT,
  version INT NOT NULL DEFAULT 1,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT content_drafts_user_context_unique UNIQUE (user_id, context_type, context_id)
);

CREATE INDEX idx_content_drafts_user_saved ON content_drafts (user_id, saved_at DESC);
