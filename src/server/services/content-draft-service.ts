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

export async function getContentDraft(
  userId: string,
  contextType: ContentDraftContext,
  contextId: string,
) {
  const sql = getSql();
  const [row] = await sql<
    {
      reasoning: string;
      quote: string | null;
      source: string | null;
      version: number;
      saved_at: Date;
    }[]
  >`
    SELECT reasoning, quote, source, version, saved_at
    FROM content_drafts
    WHERE user_id = ${userId}
      AND context_type = ${contextType}
      AND context_id = ${contextId}
    LIMIT 1
  `;

  if (!row) return null;

  return {
    reasoning: row.reasoning,
    quote: row.quote,
    source: row.source,
    version: row.version,
    saved_at: row.saved_at.toISOString(),
  };
}

export async function saveContentDraft(
  userId: string,
  contextType: ContentDraftContext,
  contextId: string,
  fields: DraftFields,
) {
  const sql = getSql();
  const [row] = await sql<
    {
      reasoning: string;
      quote: string | null;
      source: string | null;
      version: number;
      saved_at: Date;
    }[]
  >`
    INSERT INTO content_drafts (
      user_id,
      context_type,
      context_id,
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
      ${fields.reasoning},
      ${fields.quote ?? null},
      ${fields.source ?? null},
      1,
      now()
    )
    ON CONFLICT (user_id, context_type, context_id)
    DO UPDATE SET
      reasoning = EXCLUDED.reasoning,
      quote = EXCLUDED.quote,
      source = EXCLUDED.source,
      version = content_drafts.version + 1,
      saved_at = now()
    RETURNING reasoning, quote, source, version, saved_at
  `;

  if (!row) {
    throw new ApiError(500, "INTERNAL_ERROR", "Piszkozat mentése sikertelen");
  }

  return {
    reasoning: row.reasoning,
    quote: row.quote,
    source: row.source,
    version: row.version,
    saved_at: row.saved_at.toISOString(),
  };
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
