import { z } from "zod";
import { ApiError } from "@/server/api/http";
import { getSql } from "@/server/db";
import { computeContentHash } from "@/server/services/content-hash";
import {
  createModerationCaseFromReport,
} from "@/server/services/moderation-service";

const reportReasonSchema = z.enum([
  "illegal",
  "threat",
  "pii",
  "harassment",
  "spam",
  "abuse",
]);

const createReportSchema = z.object({
  reason: reportReasonSchema,
  note: z.string().max(1000).optional(),
  debate_id: z.string().uuid().optional(),
  round_id: z.string().uuid().optional(),
  argument_id: z.string().uuid().optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

export function parseCreateReportBody(body: unknown): CreateReportInput {
  const parsed = createReportSchema.parse(body);
  if (!parsed.debate_id && !parsed.round_id && !parsed.argument_id) {
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      "Legalább egy cél azonosító kötelező",
    );
  }
  return parsed;
}

async function resolveReportedText(input: CreateReportInput): Promise<{
  text: string;
  debateId: string | null;
  roundId: string | null;
  argumentId: string | null;
}> {
  const sql = getSql();

  if (input.argument_id) {
    const [row] = await sql<
      { content: string; round_id: string; debate_id: string }[]
    >`
      SELECT a.content, a.round_id, r.debate_id
      FROM arguments a
      JOIN rounds r ON r.id = a.round_id
      WHERE a.id = ${input.argument_id}
      LIMIT 1
    `;
    if (!row) {
      throw new ApiError(404, "NOT_FOUND", "Argumentum nem található");
    }
    return {
      text: row.content,
      debateId: row.debate_id,
      roundId: row.round_id,
      argumentId: input.argument_id,
    };
  }

  if (input.round_id) {
    const [row] = await sql<{ debate_id: string }[]>`
      SELECT debate_id FROM rounds WHERE id = ${input.round_id} LIMIT 1
    `;
    if (!row) {
      throw new ApiError(404, "NOT_FOUND", "Forduló nem található");
    }
    return {
      text: `[round:${input.round_id}]`,
      debateId: row.debate_id,
      roundId: input.round_id,
      argumentId: null,
    };
  }

  if (!input.debate_id) {
    throw new ApiError(422, "VALIDATION_ERROR", "Vita azonosító kötelező");
  }

  const [debate] = await sql<
    { initiator_stance: string; question: string }[]
  >`
    SELECT initiator_stance, question
    FROM debates
    WHERE id = ${input.debate_id}
    LIMIT 1
  `;
  if (!debate) {
    throw new ApiError(404, "NOT_FOUND", "Vita nem található");
  }

  return {
    text: debate.initiator_stance,
    debateId: input.debate_id!,
    roundId: null,
    argumentId: null,
  };
}

export async function createReport(reporterId: string, input: CreateReportInput) {
  const sql = getSql();
  const resolved = await resolveReportedText(input);
  const contentHash = computeContentHash(resolved.text);

  const moderationCase = await createModerationCaseFromReport({
    reporterId,
    reason: input.reason,
    note: input.note,
    debateId: resolved.debateId,
    roundId: resolved.roundId,
    argumentId: resolved.argumentId,
    reportedText: resolved.text,
    contentHash,
  });

  const [report] = await sql<{ id: string }[]>`
    INSERT INTO reports (
      reporter_id,
      debate_id,
      round_id,
      argument_id,
      reason,
      status,
      note,
      moderation_case_id
    )
    VALUES (
      ${reporterId},
      ${resolved.debateId},
      ${resolved.roundId},
      ${resolved.argumentId},
      ${input.reason}::report_reason,
      'open',
      ${input.note ?? null},
      ${moderationCase.id}
    )
    RETURNING id
  `;

  return { report_id: report.id, moderation_case_id: moderationCase.id };
}

export async function listOpenReports(adminId: string) {
  const sql = getSql();

  const [admin] = await sql<{ is_admin: boolean }[]>`
    SELECT is_admin FROM users WHERE id = ${adminId} LIMIT 1
  `;
  if (!admin?.is_admin) {
    throw new ApiError(403, "FORBIDDEN", "Admin jogosultság szükséges");
  }

  return sql<
    {
      id: string;
      reason: string;
      status: string;
      note: string | null;
      debate_id: string | null;
      round_id: string | null;
      argument_id: string | null;
      moderation_case_id: string | null;
      created_at: Date;
    }[]
  >`
    SELECT
      id,
      reason::text,
      status::text,
      note,
      debate_id,
      round_id,
      argument_id,
      moderation_case_id,
      created_at
    FROM reports
    WHERE status = 'open'
    ORDER BY created_at ASC
  `;
}

export async function decideReport(input: {
  reportId: string;
  adminId: string;
  action: "dismiss" | "hide_content" | "under_review";
  note: string;
}) {
  const sql = getSql();

  const [admin] = await sql<{ is_admin: boolean }[]>`
    SELECT is_admin FROM users WHERE id = ${input.adminId} LIMIT 1
  `;
  if (!admin?.is_admin) {
    throw new ApiError(403, "FORBIDDEN", "Admin jogosultság szükséges");
  }

  const [report] = await sql<
    {
      id: string;
      status: string;
      argument_id: string | null;
      debate_id: string | null;
      moderation_case_id: string | null;
      reporter_id: string;
    }[]
  >`
    SELECT id, status::text, argument_id, debate_id, moderation_case_id, reporter_id
    FROM reports
    WHERE id = ${input.reportId}
    LIMIT 1
  `;

  if (!report) {
    throw new ApiError(404, "NOT_FOUND", "Jelentés nem található");
  }
  if (report.status !== "open") {
    throw new ApiError(409, "REPORT_CLOSED", "A jelentés már lezárult");
  }

  await sql.begin(async (tx) => {
    const newStatus = input.action === "dismiss" ? "dismissed" : "reviewed";
    await tx`
      UPDATE reports
      SET status = ${newStatus}::report_status,
          reporter_notified_at = now()
      WHERE id = ${input.reportId}
    `;

    if (report.argument_id && input.action === "hide_content") {
      await tx`
        UPDATE arguments
        SET content = '[Eltávolítva moderáció miatt]'
        WHERE id = ${report.argument_id}
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
          ${report.argument_id},
          'remove_content'::moderation_action_type,
          ${input.note},
          ${report.moderation_case_id},
          '1.0'
        )
      `;
    }

    if (report.debate_id && input.action === "under_review") {
      const [debate] = await tx<{ status: string }[]>`
        SELECT status::text FROM debates WHERE id = ${report.debate_id} FOR UPDATE
      `;
      if (debate && debate.status !== "under_review") {
        await tx`
          UPDATE debates
          SET status = 'under_review'::debate_status,
              status_before_review = ${debate.status}::debate_status
          WHERE id = ${report.debate_id}
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
            'debate'::moderation_target_type,
            ${report.debate_id},
            'under_review'::moderation_action_type,
            ${input.note},
            ${report.moderation_case_id},
            '1.0'
          )
        `;
      }
    }
  });

  return { status: input.action };
}
