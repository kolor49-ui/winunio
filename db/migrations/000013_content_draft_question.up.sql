ALTER TABLE content_drafts
  ADD COLUMN IF NOT EXISTS question TEXT;
