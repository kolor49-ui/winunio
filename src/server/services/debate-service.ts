import { z } from "zod";
import { debateCategorySchema } from "@/domain/debate-categories";
import { transitionDebate } from "@/domain/debate";
import { transitionDebateApplication } from "@/domain/debate-application";
import { DomainError } from "@/domain/types";
import { ApiError } from "@/server/api/http";
import { getSql } from "@/server/db";
import { assertContentApprovedForPublication } from "@/server/services/content-review-service";

function mapDomainError(error: DomainError): ApiError {
  return new ApiError(409, error.code, error.message);
}

const createDebateSchema = z.object({
  question: z.string().min(1).max(160),
  initiator_stance: z.string().min(1).max(2000),
  category: debateCategorySchema,
  display_mode: z.enum(["named", "anonymous"]),
  display_name: z.string().min(1).max(80).optional(),
  question_content_review_id: z.string().uuid().optional(),
  content_review_id: z.string().uuid().optional(),
  initiator_draft_id: z.string().uuid().optional(),
});

export type CreateDebateInput = z.infer<typeof createDebateSchema>;

export function parseCreateDebateBody(body: unknown): CreateDebateInput {
  const parsed = createDebateSchema.parse(body);
  if (parsed.display_mode === "named" && !parsed.display_name) {
    throw new Error("DISPLAY_NAME_REQUIRED");
  }
  return parsed;
}

export async function createDebate(userId: string, input: CreateDebateInput) {
  const sql = getSql();

  const isAnonymous = input.display_mode === "anonymous";
  const displayName = isAnonymous ? null : (input.display_name ?? null);

  const question = input.question.trim();
  const initiatorStance = input.initiator_stance.trim();

  await assertContentApprovedForPublication({
    userId,
    contextType: "debate_question",
    text: question,
    contentReviewId: input.question_content_review_id,
  });

  await assertContentApprovedForPublication({
    userId,
    contextType: "initiator_stance",
    text: initiatorStance,
    contentReviewId: input.content_review_id,
  });

  const debate = await sql.begin(async (tx) => {
    const [existing] = await tx<{ id: string }[]>`
      SELECT id
      FROM debates
      WHERE initiator_id = ${userId}
        AND question = ${question}
        AND status NOT IN ('cancelled', 'completed')
      LIMIT 1
    `;

    if (existing) {
      throw new ApiError(
        409,
        "DEBATE_ALREADY_EXISTS",
        "Már indítottál vitát ezzel a kérdéssel.",
        { debate_id: existing.id },
      );
    }

    await tx`
      UPDATE public_profiles
      SET display_name = ${displayName}, is_anonymous = ${isAnonymous}
      WHERE user_id = ${userId}
    `;

    const [debate] = await tx<
      {
        id: string;
        question: string;
        initiator_stance: string;
        category: string;
        status: string;
        created_at: Date;
      }[]
    >`
      INSERT INTO debates (
        initiator_id,
        question,
        initiator_stance,
        category,
        status
      )
      VALUES (
        ${userId},
        ${question},
        ${initiatorStance},
        ${input.category.trim()},
        'waiting_for_partner'
      )
      RETURNING id, question, initiator_stance, category, status::text, created_at
    `;

    if (input.initiator_draft_id) {
      await tx`
        DELETE FROM content_drafts
        WHERE user_id = ${userId}
          AND context_type = 'initiator_stance'
          AND context_id = ${input.initiator_draft_id}
      `;
    }

    await tx`
      DELETE FROM content_drafts
      WHERE user_id = ${userId}
        AND context_type = 'initiator_stance'
        AND question = ${question}
    `;

    return {
      id: debate.id,
      question: debate.question,
      initiator_stance: debate.initiator_stance,
      category: debate.category,
      status: debate.status,
      created_at: debate.created_at.toISOString(),
    };
  });

  return debate;
}

export async function listDebates(sort: "new" | "popular" = "new") {
  const sql = getSql();

  if (sort === "popular") {
    const rows = await sql<
      {
        id: string;
        question: string;
        category: string;
        status: string;
        created_at: Date;
        continuation_count_7d: number;
      }[]
    >`
      SELECT
        d.id,
        d.question,
        d.category,
        d.status::text AS status,
        d.created_at,
        COALESCE(cr.cnt, 0)::int AS continuation_count_7d
      FROM debates d
      LEFT JOIN (
        SELECT debate_id, COUNT(*)::int AS cnt
        FROM continuation_requests
        WHERE created_at >= now() - interval '7 days'
        GROUP BY debate_id
      ) cr ON cr.debate_id = d.id
      WHERE d.status NOT IN ('cancelled', 'draft')
      ORDER BY continuation_count_7d DESC, d.created_at DESC
    `;
    return rows.map(formatDebateListItem);
  }

  const rows = await sql<
    {
      id: string;
      question: string;
      category: string;
      status: string;
      created_at: Date;
    }[]
  >`
    SELECT id, question, category, status::text AS status, created_at
    FROM debates
    WHERE status NOT IN ('cancelled', 'draft')
    ORDER BY created_at DESC
  `;
  return rows.map(formatDebateListItem);
}

export type UserDebateListItem = {
  id: string;
  question: string;
  category: string;
  status: string;
  created_at: string;
  involvement: "initiator" | "participant" | "applicant";
  side: "A" | "B" | null;
  application_status: string | null;
};

export async function listUserDebates(userId: string): Promise<UserDebateListItem[]> {
  const sql = getSql();

  const rows = await sql<
    {
      id: string;
      question: string;
      category: string;
      status: string;
      created_at: Date;
      involvement: "initiator" | "participant" | "applicant";
      side: "A" | "B" | null;
      application_status: string | null;
    }[]
  >`
    SELECT
      d.id,
      d.question,
      d.category,
      d.status::text AS status,
      d.created_at,
      CASE
        WHEN d.initiator_id = ${userId} THEN 'initiator'
        WHEN dp.user_id IS NOT NULL THEN 'participant'
        ELSE 'applicant'
      END AS involvement,
      dp.side::text AS side,
      da.status::text AS application_status
    FROM debates d
    LEFT JOIN debate_participants dp
      ON dp.debate_id = d.id AND dp.user_id = ${userId}
    LEFT JOIN debate_applications da
      ON da.debate_id = d.id AND da.user_id = ${userId}
    WHERE d.status NOT IN ('cancelled', 'draft')
      AND (
        d.initiator_id = ${userId}
        OR dp.user_id IS NOT NULL
        OR da.user_id IS NOT NULL
      )
    ORDER BY d.created_at DESC
  `;

  return rows.map((row) => ({
    id: row.id,
    question: row.question,
    category: row.category,
    status: row.status,
    created_at: row.created_at.toISOString(),
    involvement: row.involvement,
    side: row.side,
    application_status: row.application_status,
  }));
}

function formatDebateListItem(row: {
  id: string;
  question: string;
  category: string;
  status: string;
  created_at: Date;
  continuation_count_7d?: number;
}) {
  return {
    id: row.id,
    question: row.question,
    category: row.category,
    status: row.status,
    created_at: row.created_at.toISOString(),
    ...(row.continuation_count_7d !== undefined
      ? { continuation_count_7d: row.continuation_count_7d }
      : {}),
  };
}

export async function getDebateById(debateId: string) {
  const sql = getSql();

  const [debate] = await sql<
    {
      id: string;
      initiator_id: string;
      question: string;
      initiator_stance: string;
      category: string;
      status: string;
      created_at: Date;
      published_at: Date | null;
    }[]
  >`
    SELECT
      id, initiator_id, question, initiator_stance, category,
      status::text AS status, created_at, published_at
    FROM debates
    WHERE id = ${debateId}
    LIMIT 1
  `;

  if (!debate) return null;

  const rounds = await sql<
    {
      id: string;
      round_number: number;
      status: string;
      opened_at: Date;
      deadline_at: Date;
      published_at: Date | null;
    }[]
  >`
    SELECT id, round_number, status::text AS status, opened_at, deadline_at, published_at
    FROM rounds
    WHERE debate_id = ${debateId}
    ORDER BY round_number ASC
  `;

  const activeRound = rounds.find((r) => r.status === "open") ?? null;
  const latestPublished =
    [...rounds].reverse().find((r) => r.status === "published") ?? null;

  let continuation_request_count = 0;
  if (latestPublished) {
    const [count] = await sql<{ cnt: number }[]>`
      SELECT COUNT(*)::int AS cnt
      FROM continuation_requests
      WHERE completed_round_id = ${latestPublished.id}
    `;
    continuation_request_count = count?.cnt ?? 0;
  }

  const [reward] = await sql<
    { amount_per_participant: string; status: string }[]
  >`
    SELECT amount_per_participant::text, status::text
    FROM debate_rewards
    WHERE debate_id = ${debateId}
    ORDER BY calculated_at DESC
    LIMIT 1
  `;

  const [invitedApplication] = await sql<
    {
      id: string;
      stance: string;
      invitation_expires_at: Date | null;
      user_id: string;
    }[]
  >`
    SELECT id, stance, invitation_expires_at, user_id
    FROM debate_applications
    WHERE debate_id = ${debateId} AND status = 'invited'
    ORDER BY invited_at DESC
    LIMIT 1
  `;

  const [acceptedApplication] = await sql<{ stance: string }[]>`
    SELECT stance
    FROM debate_applications
    WHERE debate_id = ${debateId} AND status = 'accepted'
    LIMIT 1
  `;

  return {
    id: debate.id,
    initiator_id: debate.initiator_id,
    question: debate.question,
    initiator_stance: debate.initiator_stance,
    category: debate.category,
    status: debate.status,
    created_at: debate.created_at.toISOString(),
    published_at: debate.published_at?.toISOString() ?? null,
    rounds: rounds.map((r) => ({
      id: r.id,
      round_number: r.round_number,
      status: r.status,
      opened_at: r.opened_at.toISOString(),
      deadline_at: r.deadline_at.toISOString(),
      published_at: r.published_at?.toISOString() ?? null,
    })),
    active_round: activeRound
      ? {
          id: activeRound.id,
          round_number: activeRound.round_number,
          deadline_at: activeRound.deadline_at.toISOString(),
        }
      : null,
    continuation_request_count,
    pending_invitation: invitedApplication
      ? {
          id: invitedApplication.id,
          stance: invitedApplication.stance,
          invitation_expires_at:
            invitedApplication.invitation_expires_at?.toISOString() ?? null,
          invitee_user_id: invitedApplication.user_id,
        }
      : null,
    partner_stance: acceptedApplication?.stance ?? invitedApplication?.stance ?? null,
    reward: reward
      ? {
          amount_per_participant: Number(reward.amount_per_participant),
          status: reward.status,
        }
      : null,
  };
}

export async function cancelDebate(debateId: string, userId: string) {
  const sql = getSql();

  return sql.begin(async (tx) => {
    const [debate] = await tx<
      { id: string; initiator_id: string; status: string }[]
    >`
      SELECT id, initiator_id, status::text AS status
      FROM debates
      WHERE id = ${debateId}
      FOR UPDATE
    `;

    if (!debate) {
      throw new ApiError(404, "NOT_FOUND", "Vita nem található");
    }

    if (debate.initiator_id !== userId) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Csak a vitaindító vonhatja vissza a vitát",
      );
    }

    if (debate.status === "cancelled") {
      return { debate_id: debate.id, debate_status: "cancelled" as const };
    }

    try {
      transitionDebate(
        {
          status: debate.status as "waiting_for_partner" | "invitation_pending",
        },
        { type: "CANCEL_DEBATE" },
      );
    } catch (error) {
      if (error instanceof DomainError) throw mapDomainError(error);
      throw error;
    }

    await tx`
      UPDATE debates
      SET status = 'cancelled'
      WHERE id = ${debateId}
    `;

    const applications = await tx<{ id: string; status: string }[]>`
      SELECT id, status::text AS status
      FROM debate_applications
      WHERE debate_id = ${debateId}
        AND status IN ('pending', 'invited')
      FOR UPDATE
    `;

    for (const application of applications) {
      try {
        transitionDebateApplication(
          application.status as "pending" | "invited",
          { type: "DEBATE_CANCELLED" },
        );
      } catch (error) {
        if (error instanceof DomainError) throw mapDomainError(error);
        throw error;
      }

      await tx`
        UPDATE debate_applications
        SET status = 'closed'
        WHERE id = ${application.id}
      `;
    }

    return { debate_id: debate.id, debate_status: "cancelled" as const };
  });
}
