-- Winunio initial schema (docs/DATA_MODEL.md)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted');

CREATE TYPE debate_status AS ENUM (
  'draft',
  'waiting_for_partner',
  'invitation_pending',
  'active',
  'waiting_for_continuation',
  'completed',
  'cancelled',
  'under_review'
);

CREATE TYPE debate_application_status AS ENUM (
  'pending',
  'invited',
  'accepted',
  'rejected',
  'expired',
  'withdrawn',
  'closed'
);

CREATE TYPE participant_role AS ENUM ('initiator', 'partner');

CREATE TYPE participant_side AS ENUM ('A', 'B');

CREATE TYPE round_status AS ENUM (
  'open',
  'published',
  'closed_without_content'
);

CREATE TYPE continuation_challenge_status AS ENUM (
  'issued',
  'consumed',
  'invalidated',
  'expired'
);

CREATE TYPE debate_reward_status AS ENUM ('simulated');

CREATE TYPE report_reason AS ENUM (
  'illegal',
  'threat',
  'pii',
  'harassment',
  'spam',
  'abuse'
);

CREATE TYPE report_status AS ENUM ('open', 'reviewed', 'dismissed');

CREATE TYPE moderation_target_type AS ENUM ('debate', 'user', 'argument');

CREATE TYPE moderation_action_type AS ENUM (
  'under_review',
  'remove_content',
  'suspend_user',
  'complete_debate'
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  phone_verified_at TIMESTAMPTZ,
  status user_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE TABLE public_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  display_name TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  avatar_url TEXT,
  CONSTRAINT public_profiles_user_id_unique UNIQUE (user_id)
);

-- Debates
CREATE TABLE debates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id UUID NOT NULL REFERENCES users (id),
  question VARCHAR(160) NOT NULL,
  initiator_stance TEXT NOT NULL,
  category TEXT NOT NULL,
  status debate_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE INDEX idx_debates_status ON debates (status);
CREATE INDEX idx_debates_initiator_id ON debates (initiator_id);

CREATE TABLE debate_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id),
  stance TEXT NOT NULL,
  status debate_application_status NOT NULL DEFAULT 'pending',
  invited_at TIMESTAMPTZ,
  invitation_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT debate_applications_debate_user_unique UNIQUE (debate_id, user_id)
);

CREATE INDEX idx_debate_applications_debate_status ON debate_applications (debate_id, status);

CREATE TABLE debate_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id),
  role participant_role NOT NULL,
  side participant_side NOT NULL,
  public_profile_id UUID NOT NULL REFERENCES public_profiles (id),
  CONSTRAINT debate_participants_debate_side_unique UNIQUE (debate_id, side),
  CONSTRAINT debate_participants_debate_user_unique UNIQUE (debate_id, user_id)
);

-- Rounds
CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates (id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number >= 1),
  status round_status NOT NULL DEFAULT 'open',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline_at TIMESTAMPTZ NOT NULL,
  reminder_sent_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  CONSTRAINT rounds_debate_round_number_unique UNIQUE (debate_id, round_number)
);

CREATE INDEX idx_rounds_debate_id ON rounds (debate_id);
CREATE INDEX idx_rounds_status_deadline ON rounds (status, deadline_at);

CREATE TABLE arguments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds (id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES debate_participants (id),
  content TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  is_system_placeholder BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT arguments_round_participant_unique UNIQUE (round_id, participant_id)
);

-- Round unlock rules (config)
CREATE TABLE round_unlock_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  completed_round_number INTEGER NOT NULL CHECK (completed_round_number >= 1),
  required_continuation_requests INTEGER NOT NULL CHECK (required_continuation_requests > 0),
  reward_amount_per_participant NUMERIC(12, 2) NOT NULL CHECK (reward_amount_per_participant >= 0),
  active_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  active_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT round_unlock_rules_completed_round_number_unique UNIQUE (completed_round_number)
);

-- Continuation flow
CREATE TABLE continuation_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id),
  completed_round_id UUID NOT NULL REFERENCES rounds (id),
  challenge_token TEXT NOT NULL,
  status continuation_challenge_status NOT NULL DEFAULT 'issued',
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  CONSTRAINT continuation_challenges_token_unique UNIQUE (challenge_token)
);

CREATE INDEX idx_continuation_challenges_user_round ON continuation_challenges (user_id, completed_round_id);

CREATE TABLE continuation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates (id) ON DELETE CASCADE,
  completed_round_id UUID NOT NULL REFERENCES rounds (id),
  user_id UUID NOT NULL REFERENCES users (id),
  challenge_id UUID NOT NULL REFERENCES continuation_challenges (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT continuation_requests_user_completed_round_unique UNIQUE (user_id, completed_round_id)
);

CREATE INDEX idx_continuation_requests_completed_round ON continuation_requests (completed_round_id);
CREATE INDEX idx_continuation_requests_debate_id ON continuation_requests (debate_id);

-- Rewards
CREATE TABLE debate_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates (id) ON DELETE CASCADE,
  unlocked_by_completed_round_id UUID NOT NULL REFERENCES rounds (id),
  round_unlock_rule_id UUID NOT NULL REFERENCES round_unlock_rules (id),
  amount_per_participant NUMERIC(12, 2) NOT NULL CHECK (amount_per_participant >= 0),
  status debate_reward_status NOT NULL DEFAULT 'simulated',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT debate_rewards_debate_unlocked_round_unique UNIQUE (debate_id, unlocked_by_completed_round_id),
  CONSTRAINT debate_rewards_debate_rule_unique UNIQUE (debate_id, round_unlock_rule_id)
);

-- Auth / verification
CREATE TABLE passkey_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL,
  public_key BYTEA NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT passkey_credentials_credential_id_unique UNIQUE (credential_id)
);

CREATE INDEX idx_passkey_credentials_user_id ON passkey_credentials (user_id);

CREATE TABLE phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_phone_verifications_user_id ON phone_verifications (user_id);

-- Moderation
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users (id),
  debate_id UUID REFERENCES debates (id) ON DELETE SET NULL,
  round_id UUID REFERENCES rounds (id) ON DELETE SET NULL,
  reason report_reason NOT NULL,
  status report_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_status ON reports (status);

CREATE TABLE moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users (id),
  target_type moderation_target_type NOT NULL,
  target_id UUID NOT NULL,
  action moderation_action_type NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_moderation_actions_target ON moderation_actions (target_type, target_id);

-- Audit
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_events_user_id ON security_events (user_id);
CREATE INDEX idx_security_events_event_type ON security_events (event_type);
CREATE INDEX idx_security_events_created_at ON security_events (created_at);
