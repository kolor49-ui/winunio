import { ApiError } from "@/server/api/http";
import {
  contentDraftContextSchema,
  type ContentDraftContext,
  type DraftFields,
} from "@/server/content-editor";
import { getSql } from "@/server/db";

export function parseDraftContextType(value: string): ContentDraftContext {
  return contentDraftContextSchema.parse(value);
}

type DraftRow = {
  context_id: string;
  question: string | null;
  reasoning: string;
  quote: string | null;
  source: string | null;
  version: number;
  saved_at: Date;
};

function mapDraftRow(row: DraftRow) {
  return {
    context_id: row.context_id,
    question: row.question,
    reasoning: row.reasoning,
    quote: row.quote,
    source: row.source,
    version: row.version,
    saved_at: row.saved_at.toISOString(),
  };
}

export async function listContentDrafts(
  userId: string,
  contextType: ContentDraftContext,
) {
  const sql = getSql();
  const rows = await sql<DraftRow[]>`
    SELECT context_id, question, reasoning, quote, source, version, saved_at
    FROM content_drafts
    WHERE user_id = ${userId}
      AND context_type = ${contextType}
    ORDER BY saved_at DESC
  `;

  return rows.map(mapDraftRow);
}

export async function getContentDraft(
  userId: string,
  contextType: ContentDraftContext,
  contextId: string,
) {
  const sql = getSql();
  const [row] = await sql<DraftRow[]>`
    SELECT context_id, question, reasoning, quote, source, version, saved_at
    FROM content_drafts
    WHERE user_id = ${userId}
      AND context_type = ${contextType}
      AND context_id = ${contextId}
    LIMIT 1
  `;

  if (!row) return null;

  return mapDraftRow(row);
}

export async function saveContentDraft(
  userId: string,
  contextType: ContentDraftContext,
  contextId: string,
  fields: DraftFields,
) {
  const sql = getSql();
  const question = fields.question?.trim() || null;
  const [row] = await sql<DraftRow[]>`
    INSERT INTO content_drafts (
      user_id,
      context_type,
      context_id,
      question,
      reasoning,
      quote,
      source,
      version,
      saved_at
    )
    VALUES (
      ${userId},
      ${contextType},
      ${contextId},
      ${question},
      ${fields.reasoning},
      ${fields.quote ?? null},
      ${fields.source ?? null},
      1,
      now()
    )
    ON CONFLICT (user_id, context_type, context_id)
    DO UPDATE SET
      question = EXCLUDED.question,
      reasoning = EXCLUDED.reasoning,
      quote = EXCLUDED.quote,
      source = EXCLUDED.source,
      version = content_drafts.version + 1,
      saved_at = now()
    RETURNING context_id, question, reasoning, quote, source, version, saved_at
  `;

  if (!row) {
    throw new ApiError(500, "INTERNAL_ERROR", "Piszkozat mentése sikertelen");
  }

  return mapDraftRow(row);
}

export async function deleteContentDraft(
  userId: string,
  contextType: ContentDraftContext,
  contextId: string,
) {
  const sql = getSql();
  await sql`
    DELETE FROM content_drafts
    WHERE user_id = ${userId}
      AND context_type = ${contextType}
      AND context_id = ${contextId}
  `;
}
