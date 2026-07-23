import { transitionDebate } from "@/domain/debate";
import { transitionRound } from "@/domain/round";
import { DomainError } from "@/domain/types";
import {
  DEBATE_EMPTY_TIMEOUT_MESSAGE,
  ROUND_MISSING_RESPONSE_MESSAGE,
} from "@/server/constants/debate-messages";
import { sendEmail, roundDeadlineReminderEmailContent } from "@/server/email/send-email";
import { getSql } from "@/server/db";

export type BackgroundJobSummary = {
  invitation_expired: number;
  round_timeouts: number;
  round_reminders_sent: number;
};

const REMINDER_HOURS = 48;

export async function runBackgroundJobs(): Promise<BackgroundJobSummary> {
  const invitationExpired = await expireDueInvitations();
  const roundTimeouts = await closeDueRoundDeadlines();
  const roundRemindersSent = await sendDueRoundReminders();

  return {
    invitation_expired: invitationExpired,
    round_timeouts: roundTimeouts,
    round_reminders_sent: roundRemindersSent,
  };
}

export async function expireDueInvitations(): Promise<number> {
  const sql = getSql();

  const dueRows = await sql<{ id: string; debate_id: string }[]>`
    SELECT a.id, a.debate_id
    FROM debate_applications a
    JOIN debates d ON d.id = a.debate_id
    WHERE a.status = 'invited'::debate_application_status
      AND a.invitation_expires_at IS NOT NULL
      AND a.invitation_expires_at <= now()
      AND d.status = 'invitation_pending'::debate_status
  `;

  let processed = 0;

  for (const row of dueRows) {
    try {
      await sql.begin(async (tx) => {
        const [application] = await tx<
          { id: string; debate_id: string; status: string }[]
        >`
          SELECT id, debate_id, status::text AS status
          FROM debate_applications
          WHERE id = ${row.id}
          FOR UPDATE
        `;

        if (!application || application.status !== "invited") return;

        const [debate] = await tx<{ id: string; status: string }[]>`
          SELECT id, status::text AS status
          FROM debates
          WHERE id = ${application.debate_id}
          FOR UPDATE
        `;

        if (!debate || debate.status !== "invitation_pending") return;

        transitionDebate(
          { status: "invitation_pending" },
          { type: "INVITATION_EXPIRED" },
        );

        await tx`
          UPDATE debate_applications
          SET
            status = 'expired'::debate_application_status,
            invited_at = NULL,
            invitation_expires_at = NULL
          WHERE id = ${application.id}
        `;

        await tx`
          UPDATE debates
          SET status = 'waiting_for_partner'::debate_status
          WHERE id = ${debate.id} AND status = 'invitation_pending'::debate_status
        `;
      });
      processed += 1;
    } catch (error) {
      if (error instanceof DomainError) continue;
      throw error;
    }
  }

  return processed;
}

export async function closeDueRoundDeadlines(): Promise<number> {
  const sql = getSql();

  const dueRows = await sql<{ id: string; debate_id: string }[]>`
    SELECT r.id, r.debate_id
    FROM rounds r
    JOIN debates d ON d.id = r.debate_id
    WHERE r.status = 'open'::round_status
      AND r.deadline_at <= now()
      AND d.status = 'active'::debate_status
  `;

  let processed = 0;

  for (const row of dueRows) {
    const closed = await closeRoundDeadline(row.id);
    if (closed) processed += 1;
  }

  return processed;
}

async function closeRoundDeadline(roundId: string): Promise<boolean> {
  const sql = getSql();

  try {
    return await sql.begin(async (tx) => {
      const [round] = await tx<
        {
          id: string;
          debate_id: string;
          status: string;
          deadline_at: Date;
        }[]
      >`
        SELECT id, debate_id, status::text AS status, deadline_at
        FROM rounds
        WHERE id = ${roundId}
        FOR UPDATE
      `;

      if (!round || round.status !== "open") return false;
      if (round.deadline_at.getTime() > Date.now()) return false;

      const [debate] = await tx<{ id: string; status: string }[]>`
        SELECT id, status::text AS status
        FROM debates
        WHERE id = ${round.debate_id}
        FOR UPDATE
      `;

      if (!debate || debate.status !== "active") return false;

      const participants = await tx<
        { id: string; side: string; argument_id: string | null; content: string | null }[]
      >`
        SELECT
          dp.id,
          dp.side::text AS side,
          a.id AS argument_id,
          a.content
        FROM debate_participants dp
        LEFT JOIN arguments a
          ON a.participant_id = dp.id AND a.round_id = ${roundId}
        WHERE dp.debate_id = ${round.debate_id}
        ORDER BY dp.side ASC
      `;

      const submissions = participants.filter((p) => p.argument_id !== null);
      const submissionCount = submissions.length;
      const now = new Date();

      if (submissionCount >= 2) {
        transitionRound("open", { type: "TIMEOUT_BOTH_SUBMITTED" });
        transitionDebate({ status: "active" }, { type: "ROUND_PUBLISHED_BOTH_SIDES" });

        await tx`
          UPDATE rounds
          SET status = 'published'::round_status, published_at = ${now}
          WHERE id = ${roundId}
        `;
        await tx`
          UPDATE arguments
          SET published_at = ${now}
          WHERE round_id = ${roundId}
        `;
        await tx`
          UPDATE debates
          SET status = 'waiting_for_continuation'::debate_status
          WHERE id = ${round.debate_id}
        `;
        return true;
      }

      if (submissionCount === 1) {
        transitionRound("open", { type: "TIMEOUT_ONE_SUBMITTED" });
        transitionDebate({ status: "active" }, { type: "ROUND_TIMEOUT_ONE_SIDE" });

        const missing = participants.find((p) => p.argument_id === null);
        if (!missing) return false;

        await tx`
          UPDATE arguments
          SET published_at = ${now}
          WHERE round_id = ${roundId}
        `;
        await tx`
          INSERT INTO arguments (round_id, participant_id, content, is_system_placeholder, published_at)
          VALUES (
            ${roundId},
            ${missing.id},
            ${ROUND_MISSING_RESPONSE_MESSAGE},
            true,
            ${now}
          )
        `;
        await tx`
          UPDATE rounds
          SET status = 'published'::round_status, published_at = ${now}
          WHERE id = ${roundId}
        `;
        await tx`
          UPDATE debates
          SET status = 'completed'::debate_status
          WHERE id = ${round.debate_id}
        `;
        return true;
      }

      transitionRound("open", { type: "TIMEOUT_NONE_SUBMITTED" });
      transitionDebate({ status: "active" }, { type: "ROUND_TIMEOUT_NO_RESPONSE" });

      await tx`
        UPDATE rounds
        SET status = 'closed_without_content'::round_status, published_at = ${now}
        WHERE id = ${roundId}
      `;
      await tx`
        UPDATE debates
        SET status = 'completed'::debate_status
        WHERE id = ${round.debate_id}
      `;

      return true;
    });
  } catch (error) {
    if (error instanceof DomainError) return false;
    throw error;
  }
}

export async function sendDueRoundReminders(): Promise<number> {
  const sql = getSql();

  const dueRows = await sql<
    {
      round_id: string;
      debate_id: string;
      round_number: number;
      deadline_at: Date;
      question: string;
      email: string;
    }[]
  >`
    SELECT
      r.id AS round_id,
      r.debate_id,
      r.round_number,
      r.deadline_at,
      d.question,
      u.email
    FROM rounds r
    JOIN debates d ON d.id = r.debate_id
    JOIN debate_participants dp ON dp.debate_id = d.id
    JOIN users u ON u.id = dp.user_id
    WHERE r.status = 'open'::round_status
      AND r.reminder_sent_at IS NULL
      AND r.opened_at <= now() - (${REMINDER_HOURS} * interval '1 hour')
      AND d.status = 'active'::debate_status
      AND u.status = 'active'::user_status
  `;

  const roundsToMark = new Set<string>();
  let emailsSent = 0;

  for (const row of dueRows) {
    try {
      const { subject, text, html } = roundDeadlineReminderEmailContent({
        question: row.question,
        roundNumber: row.round_number,
        deadlineAt: row.deadline_at.toISOString(),
      });
      await sendEmail({ to: row.email, subject, text, html });
      emailsSent += 1;
      roundsToMark.add(row.round_id);
    } catch (error) {
      console.error("[background-job] round reminder failed:", row.round_id, error);
    }
  }

  for (const roundId of roundsToMark) {
    await sql`
      UPDATE rounds
      SET reminder_sent_at = now()
      WHERE id = ${roundId} AND reminder_sent_at IS NULL
    `;
  }

  return emailsSent;
}

export { DEBATE_EMPTY_TIMEOUT_MESSAGE };
