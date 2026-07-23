import { z } from "zod";
import { transitionDebate } from "@/domain/debate";
import { ApiError } from "@/server/api/http";
import { getSql } from "@/server/db";

const closingStatementSchema = z.object({
  content: z.string().min(1).max(2000),
});

export function parseClosingStatementBody(body: unknown) {
  return closingStatementSchema.parse(body);
}

type SqlClient = ReturnType<typeof getSql>;

export async function getClosingStatementContext(
  debateId: string,
  viewerUserId: string | null,
) {
  const sql = getSql();

  const [debate] = await sql<{ status: string }[]>`
    SELECT status::text AS status FROM debates WHERE id = ${debateId} LIMIT 1
  `;

  if (!debate || debate.status !== "awaiting_closure") {
    return null;
  }

  let participantId: string | null = null;
  if (viewerUserId) {
    const [p] = await sql<{ id: string }[]>`
      SELECT id FROM debate_participants
      WHERE debate_id = ${debateId} AND user_id = ${viewerUserId}
      LIMIT 1
    `;
    participantId = p?.id ?? null;
  }

  const rows = await sql<
    {
      participant_id: string;
      side: string;
      content: string;
      submitted_at: Date;
      published_at: Date | null;
    }[]
  >`
    SELECT
      cs.participant_id,
      dp.side::text AS side,
      cs.content,
      cs.submitted_at,
      cs.published_at
    FROM closing_statements cs
    JOIN debate_participants dp ON dp.id = cs.participant_id
    WHERE cs.debate_id = ${debateId}
    ORDER BY dp.side ASC
  `;

  const published = rows.filter((row) => row.published_at != null);
  if (published.length === 2) {
    return {
      phase: "published" as const,
      statements: published.map((row) => ({
        side: row.side,
        content: row.content,
        published_at: row.published_at!.toISOString(),
      })),
      viewer_can_submit: false,
      viewer_submitted: Boolean(participantId),
    };
  }

  const viewerRow = participantId
    ? rows.find((row) => row.participant_id === participantId)
    : null;

  return {
    phase: "collecting" as const,
    viewer_can_submit: Boolean(participantId) && !viewerRow,
    viewer_submitted: Boolean(viewerRow),
    viewer_statement: viewerRow?.content ?? null,
    waiting_for_partner: Boolean(
      viewerRow && rows.length < 2,
    ),
  };
}

export async function submitClosingStatement(
  debateId: string,
  userId: string,
  content: string,
) {
  const sql = getSql();
  const trimmed = content.trim();

  return sql.begin(async (tx) => {
    const [debate] = await tx<{ id: string; status: string }[]>`
      SELECT id, status::text AS status
      FROM debates
      WHERE id = ${debateId}
      FOR UPDATE
    `;

    if (!debate || debate.status !== "awaiting_closure") {
      throw new ApiError(
        409,
        "DEBATE_NOT_AWAITING_CLOSURE",
        "A vita jelenleg nem vár zárógondolatra",
      );
    }

    const [participant] = await tx<{ id: string; side: string }[]>`
      SELECT id, side::text AS side
      FROM debate_participants
      WHERE debate_id = ${debateId} AND user_id = ${userId}
      LIMIT 1
    `;

    if (!participant) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Csak a vitázók írhatnak zárógondolatot",
      );
    }

    const [existing] = await tx<{ id: string }[]>`
      SELECT id FROM closing_statements
      WHERE debate_id = ${debateId} AND participant_id = ${participant.id}
      LIMIT 1
    `;

    if (existing) {
      throw new ApiError(
        409,
        "ALREADY_SUBMITTED",
        "Már beküldted a zárógondolatod",
      );
    }

    await tx`
      INSERT INTO closing_statements (debate_id, participant_id, content)
      VALUES (${debateId}, ${participant.id}, ${trimmed})
    `;

    const [countRow] = await tx<{ cnt: number }[]>`
      SELECT COUNT(*)::int AS cnt
      FROM closing_statements
      WHERE debate_id = ${debateId}
    `;

    if ((countRow?.cnt ?? 0) < 2) {
      return {
        submitted: true as const,
        published: false as const,
        debate_status: "awaiting_closure" as const,
      };
    }

    transitionDebate(
      { status: "awaiting_closure" },
      { type: "CLOSING_STATEMENTS_PUBLISHED" },
    );

    const now = new Date();
    await tx`
      UPDATE closing_statements
      SET published_at = ${now}
      WHERE debate_id = ${debateId} AND published_at IS NULL
    `;

    await tx`
      UPDATE debates
      SET status = 'completed'::debate_status
      WHERE id = ${debateId}
    `;

    await tx`
      UPDATE debate_rewards
      SET status = 'simulated'::debate_reward_status
      WHERE debate_id = ${debateId}
        AND status = 'pending'::debate_reward_status
    `;

    return {
      submitted: true as const,
      published: true as const,
      debate_status: "completed" as const,
    };
  });
}

export async function debateNeedsAwaitingClosure(
  tx: SqlClient,
  debateId: string,
  currentRoundId: string,
): Promise<boolean> {
  const [reward] = await tx<{ id: string }[]>`
    SELECT id FROM debate_rewards WHERE debate_id = ${debateId} LIMIT 1
  `;
  if (reward) return true;

  const [priorFull] = await tx<{ id: string }[]>`
    SELECT r.id
    FROM rounds r
    WHERE r.debate_id = ${debateId}
      AND r.id <> ${currentRoundId}
      AND r.status = 'published'::round_status
      AND (
        SELECT COUNT(*)::int
        FROM arguments a
        WHERE a.round_id = r.id
          AND a.published_at IS NOT NULL
          AND a.is_system_placeholder = false
      ) >= 2
    LIMIT 1
  `;

  return Boolean(priorFull);
}
