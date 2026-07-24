CREATE TYPE admin_notification_type AS ENUM (
  'user_registered',
  'debate_created'
);

CREATE TABLE admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type admin_notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link_path TEXT NOT NULL,
  entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_notifications_created
  ON admin_notifications (created_at DESC);

CREATE TABLE admin_notification_reads (
  admin_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES admin_notifications (id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_id, notification_id)
);

CREATE TABLE admin_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_push_subscriptions_admin
  ON admin_push_subscriptions (admin_id);
