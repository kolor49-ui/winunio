import webpush from "web-push";
import { getSql } from "@/server/db";
import { sendEmail } from "@/server/email/send-email";
import { readEnv } from "@/server/env";
import { isBootstrapAdminEmail, getBootstrapAdminEmails } from "@/server/services/bootstrap-admin-service";

export type AdminNotificationType = "user_registered" | "debate_created";

export type AdminNotificationRow = {
  id: string;
  type: AdminNotificationType;
  title: string;
  body: string;
  link_path: string;
  entity_id: string | null;
  created_at: string;
  read: boolean;
};

function getAppBaseUrl(): string {
  return readEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3001";
}

export function isWebPushConfigured(): boolean {
  return !!(
    readEnv("VAPID_PUBLIC_KEY") &&
    readEnv("VAPID_PRIVATE_KEY")
  );
}

export function getVapidPublicKey(): string | null {
  return readEnv("VAPID_PUBLIC_KEY");
}

function configureWebPush(): boolean {
  const publicKey = readEnv("VAPID_PUBLIC_KEY");
  const privateKey = readEnv("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    readEnv("VAPID_SUBJECT") ?? "mailto:winunio@winunio.com",
    publicKey,
    privateKey,
  );
  return true;
}

async function listAdminEmails(): Promise<string[]> {
  const sql = getSql();
  const rows = await sql<{ email: string }[]>`
    SELECT email
    FROM users
    WHERE is_admin = true
      AND status = 'active'
  `;
  return [...new Set([...rows.map((row) => row.email), ...getBootstrapAdminEmails()])];
}

async function insertNotification(input: {
  type: AdminNotificationType;
  title: string;
  body: string;
  linkPath: string;
  entityId?: string | null;
}): Promise<{ id: string; link_path: string }> {
  const sql = getSql();
  const [row] = await sql<{ id: string; link_path: string }[]>`
    INSERT INTO admin_notifications (
      type,
      title,
      body,
      link_path,
      entity_id
    )
    VALUES (
      ${input.type}::admin_notification_type,
      ${input.title},
      ${input.body},
      ${input.linkPath},
      ${input.entityId ?? null}
    )
    RETURNING id, link_path
  `;
  return row;
}

async function sendAdminEmails(input: {
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const emails = await listAdminEmails();
  for (const to of emails) {
    try {
      await sendEmail({
        to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
    } catch (error) {
      console.error("[admin-notification] email failed:", to, error);
    }
  }
}

async function sendAdminPush(input: {
  title: string;
  body: string;
  linkPath: string;
}): Promise<void> {
  if (!configureWebPush()) return;

  const sql = getSql();
  const subscriptions = await sql<
    {
      id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }[]
  >`
    SELECT id, endpoint, p256dh, auth
    FROM admin_push_subscriptions
  `;

  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.linkPath,
  });

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        payload,
      );
    } catch (error) {
      const statusCode =
        error &&
        typeof error === "object" &&
        "statusCode" in error &&
        typeof error.statusCode === "number"
          ? error.statusCode
          : null;
      if (statusCode === 404 || statusCode === 410) {
        await sql`
          DELETE FROM admin_push_subscriptions
          WHERE id = ${subscription.id}
        `;
      }
      console.error("[admin-notification] push failed:", subscription.id, error);
    }
  }
}

async function dispatchAdminAlert(input: {
  type: AdminNotificationType;
  title: string;
  body: string;
  linkPath: string;
  entityId?: string | null;
  emailSubject: string;
}): Promise<void> {
  const notification = await insertNotification({
    type: input.type,
    title: input.title,
    body: input.body,
    linkPath: input.linkPath,
    entityId: input.entityId ?? null,
  });

  const absoluteUrl = `${getAppBaseUrl()}${input.linkPath}`;

  await Promise.all([
    sendAdminPush({
      title: input.title,
      body: input.body,
      linkPath: input.linkPath,
    }),
    sendAdminEmails({
      subject: input.emailSubject,
      text: `${input.body}\n\n${absoluteUrl}`,
      html: `<p>${input.body}</p><p><a href="${absoluteUrl}">Megnyitás</a></p>`,
    }),
  ]);

  void notification;
}

export async function notifyAdminsUserRegistered(input: {
  userId: string;
  email: string;
  displayName?: string | null;
}): Promise<void> {
  if (isBootstrapAdminEmail(input.email)) return;

  const label = input.displayName?.trim()
    ? `${input.displayName.trim()} (${input.email})`
    : input.email;

  await dispatchAdminAlert({
    type: "user_registered",
    title: "Új regisztráció",
    body: label,
    linkPath: "/admin",
    entityId: input.userId,
    emailSubject: "Winunio — új regisztráció",
  });
}

export async function notifyAdminsDebateCreated(input: {
  debateId: string;
  question: string;
  initiatorUserId: string;
}): Promise<void> {
  const sql = getSql();
  const [initiator] = await sql<{ email: string }[]>`
    SELECT email FROM users WHERE id = ${input.initiatorUserId} LIMIT 1
  `;

  const initiatorLabel = initiator?.email ?? "Ismeretlen felhasználó";
  const question = input.question.trim();

  await dispatchAdminAlert({
    type: "debate_created",
    title: "Új vita indult",
    body: `„${question}” — ${initiatorLabel}`,
    linkPath: `/debates/${input.debateId}`,
    entityId: input.debateId,
    emailSubject: "Winunio — új vita indult",
  });
}

export async function listAdminNotifications(
  adminId: string,
  input?: { limit?: number },
): Promise<{ notifications: AdminNotificationRow[]; unread_count: number }> {
  const sql = getSql();
  const limit = Math.min(input?.limit ?? 30, 100);

  const notifications = await sql<
    {
      id: string;
      notification_type: AdminNotificationType;
      title: string;
      body: string;
      link_path: string;
      entity_id: string | null;
      created_at: Date;
      is_read: boolean;
    }[]
  >`
    SELECT
      n.id,
      n.type::text AS notification_type,
      n.title,
      n.body,
      n.link_path,
      n.entity_id,
      n.created_at,
      EXISTS (
        SELECT 1
        FROM admin_notification_reads r
        WHERE r.notification_id = n.id
          AND r.admin_id = ${adminId}
      ) AS is_read
    FROM admin_notifications n
    ORDER BY n.created_at DESC
    LIMIT ${limit}
  `;

  const [unreadRow] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM admin_notifications n
    WHERE NOT EXISTS (
      SELECT 1
      FROM admin_notification_reads r
      WHERE r.notification_id = n.id
        AND r.admin_id = ${adminId}
    )
  `;

  return {
    notifications: notifications.map((row) => ({
      id: row.id,
      type: row.notification_type,
      title: row.title,
      body: row.body,
      link_path: row.link_path,
      entity_id: row.entity_id,
      created_at: row.created_at.toISOString(),
      read: row.is_read,
    })),
    unread_count: unreadRow?.count ?? 0,
  };
}

export async function markAdminNotificationsRead(
  adminId: string,
  notificationIds?: string[],
): Promise<void> {
  const sql = getSql();

  if (notificationIds?.length) {
    for (const notificationId of notificationIds) {
      await sql`
        INSERT INTO admin_notification_reads (admin_id, notification_id)
        VALUES (${adminId}, ${notificationId})
        ON CONFLICT (admin_id, notification_id) DO NOTHING
      `;
    }
    return;
  }

  await sql`
    INSERT INTO admin_notification_reads (admin_id, notification_id)
    SELECT ${adminId}, n.id
    FROM admin_notifications n
    LEFT JOIN admin_notification_reads r
      ON r.notification_id = n.id
      AND r.admin_id = ${adminId}
    WHERE r.read_at IS NULL
    ON CONFLICT (admin_id, notification_id) DO NOTHING
  `;
}

export async function saveAdminPushSubscription(input: {
  adminId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO admin_push_subscriptions (admin_id, endpoint, p256dh, auth)
    VALUES (${input.adminId}, ${input.endpoint}, ${input.p256dh}, ${input.auth})
    ON CONFLICT (endpoint) DO UPDATE
    SET
      admin_id = EXCLUDED.admin_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth
  `;
}

export async function listRecentRegistrations(limit = 10): Promise<
  Array<{
    id: string;
    email: string;
    display_name: string | null;
    created_at: string;
  }>
> {
  const sql = getSql();
  const rows = await sql<
    {
      id: string;
      email: string;
      display_name: string | null;
      created_at: Date;
    }[]
  >`
    SELECT
      u.id,
      u.email,
      p.display_name,
      u.created_at
    FROM users u
    LEFT JOIN public_profiles p ON p.user_id = u.id
    WHERE u.status = 'active'
    ORDER BY u.created_at DESC
    LIMIT ${Math.min(limit, 50)}
  `;

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    created_at: row.created_at.toISOString(),
  }));
}
