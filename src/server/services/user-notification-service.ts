import webpush from "web-push";
import { getSql } from "@/server/db";
import { sendEmail } from "@/server/email/send-email";
import { readEnv } from "@/server/env";
import {
  getVapidPublicKey,
  isWebPushConfigured,
} from "@/server/services/admin-notification-service";

export { getVapidPublicKey, isWebPushConfigured };

function getAppBaseUrl(): string {
  return readEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3001";
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

async function getUserEmail(userId: string): Promise<string | null> {
  const sql = getSql();
  const [row] = await sql<{ email: string }[]>`
    SELECT email FROM users WHERE id = ${userId} LIMIT 1
  `;
  return row?.email ?? null;
}

async function sendUserPush(
  userId: string,
  input: { title: string; body: string; linkPath: string },
): Promise<void> {
  if (!configureWebPush()) return;

  const sql = getSql();
  const subscriptions = await sql<
    { id: string; endpoint: string; p256dh: string; auth: string }[]
  >`
    SELECT id, endpoint, p256dh, auth
    FROM user_push_subscriptions
    WHERE user_id = ${userId}
  `;

  if (subscriptions.length === 0) return;

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
          DELETE FROM user_push_subscriptions
          WHERE id = ${subscription.id}
        `;
      }
      console.error("[user-notification] push failed:", subscription.id, error);
    }
  }
}

export async function notifyUser(input: {
  userId: string;
  title: string;
  body: string;
  linkPath: string;
  emailSubject?: string;
  emailText?: string;
  emailHtml?: string;
}): Promise<void> {
  await sendUserPush(input.userId, {
    title: input.title,
    body: input.body,
    linkPath: input.linkPath,
  });

  if (!input.emailSubject) return;

  const email = await getUserEmail(input.userId);
  if (!email) return;

  const absoluteUrl = `${getAppBaseUrl()}${input.linkPath}`;
  try {
    await sendEmail({
      to: email,
      subject: input.emailSubject,
      text: input.emailText ?? `${input.body}\n\n${absoluteUrl}`,
      html:
        input.emailHtml ??
        `<p>${input.body}</p><p><a href="${absoluteUrl}">Megnyitás</a></p>`,
    });
  } catch (error) {
    console.error("[user-notification] email failed:", input.userId, error);
  }
}

export async function saveUserPushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO user_push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (${input.userId}, ${input.endpoint}, ${input.p256dh}, ${input.auth})
    ON CONFLICT (endpoint) DO UPDATE
    SET
      user_id = EXCLUDED.user_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth
  `;
}

function truncateQuestion(question: string): string {
  const trimmed = question.trim();
  if (trimmed.length <= 80) return trimmed;
  return `${trimmed.slice(0, 77)}…`;
}

export async function notifyPartnerInvited(input: {
  inviteeUserId: string;
  debateId: string;
  question: string;
}): Promise<void> {
  const label = truncateQuestion(input.question);
  await notifyUser({
    userId: input.inviteeUserId,
    title: "Vitapartner meghívás",
    body: `Meghívást kaptál: „${label}”`,
    linkPath: `/debates/${input.debateId}`,
    emailSubject: "Winunio — vitapartner meghívás",
    emailText: `Meghívást kaptál vitapartnernek: „${label}”`,
    emailHtml: `<p>Meghívást kaptál vitapartnernek: <strong>„${label}”</strong></p>`,
  });
}

export async function notifyInvitationAccepted(input: {
  initiatorUserId: string;
  debateId: string;
  question: string;
}): Promise<void> {
  const label = truncateQuestion(input.question);
  await notifyUser({
    userId: input.initiatorUserId,
    title: "Meghívás elfogadva",
    body: `A partner elfogadta a meghívást: „${label}”`,
    linkPath: `/debates/${input.debateId}`,
    emailSubject: "Winunio — a partner elfogadta a meghívást",
  });
}

export async function notifyInvitationRejected(input: {
  initiatorUserId: string;
  debateId: string;
  question: string;
}): Promise<void> {
  const label = truncateQuestion(input.question);
  await notifyUser({
    userId: input.initiatorUserId,
    title: "Meghívás elutasítva",
    body: `A jelentkező elutasította a meghívást: „${label}”`,
    linkPath: `/debates/${input.debateId}`,
    emailSubject: "Winunio — meghívás elutasítva",
  });
}

export async function notifyParticipantTurn(input: {
  userId: string;
  debateId: string;
  question: string;
  side: "A" | "B";
}): Promise<void> {
  const label = truncateQuestion(input.question);
  const body =
    input.side === "B"
      ? `A megszólalt — te következel (B válasz): „${label}”`
      : `Új forduló nyílt — te kezdesz (A oldal): „${label}”`;
  await notifyUser({
    userId: input.userId,
    title: "Te következel a vitában",
    body,
    linkPath: `/debates/${input.debateId}`,
    emailSubject: "Winunio — te következel a vitában",
  });
}

export async function notifyAppealApproved(input: {
  userId: string;
  linkPath?: string;
}): Promise<void> {
  await notifyUser({
    userId: input.userId,
    title: "Szöveg jóváhagyva",
    body: "Az admin jóváhagyta a szöveged — folytathatod a közzétételt.",
    linkPath: input.linkPath ?? "/vitaim",
    emailSubject: "Winunio — szöveg jóváhagyva",
  });
}

export async function notifyNewRoundOpened(debateId: string): Promise<void> {
  const sql = getSql();
  const [debate] = await sql<{ question: string }[]>`
    SELECT question FROM debates WHERE id = ${debateId} LIMIT 1
  `;
  const [participant] = await sql<{ user_id: string }[]>`
    SELECT user_id
    FROM debate_participants
    WHERE debate_id = ${debateId}
      AND side = 'A'::participant_side
    LIMIT 1
  `;
  if (!debate || !participant) return;

  await notifyParticipantTurn({
    userId: participant.user_id,
    debateId,
    question: debate.question,
    side: "A",
  });
}
