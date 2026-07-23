CREATE TYPE content_review_context AS ENUM (
  'argument',
  'closing_statement',
  'initiator_stance',
  'application_stance'
);

CREATE TYPE content_review_status AS ENUM (
  'approved',
  'revision_required',
  'blocked',
  'failed'
);

CREATE TABLE content_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  context_type content_review_context NOT NULL,
  context_id UUID,
  input_text TEXT NOT NULL,
  status content_review_status NOT NULL,
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider TEXT NOT NULL DEFAULT 'openai',
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_reviews_user_created
  ON content_reviews (user_id, created_at DESC);

CREATE INDEX idx_content_reviews_context
  ON content_reviews (context_type, context_id);
