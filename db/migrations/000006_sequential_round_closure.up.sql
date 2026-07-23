ALTER TYPE debate_status ADD VALUE IF NOT EXISTS 'awaiting_closure';

ALTER TYPE debate_reward_status ADD VALUE IF NOT EXISTS 'pending';

ALTER TABLE debates
  ADD COLUMN IF NOT EXISTS closure_started_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS closing_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates (id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES debate_participants (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  CONSTRAINT closing_statements_debate_participant_unique UNIQUE (debate_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_closing_statements_debate_id
  ON closing_statements (debate_id);

CREATE TABLE IF NOT EXISTS round_response_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds (id) ON DELETE CASCADE,
  user_id UUID REFERENCES users (id) ON DELETE CASCADE,
  email TEXT,
  notify_on TEXT NOT NULL DEFAULT 'b_response',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT round_response_notifications_user_unique UNIQUE (round_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_round_response_notifications_round_id
  ON round_response_notifications (round_id);
