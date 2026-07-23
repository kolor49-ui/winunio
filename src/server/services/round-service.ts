import { z } from "zod";
import { transitionDebate } from "@/domain/debate";
import { transitionRound } from "@/domain/round";
import { ApiError } from "@/server/api/http";
import { getSql } from "@/server/db";
import { debateNeedsAwaitingClosure } from "@/server/services/closing-statement-service";
import { sendBResponseNotifications } from "@/server/services/notification-service";

const submitArgumentSchema = z.object({
  content: z.string().min(1).max(2000),
});

export function parseSubmitArgumentBody(body: unknown) {
  return submitArgumentSchema.parse(body);
}

export async function submitArgument(
  roundId: string,
  userId: string,
  content: string,
) {
  const sql = getSql();
  const trimmed = content.trim();

  const result = await sql.begin(async (tx) => {
    const [round] = await tx<
      {
        id: string;
        debate_id: string;
        round_number: number;
        status: string;
        deadline_at: Date;
      }[]
    >`
      SELECT id, debate_id, round_number, status::text AS status, deadline_at
      FROM rounds
      WHERE id = ${roundId}
      FOR UPDATE
    `;

    if (!round) {
      throw new ApiError(404, "NOT_FOUND", "Forduló nem található");
    }
    if (round.status !== "open") {
      throw new ApiError(409, "ROUND_NOT_OPEN", "Ez a forduló már lezárult");
    }
    if (round.deadline_at.getTime() <= Date.now()) {
      throw new ApiError(410, "ROUND_DEADLINE_PASSED", "A határidő lejárt");
    }

    const [debate] = await tx<{ id: string; status: string }[]>`
      SELECT id, status::text AS status
      FROM debates
      WHERE id = ${round.debate_id}
      FOR UPDATE
    `;

    if (!debate || debate.status !== "active") {
      throw new ApiError(409, "DEBATE_NOT_ACTIVE", "A vita nem aktív");
    }

    const [participant] = await tx<
      { id: string; side: string; role: string }[]
    >`
      SELECT id, side::text AS side, role::text AS role
      FROM debate_participants
      WHERE debate_id = ${round.debate_id} AND user_id = ${userId}
      LIMIT 1
    `;

    if (!participant) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Csak a vitázók küldhetnek választ",
      );
    }

    const [existing] = await tx<{ id: string }[]>`
      SELECT id FROM arguments
      WHERE round_id = ${roundId} AND participant_id = ${participant.id}
      LIMIT 1
    `;

    if (existing) {
      throw new ApiError(
        409,
        "ALREADY_SUBMITTED",
        "Ehhez a fordulóhoz már beküldted a válaszod",
      );
    }

    if (participant.side === "B") {
      const [aPublished] = await tx<{ id: string }[]>`
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
          "Előbb A megszólalásának meg kell jelennie",
        );
      }
    }

    const now = new Date();
    const [inserted] = await tx<
      { id: string; submitted_at: Date }[]
    >`
      INSERT INTO arguments (round_id, participant_id, content, published_at)
      VALUES (
        ${roundId},
        ${participant.id},
        ${trimmed},
        ${now}
      )
      RETURNING id, submitted_at
    `;

    let roundPublished = false;
    let debateStatus = debate.status;

    if (participant.side === "A") {
      transitionRound("open", { type: "A_PUBLISHED" });
    } else {
      transitionRound("open", { type: "B_PUBLISHED" });
      transitionDebate({ status: "active" }, { type: "ROUND_PUBLISHED_BOTH_SIDES" });

      await tx`
        UPDATE rounds
        SET status = 'published', published_at = ${now}
        WHERE id = ${roundId}
      `;
      await tx`
        UPDATE debates
        SET status = 'waiting_for_continuation'
        WHERE id = ${round.debate_id}
      `;
      roundPublished = true;
      debateStatus = "waiting_for_continuation";
    }

    const [countRow] = await tx<{ cnt: number }[]>`
      SELECT COUNT(*)::int AS cnt FROM arguments WHERE round_id = ${roundId}
    `;

    return {
      argument: {
        id: inserted.id,
        side: participant.side,
        submitted_at: inserted.submitted_at.toISOString(),
        published_at: now.toISOString(),
      },
      round: {
        id: roundId,
        round_number: round.round_number,
        published: roundPublished,
        phase: roundPublished ? ("complete" as const) : participant.side === "A" ? ("awaiting_b" as const) : ("awaiting_b" as const),
      },
      debate_status: debateStatus,
      submissions_in_round: countRow?.cnt ?? 0,
      notify_b_response: participant.side === "B",
    };
  });

  if (result.notify_b_response) {
    void sendBResponseNotifications(roundId).catch((error) => {
      console.error("[round] B response notifications failed:", error);
    });
  }

  const { notify_b_response: _, ...response } = result;
  return response;
}

export async function getViewerRoundContext(
  debateId: string,
  viewerUserId: string | null,
) {
  const sql = getSql();

  let participant: { id: string; side: string } | null = null;
  if (viewerUserId) {
    const [row] = await sql<{ id: string; side: string }[]>`
      SELECT id, side::text AS side
      FROM debate_participants
      WHERE debate_id = ${debateId} AND user_id = ${viewerUserId}
      LIMIT 1
    `;
    participant = row ?? null;
  }

  const [activeRound] = await sql<
    { id: string; round_number: number; deadline_at: Date }[]
  >`
    SELECT id, round_number, deadline_at
    FROM rounds
    WHERE debate_id = ${debateId} AND status = 'open'
    ORDER BY round_number DESC
    LIMIT 1
  `;

  let activeRoundContext: {
    id: string;
    round_number: number;
    deadline_at: string;
    phase: "awaiting_a" | "awaiting_b";
    published_sides: Array<{
      side: string;
      content: string;
      is_system_placeholder: boolean;
      published_at: string;
    }>;
    my_submission: {
      content: string;
      submitted_at: string;
      published_at: string | null;
    } | null;
    can_submit: boolean;
  } | null = null;

  if (activeRound) {
    const publishedInRound = await sql<
      {
        side: string;
        content: string;
        is_system_placeholder: boolean;
        published_at: Date;
        participant_id: string;
      }[]
    >`
      SELECT
        dp.side::text AS side,
        a.content,
        a.is_system_placeholder,
        a.published_at,
        a.participant_id
      FROM arguments a
      JOIN debate_participants dp ON dp.id = a.participant_id
      WHERE a.round_id = ${activeRound.id}
        AND a.published_at IS NOT NULL
      ORDER BY dp.side ASC
    `;

    const aPublished = publishedInRound.some(
      (row) => row.side === "A" && !row.is_system_placeholder,
    );
    const phase: "awaiting_a" | "awaiting_b" = aPublished
      ? "awaiting_b"
      : "awaiting_a";

    let mySubmission: {
      content: string;
      submitted_at: string;
      published_at: string | null;
    } | null = null;

    if (participant) {
      const [arg] = await sql<
        { content: string; submitted_at: Date; published_at: Date | null }[]
      >`
        SELECT content, submitted_at, published_at
        FROM arguments
        WHERE round_id = ${activeRound.id} AND participant_id = ${participant.id}
        LIMIT 1
      `;
      if (arg) {
        mySubmission = {
          content: arg.content,
          submitted_at: arg.submitted_at.toISOString(),
          published_at: arg.published_at?.toISOString() ?? null,
        };
      }
    }

    const canSubmit =
      Boolean(participant) &&
      !mySubmission &&
      (participant!.side === "A" || phase === "awaiting_b");

    activeRoundContext = {
      id: activeRound.id,
      round_number: activeRound.round_number,
      deadline_at: activeRound.deadline_at.toISOString(),
      phase,
      published_sides: publishedInRound.map((row) => ({
        side: row.side,
        content: row.content,
        is_system_placeholder: row.is_system_placeholder,
        published_at: row.published_at.toISOString(),
      })),
      my_submission: mySubmission,
      can_submit: canSubmit,
    };
  }

  const publishedRounds = await sql<
    {
      round_id: string;
      round_number: number;
      published_at: Date;
      side: string;
      content: string;
      is_system_placeholder: boolean;
    }[]
  >`
    SELECT
      r.id AS round_id,
      r.round_number,
      r.published_at,
      dp.side::text AS side,
      a.content,
      a.is_system_placeholder
    FROM rounds r
    JOIN arguments a ON a.round_id = r.id
    JOIN debate_participants dp ON dp.id = a.participant_id
    WHERE r.debate_id = ${debateId}
      AND r.status = 'published'
      AND a.published_at IS NOT NULL
    ORDER BY r.round_number ASC, dp.side ASC
  `;

  const publishedByRound = new Map<
    number,
    {
      round_id: string;
      round_number: number;
      published_at: string;
      sides: Array<{
        side: string;
        content: string;
        is_system_placeholder: boolean;
      }>;
    }
  >();

  for (const row of publishedRounds) {
    const existing = publishedByRound.get(row.round_number);
    const sideEntry = {
      side: row.side,
      content: row.content,
      is_system_placeholder: row.is_system_placeholder,
    };
    if (existing) {
      existing.sides.push(sideEntry);
    } else {
      publishedByRound.set(row.round_number, {
        round_id: row.round_id,
        round_number: row.round_number,
        published_at: row.published_at.toISOString(),
        sides: [sideEntry],
      });
    }
  }

  return {
    participant_side: participant?.side ?? null,
    active_round: activeRoundContext,
    published_rounds: [...publishedByRound.values()],
  };
}
