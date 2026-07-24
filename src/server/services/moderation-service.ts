import { transitionDebate } from "@/domain/debate";
import { ApiError } from "@/server/api/http";
import { getSql } from "@/server/db";
import { computeContentHash } from "@/server/services/content-hash";
import {
  CONTENT_POLICY_VERSION,
  type ContentReviewIssue,
} from "@/server/services/moderation-types";

export type ModerationDecision = "approve" | "return_for_revision" | "reject";

export async function createModerationCaseFromReview(input: {
  requesterId: string;
  text: string;
  contentHash: string;
  issues: ContentReviewIssue[];
  debateId?: string | null;
  roundId?: string | null;
  argumentId?: string | null;
  contentReviewId?: string | null;
}) {
  const sql = getSql();
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO moderation_cases (
      source,
      status,
      requester_id,
      content_review_id,
      debate_id,
      round_id,
      argument_id,
      reported_text,
      content_hash,
      policy_version,
      ai_issues
    )
    VALUES (
      'ai_review',
      'open',
      ${input.requesterId},
      ${input.contentReviewId ?? null},
      ${input.debateId ?? null},
      ${input.roundId ?? null},
      ${input.argumentId ?? null},
      ${input.text},
      ${input.contentHash},
      ${CONTENT_POLICY_VERSION},
      ${JSON.stringify(input.issues)}::jsonb
    )
    RETURNING id
  `;
  return { id: row.id };
}

export async function createModerationCaseFromReport(input: {
  reporterId: string;
  reason: string;
  note?: string | null;
  debateId?: string | null;
  roundId?: string | null;
  argumentId?: string | null;
  reportedText: string;
  contentHash: string;
}) {
  const sql = getSql();
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO moderation_cases (
      source,
      status,
      requester_id,
      debate_id,
      round_id,
      argument_id,
      reported_text,
      content_hash,
      policy_version,
      ai_issues
    )
    VALUES (
      'user_report',
      'open',
      ${input.reporterId},
      ${input.debateId ?? null},
      ${input.roundId ?? null},
      ${input.argumentId ?? null},
      ${input.reportedText},
      ${input.contentHash},
      ${CONTENT_POLICY_VERSION},
      ${JSON.stringify([{ category: input.reason, explanation: input.note ?? "" }])}::jsonb
    )
    RETURNING id
  `;
  return { id: row.id };
}

export async function logModerationAction(input: {
  adminId: string;
  targetType: "debate" | "user" | "argument";
  targetId: string;
  action:
    | "under_review"
    | "remove_content"
    | "suspend_user"
    | "complete_debate"
    | "approve_content"
    | "reject_content"
    | "return_for_revision";
  note: string;
  contentReviewId?: string | null;
  moderationCaseId?: string | null;
  contentHash?: string | null;
}) {
  const sql = getSql();
  await sql`
    INSERT INTO moderation_actions (
      admin_id,
      target_type,
      target_id,
      action,
      note,
      content_review_id,
      moderation_case_id,
      content_hash,
      policy_version
    )
    VALUES (
      ${input.adminId},
      ${input.targetType}::moderation_target_type,
      ${input.targetId},
      ${input.action}::moderation_action_type,
      ${input.note},
      ${input.contentReviewId ?? null},
      ${input.moderationCaseId ?? null},
      ${input.contentHash ?? null},
      ${CONTENT_POLICY_VERSION}
    )
  `;
}

export async function listModerationCases(adminId: string) {
  const sql = getSql();
  await assertAdmin(adminId);

  return sql<
    {
      id: string;
      source: string;
      status: string;
      requester_id: string;
      debate_id: string | null;
      round_id: string | null;
      argument_id: string | null;
      reported_text: string;
      content_hash: string;
      policy_version: string;
      ai_issues: ContentReviewIssue[];
      content_review_id: string | null;
      created_at: Date;
      resolved_at: Date | null;
      resolution_note: string | null;
    }[]
  >`
    SELECT
      mc.id,
      mc.source::text,
      mc.status::text,
      mc.requester_id,
      mc.debate_id,
      mc.round_id,
      mc.argument_id,
      mc.reported_text,
      mc.content_hash,
      mc.policy_version,
      mc.ai_issues,
      mc.content_review_id,
      mc.created_at,
      mc.resolved_at,
      mc.resolution_note
    FROM moderation_cases mc
    WHERE mc.status = 'open'
    ORDER BY mc.created_at ASC
  `;
}

export async function getModerationCaseDetail(caseId: string, adminId: string) {
  const sql = getSql();
  await assertAdmin(adminId);

  const [caseRow] = await sql<
    {
      id: string;
      source: string;
      status: string;
      requester_id: string;
      debate_id: string | null;
      round_id: string | null;
      argument_id: string | null;
      reported_text: string;
      content_hash: string;
      policy_version: string;
      ai_issues: ContentReviewIssue[];
      content_review_id: string | null;
      created_at: Date;
    }[]
  >`
    SELECT
      id,
      source::text,
      status::text,
      requester_id,
      debate_id,
      round_id,
      argument_id,
      reported_text,
      content_hash,
      policy_version,
      ai_issues,
      content_review_id,
      created_at
    FROM moderation_cases
    WHERE id = ${caseId}
    LIMIT 1
  `;

  if (!caseRow) {
    throw new ApiError(404, "NOT_FOUND", "Moderációs ügy nem található");
  }

  const actions = await sql<
    {
      id: string;
      admin_id: string;
      action: string;
      note: string;
      created_at: Date;
      content_hash: string | null;
      policy_version: string | null;
    }[]
  >`
    SELECT id, admin_id, action::text, note, created_at, content_hash, policy_version
    FROM moderation_actions
    WHERE moderation_case_id = ${caseId}
    ORDER BY created_at ASC
  `;

  let contentReview = null;
  if (caseRow.content_review_id) {
    const [review] = await sql<
      {
        id: string;
        input_text: string;
        status: string;
        issues: ContentReviewIssue[];
        model: string | null;
      }[]
    >`
      SELECT id, input_text, status::text, issues, model
      FROM content_reviews
      WHERE id = ${caseRow.content_review_id}
      LIMIT 1
    `;
    contentReview = review ?? null;
  }

  return { case: caseRow, actions, contentReview };
}

export async function decideModerationCase(input: {
  caseId: string;
  adminId: string;
  decision: ModerationDecision;
  note: string;
}) {
  const sql = getSql();
  await assertAdmin(input.adminId);

  const detail = await getModerationCaseDetail(input.caseId, input.adminId);
  if (detail.case.status !== "open") {
    throw new ApiError(409, "CASE_CLOSED", "Az ügy már lezárult");
  }

  const statusMap: Record<
    ModerationDecision,
    "approved" | "revision_required" | "rejected"
  > = {
    approve: "approved",
    return_for_revision: "revision_required",
    reject: "rejected",
  };

  const actionMap: Record<
    ModerationDecision,
    "approve_content" | "return_for_revision" | "reject_content"
  > = {
    approve: "approve_content",
    return_for_revision: "return_for_revision",
    reject: "reject_content",
  };

  const newStatus = statusMap[input.decision];
  const targetType = detail.case.argument_id
    ? "argument"
    : detail.case.debate_id
      ? "debate"
      : "user";
  const targetId =
    detail.case.argument_id ??
    detail.case.debate_id ??
    detail.case.requester_id;

  await sql.begin(async (tx) => {
    await tx`
      UPDATE moderation_cases
      SET
        status = ${newStatus}::moderation_case_status,
        resolved_at = now(),
        resolved_by = ${input.adminId},
        resolution_note = ${input.note}
      WHERE id = ${input.caseId}
    `;

    if (detail.case.content_review_id) {
      const reviewStatus =
        input.decision === "approve" ? "approved" : "revision_required";
      await tx`
        UPDATE content_reviews
        SET status = ${reviewStatus}::content_review_status
        WHERE id = ${detail.case.content_review_id}
      `;
    }

    if (
      input.decision === "approve" &&
      detail.case.debate_id &&
      detail.case.source === "ai_review"
    ) {
      const [debate] = await tx<{ status: string; status_before_review: string | null }[]>`
        SELECT status::text, status_before_review::text
        FROM debates
        WHERE id = ${detail.case.debate_id}
        FOR UPDATE
      `;
      if (debate?.status === "under_review" && debate.status_before_review) {
        const transition = transitionDebate(
          {
            status: debate.status as Parameters<typeof transitionDebate>[0]["status"],
            statusBeforeReview:
              debate.status_before_review as Parameters<
                typeof transitionDebate
              >[0]["statusBeforeReview"],
          },
          { type: "MODERATION_RESOLVED" },
        );
        await tx`
          UPDATE debates
          SET status = ${transition.state.status}::debate_status,
              status_before_review = NULL
          WHERE id = ${detail.case.debate_id}
        `;
      }
    }

    await tx`
      INSERT INTO moderation_actions (
        admin_id,
        target_type,
        target_id,
        action,
        note,
        content_review_id,
        moderation_case_id,
        content_hash,
        policy_version
      )
      VALUES (
        ${input.adminId},
        ${targetType}::moderation_target_type,
        ${targetId},
        ${actionMap[input.decision]}::moderation_action_type,
        ${input.note},
        ${detail.case.content_review_id},
        ${input.caseId},
        ${detail.case.content_hash},
        ${CONTENT_POLICY_VERSION}
      )
    `;
  });

  return { status: newStatus };
}

export async function escalateDebateToUnderReview(input: {
  debateId: string;
  adminId: string;
  note: string;
}) {
  const sql = getSql();
  await assertAdmin(input.adminId);

  await sql.begin(async (tx) => {
    const [debate] = await tx<{ id: string; status: string }[]>`
      SELECT id, status::text AS status
      FROM debates
      WHERE id = ${input.debateId}
      FOR UPDATE
    `;

    if (!debate) {
      throw new ApiError(404, "NOT_FOUND", "Vita nem található");
    }

    if (debate.status === "under_review") {
      return;
    }

    const transition = transitionDebate(
      { status: debate.status as Parameters<typeof transitionDebate>[0]["status"] },
      { type: "MODERATION_UNDER_REVIEW" },
    );

    await tx`
      UPDATE debates
      SET
        status = ${transition.state.status}::debate_status,
        status_before_review = ${debate.status}::debate_status
      WHERE id = ${input.debateId}
    `;

    await tx`
      INSERT INTO moderation_actions (
        admin_id,
        target_type,
        target_id,
        action,
        note,
        policy_version
      )
      VALUES (
        ${input.adminId},
        'debate'::moderation_target_type,
        ${input.debateId},
        'under_review'::moderation_action_type,
        ${input.note},
        ${CONTENT_POLICY_VERSION}
      )
    `;
  });
}

export async function assertAdmin(userId: string): Promise<void> {
  const sql = getSql();
  const [user] = await sql<{ is_admin: boolean }[]>`
    SELECT is_admin FROM users WHERE id = ${userId} LIMIT 1
  `;
  if (!user?.is_admin) {
    throw new ApiError(403, "FORBIDDEN", "Admin jogosultság szükséges");
  }
}

export async function requireAdminUser(userId: string) {
  await assertAdmin(userId);
  return userId;
}

export async function requestHumanReviewForContentReviews(input: {
  userId: string;
  contentReviewIds: string[];
  note?: string | null;
}) {
  const sql = getSql();
  if (input.contentReviewIds.length === 0) {
    throw new ApiError(422, "VALIDATION_ERROR", "Legalább egy ellenőrzés szükséges");
  }

  const uniqueIds = [...new Set(input.contentReviewIds)];
  const cases: string[] = [];

  await sql.begin(async (tx) => {
    for (const reviewId of uniqueIds) {
      const [review] = await tx<
        {
          id: string;
          user_id: string;
          input_text: string;
          content_hash: string | null;
          status: string;
          issues: ContentReviewIssue[];
          moderation_case_id: string | null;
        }[]
      >`
        SELECT id, user_id, input_text, content_hash, status::text, issues, moderation_case_id
        FROM content_reviews
        WHERE id = ${reviewId}
        FOR UPDATE
      `;

      if (!review || review.user_id !== input.userId) {
        throw new ApiError(422, "INVALID_REVIEW", "Érvénytelen ellenőrzési azonosító");
      }

      if (
        review.status !== "revision_required" &&
        review.status !== "under_review"
      ) {
        throw new ApiError(
          409,
          "REVIEW_NOT_APPEALABLE",
          "Ehhez az ellenőrzéshez nem kérhető felülvizsgálat",
        );
      }

      if (review.moderation_case_id) {
        cases.push(review.moderation_case_id);
        continue;
      }

      const [caseRow] = await tx<{ id: string }[]>`
        INSERT INTO moderation_cases (
          source,
          status,
          requester_id,
          content_review_id,
          reported_text,
          content_hash,
          policy_version,
          ai_issues
        )
        VALUES (
          'user_appeal',
          'open',
          ${input.userId},
          ${review.id},
          ${review.input_text},
          ${review.content_hash ?? computeContentHash(review.input_text)},
          ${CONTENT_POLICY_VERSION},
          ${JSON.stringify(review.issues)}::jsonb
        )
        RETURNING id
      `;

      await tx`
        UPDATE content_reviews
        SET status = 'under_review'::content_review_status,
            moderation_case_id = ${caseRow.id}
        WHERE id = ${review.id}
      `;

      cases.push(caseRow.id);
    }
  });

  return {
    moderation_case_ids: cases,
    message:
      "Felülvizsgálati kérelmed rögzítve. Adminisztrátor dönt — addig a szöveg nem jelenik meg nyilvánosan.",
  };
}

export async function hideArgument(input: {
  argumentId: string;
  adminId: string;
  note: string;
  moderationCaseId?: string | null;
}) {
  const sql = getSql();
  await assertAdmin(input.adminId);

  const [argument] = await sql<{ id: string; content: string }[]>`
    SELECT id, content FROM arguments WHERE id = ${input.argumentId} LIMIT 1
  `;
  if (!argument) {
    throw new ApiError(404, "NOT_FOUND", "Argumentum nem található");
  }

  await sql.begin(async (tx) => {
    await tx`
      UPDATE arguments
      SET content = '[Eltávolítva moderáció miatt]'
      WHERE id = ${input.argumentId}
    `;

    await tx`
      INSERT INTO moderation_actions (
        admin_id,
        target_type,
        target_id,
        action,
        note,
        moderation_case_id,
        policy_version
      )
      VALUES (
        ${input.adminId},
        'argument'::moderation_target_type,
        ${input.argumentId},
        'remove_content'::moderation_action_type,
        ${input.note},
        ${input.moderationCaseId ?? null},
        ${CONTENT_POLICY_VERSION}
      )
    `;
  });
}
