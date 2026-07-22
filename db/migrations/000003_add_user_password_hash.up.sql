-- Email + jelszó auth (ADR nyitott döntés: MVP vitázóknak elég)
ALTER TABLE users
  ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';

-- Remove default so new rows must set hash explicitly
ALTER TABLE users ALTER COLUMN password_hash DROP DEFAULT;
