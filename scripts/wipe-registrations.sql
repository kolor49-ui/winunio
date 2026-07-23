-- Teszt regisztrációk és kapcsolódó adatok törlése.
-- A round_unlock_rules (küszöb szabályok) megmarad.

BEGIN;

TRUNCATE TABLE
  continuation_requests,
  continuation_challenges,
  arguments,
  debate_rewards,
  debate_participants,
  debate_applications,
  moderation_actions,
  reports,
  security_events,
  rounds,
  debates,
  email_auth_tokens,
  passkey_credentials,
  phone_verifications,
  public_profiles,
  users
RESTART IDENTITY CASCADE;

COMMIT;
