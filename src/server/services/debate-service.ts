import { z } from "zod";
import { getSql } from "@/server/db";

const createDebateSchema = z.object({
  question: z.string().min(1).max(160),
  initiator_stance: z.string().min(1).max(2000),
  category: z.string().min(1).max(80),
  display_mode: z.enum(["named", "anonymous"]),
  display_name: z.string().min(1).max(80).optional(),
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

  return sql.begin(async (tx) => {
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
        ${input.question.trim()},
        ${input.initiator_stance.trim()},
        ${input.category.trim()},
        'waiting_for_partner'
      )
      RETURNING id, question, initiator_stance, category, status::text, created_at
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
