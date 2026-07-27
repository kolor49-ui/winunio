import { ApiError } from "@/server/api/http";
import { getSql } from "@/server/db";
import { notifyUser } from "@/server/services/user-notification-service";

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
    {
      id: string;
      user_id: string | null;
      debate_id: string;
    }[]
  >`
    SELECT n.id, n.user_id, r.debate_id
    FROM round_response_notifications n
    JOIN rounds r ON r.id = n.round_id
    WHERE n.round_id = ${roundId}
      AND n.sent_at IS NULL
      AND n.notify_on = 'b_response'
      AND n.user_id IS NOT NULL
  `;

  let sent = 0;
  for (const row of pending) {
    if (!row.user_id) continue;
    try {
      await notifyUser({
        userId: row.user_id,
        title: "B válasza megjelent",
        body: "A vitában, amelyre értesítést kértél, megjelent B válasza.",
        linkPath: `/debates/${row.debate_id}`,
        emailSubject: "Winunio — B válasza megjelent",
        emailText:
          "A vitában, amelyre értesítést kértél, megjelent B válasza.",
        emailHtml:
          "<p>A vitában, amelyre értesítést kértél, megjelent <strong>B</strong> válasza.</p>",
      });
      sent += 1;
      await sql`
        UPDATE round_response_notifications
        SET sent_at = now()
        WHERE id = ${row.id}
      `;
    } catch (error) {
      console.error("[notification] B response notify failed:", row.id, error);
    }
  }

  return sent;
}
