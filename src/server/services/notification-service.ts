import { ApiError } from "@/server/api/http";
import { getSql } from "@/server/db";
import { sendEmail } from "@/server/email/send-email";

export async function subscribeToBResponse(
  roundId: string,
  userId: string,
): Promise<{ subscribed: true }> {
  const sql = getSql();

  const [round] = await sql<
    { id: string; status: string; debate_id: string }[]
  >`
    SELECT id, status::text AS status, debate_id
    FROM rounds
    WHERE id = ${roundId}
    LIMIT 1
  `;

  if (!round || round.status !== "open") {
    throw new ApiError(409, "ROUND_NOT_OPEN", "A forduló nem vár B válaszra");
  }

  const [aPublished] = await sql<{ id: string }[]>`
    SELECT a.id
    FROM arguments a
    JOIN debate_participants dp ON dp.id = a.participant_id
    WHERE a.round_id = ${roundId}
      AND dp.side = 'A'::participant_side
      AND a.published_at IS NOT NULL
      AND a.is_system_placeholder = false
    LIMIT 1
  `;

  if (!aPublished) {
    throw new ApiError(
      409,
      "AWAITING_A",
      "Még nem jelent meg A megszólalása",
    );
  }

  const [bPublished] = await sql<{ id: string }[]>`
    SELECT a.id
    FROM arguments a
    JOIN debate_participants dp ON dp.id = a.participant_id
    WHERE a.round_id = ${roundId}
      AND dp.side = 'B'::participant_side
      AND a.published_at IS NOT NULL
    LIMIT 1
  `;

  if (bPublished) {
    throw new ApiError(
      409,
      "B_ALREADY_PUBLISHED",
      "B válasza már megjelent",
    );
  }

  await sql`
    INSERT INTO round_response_notifications (round_id, user_id, notify_on)
    VALUES (${roundId}, ${userId}, 'b_response')
    ON CONFLICT (round_id, user_id) DO NOTHING
  `;

  return { subscribed: true as const };
}

export async function sendBResponseNotifications(roundId: string): Promise<number> {
  const sql = getSql();

  const pending = await sql<
    { id: string; user_id: string | null; email: string | null }[]
  >`
    SELECT n.id, n.user_id, u.email
    FROM round_response_notifications n
    LEFT JOIN users u ON u.id = n.user_id
    WHERE n.round_id = ${roundId}
      AND n.sent_at IS NULL
      AND n.notify_on = 'b_response'
  `;

  let sent = 0;
  for (const row of pending) {
    const email = row.email;
    if (!email) continue;
    try {
      await sendEmail({
        to: email,
        subject: "B válasza megjelent a vitán",
        text: "A vitában, amelyre értesítést kértél, megjelent B válasza.",
        html: "<p>A vitában, amelyre értesítést kértél, megjelent <strong>B</strong> válasza.</p>",
      });
      sent += 1;
      await sql`
        UPDATE round_response_notifications
        SET sent_at = now()
        WHERE id = ${row.id}
      `;
    } catch (error) {
      console.error("[notification] B response email failed:", row.id, error);
    }
  }

  return sent;
}
