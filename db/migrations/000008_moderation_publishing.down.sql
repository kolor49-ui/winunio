ALTER TABLE moderation_actions
  DROP COLUMN IF EXISTS policy_version,
  DROP COLUMN IF EXISTS content_hash,
  DROP COLUMN IF EXISTS moderation_case_id,
  DROP COLUMN IF EXISTS content_review_id;

ALTER TABLE reports
  DROP COLUMN IF EXISTS author_notified_at,
  DROP COLUMN IF EXISTS reporter_notified_at,
  DROP COLUMN IF EXISTS moderation_case_id,
  DROP COLUMN IF EXISTS note,
  DROP COLUMN IF EXISTS argument_id;

ALTER TABLE content_reviews DROP COLUMN IF EXISTS moderation_case_id;

DROP TABLE IF EXISTS moderation_cases;

ALTER TABLE content_reviews
  DROP COLUMN IF EXISTS policy_version,
  DROP COLUMN IF EXISTS content_hash;

ALTER TABLE debates DROP COLUMN IF EXISTS status_before_review;

ALTER TABLE users DROP COLUMN IF EXISTS is_admin;

-- Enum values cannot be removed safely in PostgreSQL without rebuild.
