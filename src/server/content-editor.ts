import { z } from "zod";

export const contentDraftContextSchema = z.enum([
  "argument",
  "closing_statement",
  "initiator_stance",
  "application_stance",
]);

export type ContentDraftContext = z.infer<typeof contentDraftContextSchema>;

export const editorFieldsSchema = z
  .object({
    reasoning: z.string().min(1, "A saját érvelés kötelező").max(2000),
    quote: z.string().max(2000).optional().nullable(),
    source: z.string().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const quote = data.quote?.trim();
    const source = data.source?.trim();
    if (quote && !source) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Idézethez forrás kötelező",
        path: ["source"],
      });
    }
  });

export type EditorFields = z.infer<typeof editorFieldsSchema>;

export const draftFieldsSchema = z.object({
  reasoning: z.string().max(2000),
  quote: z.string().max(2000).optional().nullable(),
  source: z.string().max(500).optional().nullable(),
  question: z.string().max(160).optional().nullable(),
});

export type DraftFields = z.infer<typeof draftFieldsSchema>;

export function normalizeEditorFields(input: {
  reasoning: string;
  quote?: string | null;
  source?: string | null;
}): EditorFields {
  return editorFieldsSchema.parse({
    reasoning: input.reasoning.trim(),
    quote: input.quote?.trim() || null,
    source: input.source?.trim() || null,
  });
}

export function formatParticipantContent(input: EditorFields): string {
  const parts = [input.reasoning];
  if (input.quote) {
    parts.push("", "— Idézet —", input.quote);
    if (input.source) {
      parts.push(`Forrás: ${input.source}`);
    }
  }
  return parts.join("\n");
}

export function parseLegacyOrEditorBody(body: unknown): {
  fields: EditorFields;
  content: string;
  content_review_id?: string;
} {
  const schema = z
    .object({
      content: z.string().min(1).max(2000).optional(),
      reasoning: z.string().min(1).max(2000).optional(),
      quote: z.string().max(2000).optional().nullable(),
      source: z.string().max(500).optional().nullable(),
      content_review_id: z.string().uuid().optional(),
    })
    .superRefine((data, ctx) => {
      if (!data.content?.trim() && !data.reasoning?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A szöveg kötelező",
          path: ["reasoning"],
        });
      }
    });

  const parsed = schema.parse(body);

  if (parsed.reasoning?.trim()) {
    const fields = normalizeEditorFields({
      reasoning: parsed.reasoning,
      quote: parsed.quote,
      source: parsed.source,
    });
    return {
      fields,
      content: formatParticipantContent(fields),
      content_review_id: parsed.content_review_id,
    };
  }

  const reasoning = parsed.content!.trim();
  const fields = normalizeEditorFields({ reasoning, quote: null, source: null });
  return {
    fields,
    content: reasoning,
    content_review_id: parsed.content_review_id,
  };
}
