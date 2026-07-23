import { z } from "zod";
import { ApiError } from "@/server/api/http";
import { getSql } from "@/server/db";
import { readEnv } from "@/server/env";

export const contentReviewContextSchema = z.enum([
  "argument",
  "closing_statement",
  "initiator_stance",
  "application_stance",
]);

export type ContentReviewContextType = z.infer<typeof contentReviewContextSchema>;

export const contentReviewIssueSchema = z.object({
  excerpt: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  category: z.string(),
  rule_reference: z.string(),
  explanation: z.string(),
});

export type ContentReviewIssue = z.infer<typeof contentReviewIssueSchema>;

export const contentReviewResultSchema = z.object({
  status: z.enum(["approved", "revision_required", "blocked"]),
  issues: z.array(contentReviewIssueSchema),
});

export type ContentReviewResult = z.infer<typeof contentReviewResultSchema>;

const reviewRequestSchema = z.object({
  context_type: contentReviewContextSchema,
  context_id: z.string().uuid().optional(),
  text: z.string().min(1).max(2000),
  quote: z.string().max(2000).optional(),
  source: z.string().max(500).optional(),
});

export function parseContentReviewBody(body: unknown) {
  return reviewRequestSchema.parse(body);
}

const OPENAI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["approved", "revision_required", "blocked"],
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          excerpt: { type: "string" },
          start: { type: "integer" },
          end: { type: "integer" },
          category: { type: "string" },
          rule_reference: { type: "string" },
          explanation: { type: "string" },
        },
        required: [
          "excerpt",
          "start",
          "end",
          "category",
          "rule_reference",
          "explanation",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["status", "issues"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `Te a Winunio páros vitaplatform tartalom-ellenőrző modellje vagy.
A feladatod: megvizsgálni a résztvevő nyilvánosságra szánt szövegét közzététel előtt.

Vizsgáld különösen:
- sértő megfogalmazást
- személyeskedést (a másik résztvevő személyének támadása érv helyett)
- megalázást
- indokolatlanul trágár beszédet
- fenyegetést, zaklatást, gyűlöletkeltő tartalmat

Fontos:
- Különbséget teszel érv / vélemény határozott bírálata és személyes támadás között.
- Idézet esetén figyelembe veszed, hogy idézett tartalomról van szó — az idézet önmagában nem sértés, ha nem személyeskedő célzattal van beemelve.
- NEM minősíted az érv erősségét, intelligenciáját vagy politikai helyességét.

TILOS a válaszodban:
- átfogalmazott mondatot adni
- helyettesítő szót vagy kifejezést javasolni
- stílus- vagy tartalmi javítást kínálni

Engedélyezett kimenet:
- status: approved | revision_required | blocked
- issues[]: excerpt, start, end, category, rule_reference, explanation
- rule_reference formátum: "CONTENT_EDITOR §1" vagy "BUSINESS_RULES §14"
- approved esetén issues üres tömb
- revision_required: javítható sértés / hangnem
- blocked: súlyos szabálysértés (fenyegetés, gyűlöletkeltés, súlyos zaklatás)`;

function buildUserPrompt(input: {
  contextType: ContentReviewContextType;
  text: string;
  quote?: string;
  source?: string;
}): string {
  const parts = [
    `Kontextus: ${input.contextType}`,
    `Saját érvelés / szöveg:\n${input.text}`,
  ];
  if (input.quote?.trim()) {
    parts.push(`Idézet (külön mező):\n${input.quote.trim()}`);
  }
  if (input.source?.trim()) {
    parts.push(`Forrás:\n${input.source.trim()}`);
  }
  return parts.join("\n\n");
}

function getOpenAiConfig() {
  const apiKey = readEnv("OPENAI_API_KEY");
  const model = readEnv("OPENAI_MODEL") ?? "gpt-4o-mini";
  return { apiKey, model };
}

export async function callOpenAiContentReview(input: {
  contextType: ContentReviewContextType;
  text: string;
  quote?: string;
  source?: string;
}): Promise<{ result: ContentReviewResult; model: string }> {
  const { apiKey, model } = getOpenAiConfig();
  if (!apiKey) {
    throw new ApiError(
      503,
      "CONTENT_REVIEW_UNAVAILABLE",
      "Az ellenőrzés most nem érhető el — próbáld később",
    );
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "winunio_content_review",
          strict: true,
          schema: OPENAI_RESPONSE_SCHEMA,
        },
      },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[content-review] OpenAI error:", res.status, errText);
    throw new ApiError(
      503,
      "CONTENT_REVIEW_UNAVAILABLE",
      "Az ellenőrzés most nem érhető el — próbáld később",
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) {
    throw new ApiError(
      503,
      "CONTENT_REVIEW_UNAVAILABLE",
      "Az ellenőrzés most nem érhető el — próbáld később",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[content-review] invalid JSON from OpenAI:", raw);
    throw new ApiError(
      503,
      "CONTENT_REVIEW_UNAVAILABLE",
      "Az ellenőrzés most nem érhető el — próbáld később",
    );
  }

  return { result: contentReviewResultSchema.parse(parsed), model };
}

async function logContentReview(input: {
  userId: string;
  contextType: ContentReviewContextType;
  contextId?: string | null;
  text: string;
  status: ContentReviewResult["status"] | "failed";
  issues: ContentReviewIssue[];
  model?: string | null;
}) {
  const sql = getSql();
  await sql`
    INSERT INTO content_reviews (
      user_id,
      context_type,
      context_id,
      input_text,
      status,
      issues,
      provider,
      model
    )
    VALUES (
      ${input.userId},
      ${input.contextType}::content_review_context,
      ${input.contextId ?? null},
      ${input.text},
      ${input.status}::content_review_status,
      ${JSON.stringify(input.issues)}::jsonb,
      'openai',
      ${input.model ?? null}
    )
  `;
}

export async function reviewParticipantContent(input: {
  userId: string;
  contextType: ContentReviewContextType;
  contextId?: string | null;
  text: string;
  quote?: string;
  source?: string;
}): Promise<ContentReviewResult & { review_id?: string }> {
  const trimmed = input.text.trim();
  if (!trimmed) {
    throw new ApiError(422, "VALIDATION_ERROR", "A szöveg nem lehet üres");
  }

  try {
    const { result, model } = await callOpenAiContentReview({
      contextType: input.contextType,
      text: trimmed,
      quote: input.quote,
      source: input.source,
    });

    await logContentReview({
      userId: input.userId,
      contextType: input.contextType,
      contextId: input.contextId,
      text: trimmed,
      status: result.status,
      issues: result.issues,
      model,
    });

    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "CONTENT_REVIEW_UNAVAILABLE") {
        await logContentReview({
          userId: input.userId,
          contextType: input.contextType,
          contextId: input.contextId,
          text: trimmed,
          status: "failed",
          issues: [],
          model: null,
        }).catch((logError) => {
          console.error("[content-review] failed to log review:", logError);
        });
      }
      throw error;
    }
    console.error("[content-review] unexpected error:", error);
    throw new ApiError(
      503,
      "CONTENT_REVIEW_UNAVAILABLE",
      "Az ellenőrzés most nem érhető el — próbáld később",
    );
  }
}

export function throwIfContentNotApproved(
  result: ContentReviewResult,
): void {
  if (result.status === "approved") return;

  if (result.status === "revision_required") {
    throw new ApiError(
      422,
      "CONTENT_REVISION_REQUIRED",
      "A szöveget javítani kell, mielőtt közzétehető",
      { status: result.status, issues: result.issues },
    );
  }

  throw new ApiError(
    422,
    "CONTENT_BLOCKED",
    "A szöveg nem tehető közzé — súlyos szabálysértés",
    { status: result.status, issues: result.issues },
  );
}

export async function assertContentApprovedForPublication(input: {
  userId: string;
  contextType: ContentReviewContextType;
  contextId?: string | null;
  text: string;
  quote?: string;
  source?: string;
}): Promise<void> {
  const result = await reviewParticipantContent(input);
  throwIfContentNotApproved(result);
}
