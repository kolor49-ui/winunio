CREATE TYPE email_token_purpose AS ENUM ('verify_email', 'reset_password');

CREATE TABLE email_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  purpose email_token_purpose NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_auth_tokens_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX idx_email_auth_tokens_user_purpose ON email_auth_tokens (user_id, purpose);
CREATE INDEX idx_email_auth_tokens_expires ON email_auth_tokens (expires_at)
  WHERE consumed_at IS NULL;
