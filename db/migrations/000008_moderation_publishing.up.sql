-- Moderation & publishing workflow (CONTENT_EDITOR, MODERATION)

ALTER TYPE content_review_status ADD VALUE IF NOT EXISTS 'advisory_language';
ALTER TYPE content_review_status ADD VALUE IF NOT EXISTS 'under_review';

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE debates ADD COLUMN IF NOT EXISTS status_before_review debate_status;

ALTER TABLE content_reviews
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS policy_version TEXT NOT NULL DEFAULT '1.0';

CREATE TYPE moderation_case_status AS ENUM (
  'open',
  'approved',
  'revision_required',
  'rejected',
  'resolved'
);

CREATE TYPE moderation_case_source AS ENUM (
  'ai_review',
  'user_report',
  'admin'
);

CREATE TABLE moderation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source moderation_case_source NOT NULL,
  status moderation_case_status NOT NULL DEFAULT 'open',
  requester_id UUID NOT NULL REFERENCES users (id),
  content_review_id UUID REFERENCES content_reviews (id) ON DELETE SET NULL,
  debate_id UUID REFERENCES debates (id) ON DELETE SET NULL,
  round_id UUID REFERENCES rounds (id) ON DELETE SET NULL,
  argument_id UUID REFERENCES arguments (id) ON DELETE SET NULL,
  reported_text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  policy_version TEXT NOT NULL DEFAULT '1.0',
  ai_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users (id) ON DELETE SET NULL,
  resolution_note TEXT
);

CREATE INDEX idx_moderation_cases_status_created
  ON moderation_cases (status, created_at DESC);

CREATE INDEX idx_moderation_cases_requester
  ON moderation_cases (requester_id, created_at DESC);

ALTER TABLE content_reviews
  ADD COLUMN IF NOT EXISTS moderation_case_id UUID REFERENCES moderation_cases (id) ON DELETE SET NULL;

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS argument_id UUID REFERENCES arguments (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS moderation_case_id UUID REFERENCES moderation_cases (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reporter_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS author_notified_at TIMESTAMPTZ;

CREATE INDEX idx_reports_moderation_case ON reports (moderation_case_id);

ALTER TYPE moderation_action_type ADD VALUE IF NOT EXISTS 'approve_content';
ALTER TYPE moderation_action_type ADD VALUE IF NOT EXISTS 'reject_content';
ALTER TYPE moderation_action_type ADD VALUE IF NOT EXISTS 'return_for_revision';

ALTER TABLE moderation_actions
  ADD COLUMN IF NOT EXISTS content_review_id UUID REFERENCES content_reviews (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderation_case_id UUID REFERENCES moderation_cases (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS policy_version TEXT;
