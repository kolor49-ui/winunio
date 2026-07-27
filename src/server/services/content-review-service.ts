import { z } from "zod";
import { ApiError } from "@/server/api/http";
import { getSql } from "@/server/db";
import { readEnv } from "@/server/env";
import {
  detectMissingSpaceSuggestions,
  mergeSpellCheckSuggestions,
  missingSpaceSuggestionsToReviewIssues,
} from "@/server/missing-space-detection";
import { computeContentHash } from "@/server/services/content-hash";
import { createModerationCaseFromReview } from "@/server/services/moderation-service";
import {
  CONTENT_POLICY_VERSION,
} from "@/server/services/moderation-types";

export const contentReviewContextSchema = z.enum([
  "argument",
  "closing_statement",
  "initiator_stance",
  "application_stance",
  "debate_question",
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

export const contentReviewStatusSchema = z.enum([
  "approved",
  "advisory_language",
  "revision_required",
  "under_review",
]);

export type ContentReviewStatus = z.infer<typeof contentReviewStatusSchema>;

export const contentReviewResultSchema = z.object({
  status: contentReviewStatusSchema,
  issues: z.array(contentReviewIssueSchema),
});

export type ContentReviewResult = z.infer<typeof contentReviewResultSchema>;

/** AI raw output — blocked maps to under_review after normalization. */
const aiReviewResultSchema = z.object({
  status: z.enum([
    "approved",
    "advisory_language",
    "revision_required",
    "blocked",
  ]),
  issues: z.array(contentReviewIssueSchema),
});

export type ContentReviewWithMeta = ContentReviewResult & {
  review_id: string;
  content_hash: string;
  policy_version: string;
  moderation_case_id?: string;
};

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

const publishRequestFields = z.object({
  content_review_id: z.string().uuid().optional(),
  content_hash: z.string().length(64).optional(),
});

export function parsePublishReviewFields(body: Record<string, unknown>) {
  return publishRequestFields.parse(body);
}

const OPENAI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["approved", "advisory_language", "revision_required", "blocked"],
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

Három külön kategória — ne keverd össze:
1. Helyesírási / érthetőségi probléma → advisory_language (NEM blokkol)
2. Winunio viselkedésszabály sértés (személyeskedés, megalázás, trágárság) → revision_required
3. Bizonytalan jogi kockázat vagy súlyos eset → blocked (emberi felülvizsgálat)

Vizsgáld különösen:
- sértő megfogalmazást
- személyeskedést (a másik résztvevő személyének támadása érv helyett)
- megalázást
- indokolatlanul trágár beszédet
- fenyegetést, zaklatást, gyűlöletkeltő tartalmat

Fontos:
- Különbséget teszel érv / vélemény határozott bírálata és személyes támadás között.
- Idézet esetén figyelembe veszed, hogy idézett tartalomról van szó.
- NEM minősíted az érv erősségét vagy politikai helyességét.
- Helyesírási hibák, elütések, hiányzó ékezetek, hiányzó szóközök (összeérő szavak), zavaros megfogalmazás → advisory_language.
- Elütés vagy nehezen érthető szöveg ÖNMAGÁBAN NEM személyeskedés és NEM sértés.
- Példa advisory_language: „vagy ijet nem monhatók megamrúl?” — helyesírási/érthetőségi jelzés, nem sértés.
- NE állítsd önállóan, hogy egy szöveg törvénybe ütközik — bizonytalan esetben blocked (emberi döntés).

TILOS a válaszodban:
- átfogalmazott mondatot adni
- helyettesítő szót vagy kifejezést javasolni
- stílus- vagy tartalmi javítást kínálni

Engedélyezett kimenet:
- status: approved | advisory_language | revision_required | blocked
- issues[]: excerpt, start, end, category, rule_reference, explanation
- rule_reference: "CONTENT_EDITOR §1" vagy "BUSINESS_RULES §14"
- approved: nincs probléma
- advisory_language: helyesírás/érthetőség — issues lehet üres vagy jelzés
- revision_required: javítható viselkedésszabály-sértés
- blocked: súlyos vagy bizonytalan eset — emberi felülvizsgálat`;

const LANGUAGE_ADVISORY_CATEGORIES = new Set([
  "spelling",
  "typo",
  "grammar",
  "clarity",
  "readability",
  "helyesírás",
  "elütés",
  "érthetőség",
  "language",
]);

const BEHAVIOR_CATEGORIES = new Set([
  "personal_attack",
  "insult",
  "harassment",
  "threat",
  "hate",
  "profanity",
  "személyeskedés",
  "sértés",
  "megalázás",
  "fenyegetés",
  "zaklatás",
]);

function buildUserPrompt(input: {
  contextType: ContentReviewContextType;
  text: string;
  quote?: string;
  source?: string;
}): string {
  const parts = [
    `Kontextus: ${input.contextType}${
      input.contextType === "debate_question"
        ? " (rövid vitakérdés, max. 160 karakter — helyesírás/érthetőség advisory, viselkedésszabály továbbra is érvényes)"
        : ""
    }`,
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

/** Post-process AI output — spelling/clarity must not block publish. */
export function augmentWithMissingSpaceAdvisory(
  result: ContentReviewResult,
  text: string,
): ContentReviewResult {
  const spaceIssues = missingSpaceSuggestionsToReviewIssues(
    detectMissingSpaceSuggestions(text),
  );
  if (spaceIssues.length === 0) {
    return result;
  }

  const mergedIssues = [...result.issues];
  for (const issue of spaceIssues) {
    const duplicate = mergedIssues.some(
      (existing) =>
        existing.start === issue.start &&
        existing.end === issue.end &&
        existing.excerpt === issue.excerpt,
    );
    if (!duplicate) {
      mergedIssues.push(issue);
    }
  }

  if (result.status === "approved" || result.status === "advisory_language") {
    return {
      status: "advisory_language",
      issues: mergedIssues,
    };
  }

  return result;
}

/** Post-process AI output — spelling/clarity must not block publish. */
export function normalizeReviewResult(
  raw: z.infer<typeof aiReviewResultSchema>,
  text: string,
): ContentReviewResult {
  if (raw.status === "blocked") {
    return augmentWithMissingSpaceAdvisory(
      { status: "under_review", issues: raw.issues },
      text,
    );
  }

  if (raw.status === "advisory_language" || raw.status === "approved") {
    return augmentWithMissingSpaceAdvisory(
      { status: raw.status, issues: raw.issues },
      text,
    );
  }

  if (raw.status === "revision_required") {
    if (looksLikeLanguageAdvisory(text) || isLanguageOnlyIssue(raw.issues, text)) {
      return augmentWithMissingSpaceAdvisory(
        {
          status: "advisory_language",
          issues: raw.issues.map((issue) => ({
            ...issue,
            category: issue.category || "clarity",
            explanation:
              issue.explanation ||
              "A szöveg nehezen érthető lehet, vagy helyesírási hibát tartalmaz.",
          })),
        },
        text,
      );
    }
    return augmentWithMissingSpaceAdvisory(
      { status: "revision_required", issues: raw.issues },
      text,
    );
  }

  return augmentWithMissingSpaceAdvisory(
    { status: "approved", issues: raw.issues },
    text,
  );
}

export function isLanguageOnlyIssue(
  issues: ContentReviewIssue[],
  text: string,
): boolean {
  if (issues.length === 0) {
    return looksLikeLanguageAdvisory(text);
  }

  return issues.every((issue) => {
    const cat = issue.category.toLowerCase();
    const expl = issue.explanation.toLowerCase();
    if (BEHAVIOR_CATEGORIES.has(cat)) return false;
    if (
      /személyesked|sértő|megaláz|fenyeget|zaklat|gyűlölet|trágár/i.test(
        expl,
      )
    ) {
      return false;
    }
    return (
      LANGUAGE_ADVISORY_CATEGORIES.has(cat) ||
      /helyesír|elütés|érthet|zavaros|pontozás|ékezet|szóköz|összeér/i.test(expl)
    );
  });
}

export function looksLikeLanguageAdvisory(text: string): boolean {
  return /megamrúl|ijet|monhatók/i.test(text.trim());
}

export function isPublishableStatus(status: ContentReviewStatus): boolean {
  return status === "approved" || status === "advisory_language";
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
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new ApiError(
      503,
      "CONTENT_REVIEW_UNAVAILABLE",
      "Az ellenőrzés most nem érhető el — próbáld később",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    console.error("[content-review] invalid JSON from OpenAI:", rawContent);
    throw new ApiError(
      503,
      "CONTENT_REVIEW_UNAVAILABLE",
      "Az ellenőrzés most nem érhető el — próbáld később",
    );
  }

  const aiResult = aiReviewResultSchema.parse(parsed);
  return {
    result: normalizeReviewResult(aiResult, input.text),
    model,
  };
}

async function logContentReview(input: {
  userId: string;
  contextType: ContentReviewContextType;
  contextId?: string | null;
  text: string;
  contentHash: string;
  status: ContentReviewResult["status"] | "failed";
  issues: ContentReviewIssue[];
  model?: string | null;
  moderationCaseId?: string | null;
}): Promise<string> {
  const sql = getSql();
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO content_reviews (
      user_id,
      context_type,
      context_id,
      input_text,
      content_hash,
      policy_version,
      status,
      issues,
      provider,
      model,
      moderation_case_id
    )
    VALUES (
      ${input.userId},
      ${input.contextType}::content_review_context,
      ${input.contextId ?? null},
      ${input.text},
      ${input.contentHash},
      ${CONTENT_POLICY_VERSION},
      ${input.status}::content_review_status,
      ${JSON.stringify(input.issues)}::jsonb,
      'openai',
      ${input.model ?? null},
      ${input.moderationCaseId ?? null}
    )
    RETURNING id
  `;
  return row.id;
}

export async function reviewParticipantContent(input: {
  userId: string;
  contextType: ContentReviewContextType;
  contextId?: string | null;
  text: string;
  quote?: string;
  source?: string;
  debateId?: string | null;
  roundId?: string | null;
  argumentId?: string | null;
}): Promise<ContentReviewWithMeta> {
  const trimmed = input.text.trim();
  if (!trimmed) {
    throw new ApiError(422, "VALIDATION_ERROR", "A szöveg nem lehet üres");
  }

  const contentHash = computeContentHash(trimmed);

  try {
    const { result, model } = await callOpenAiContentReview({
      contextType: input.contextType,
      text: trimmed,
      quote: input.quote,
      source: input.source,
    });

    let moderationCaseId: string | undefined;

    if (result.status === "under_review") {
      const moderationCase = await createModerationCaseFromReview({
        requesterId: input.userId,
        text: trimmed,
        contentHash,
        issues: result.issues,
        debateId: input.debateId ?? input.contextId ?? null,
        roundId: input.roundId ?? null,
        argumentId: input.argumentId ?? null,
      });
      moderationCaseId = moderationCase.id;
    }

    const reviewId = await logContentReview({
      userId: input.userId,
      contextType: input.contextType,
      contextId: input.contextId,
      text: trimmed,
      contentHash,
      status: result.status,
      issues: result.issues,
      model,
      moderationCaseId: moderationCaseId ?? null,
    });

    if (moderationCaseId) {
      const sql = getSql();
      await sql`
        UPDATE moderation_cases
        SET content_review_id = ${reviewId}
        WHERE id = ${moderationCaseId}
      `;
    }

    return {
      ...result,
      review_id: reviewId,
      content_hash: contentHash,
      policy_version: CONTENT_POLICY_VERSION,
      moderation_case_id: moderationCaseId,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === "CONTENT_REVIEW_UNAVAILABLE") {
        await logContentReview({
          userId: input.userId,
          contextType: input.contextType,
          contextId: input.contextId,
          text: trimmed,
          contentHash,
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

export async function loadStoredReview(input: {
  reviewId: string;
  userId: string;
  text: string;
}): Promise<{
  id: string;
  status: ContentReviewStatus;
  content_hash: string;
  issues: ContentReviewIssue[];
  moderation_case_id: string | null;
}> {
  const sql = getSql();
  const trimmed = input.text.trim();
  const expectedHash = computeContentHash(trimmed);

  const [row] = await sql<
    {
      id: string;
      user_id: string;
      status: string;
      content_hash: string | null;
      issues: ContentReviewIssue[];
      moderation_case_id: string | null;
    }[]
  >`
    SELECT id, user_id, status::text, content_hash, issues, moderation_case_id
    FROM content_reviews
    WHERE id = ${input.reviewId}
    LIMIT 1
  `;

  if (!row || row.user_id !== input.userId) {
    throw new ApiError(422, "INVALID_REVIEW", "Érvénytelen ellenőrzési azonosító");
  }

  if (!row.content_hash || row.content_hash !== expectedHash) {
    throw new ApiError(
      422,
      "CONTENT_HASH_MISMATCH",
      "A szöveg módosult — újra ellenőrizni kell",
    );
  }

  if (row.status === "failed") {
    throw new ApiError(
      503,
      "CONTENT_REVIEW_UNAVAILABLE",
      "Az ellenőrzés most nem érhető el — próbáld később",
    );
  }

  return {
    id: row.id,
    status: row.status as ContentReviewStatus,
    content_hash: row.content_hash,
    issues: row.issues ?? [],
    moderation_case_id: row.moderation_case_id,
  };
}

const checkStoredReviewItemSchema = z.object({
  review_id: z.string().uuid(),
  text: z.string(),
  context_type: contentReviewContextSchema,
});

export const checkStoredReviewsBodySchema = z.object({
  reviews: z.array(checkStoredReviewItemSchema).min(1).max(10),
});

export async function checkStoredContentReviews(input: {
  userId: string;
  reviews: z.infer<typeof checkStoredReviewsBodySchema>["reviews"];
}): Promise<{
  reviews: Array<{
    review_id: string;
    context_type: ContentReviewContextType;
    status: ContentReviewStatus;
    issues: ContentReviewIssue[];
  }>;
  publishable: boolean;
  overall_status: ContentReviewStatus;
}> {
  const results = await Promise.all(
    input.reviews.map(async (item) => {
      const stored = await loadStoredReview({
        reviewId: item.review_id,
        userId: input.userId,
        text: item.text,
      });
      return {
        review_id: stored.id,
        context_type: item.context_type,
        status: stored.status,
        issues: stored.issues,
      };
    }),
  );

  const blocking = results.filter((review) => !isPublishableStatus(review.status));

  let overall_status: ContentReviewStatus;
  if (blocking.length === 0) {
    overall_status = results.some((review) => review.status === "advisory_language")
      ? "advisory_language"
      : "approved";
  } else if (blocking.some((review) => review.status === "under_review")) {
    overall_status = "under_review";
  } else {
    overall_status = "revision_required";
  }

  return {
    reviews: results,
    publishable: blocking.length === 0,
    overall_status,
  };
}

export function throwIfContentNotPublishable(result: ContentReviewResult): void {
  if (isPublishableStatus(result.status)) return;

  if (result.status === "revision_required") {
    throw new ApiError(
      422,
      "CONTENT_REVISION_REQUIRED",
      "A szöveg jelenleg nem tehető közzé.",
      { status: result.status, issues: result.issues },
    );
  }

  if (result.status === "under_review") {
    throw new ApiError(
      422,
      "CONTENT_UNDER_REVIEW",
      "A szöveg emberi felülvizsgálatot igényel. Addig nem jelenik meg nyilvánosan.",
      { status: result.status, issues: result.issues },
    );
  }

  throw new ApiError(
    422,
    "CONTENT_NOT_PUBLISHABLE",
    "A szöveg jelenleg nem tehető közzé.",
    { status: result.status, issues: result.issues },
  );
}

/** @deprecated use throwIfContentNotPublishable */
export function throwIfContentNotApproved(result: ContentReviewResult): void {
  throwIfContentNotPublishable(result);
}

export async function assertContentApprovedForPublication(input: {
  userId: string;
  contextType: ContentReviewContextType;
  contextId?: string | null;
  text: string;
  quote?: string;
  source?: string;
  contentReviewId?: string;
  debateId?: string | null;
  roundId?: string | null;
}): Promise<ContentReviewWithMeta> {
  const trimmed = input.text.trim();

  if (input.contentReviewId) {
    const stored = await loadStoredReview({
      reviewId: input.contentReviewId,
      userId: input.userId,
      text: trimmed,
    });
    throwIfContentNotPublishable({
      status: stored.status,
      issues: stored.issues,
    });
    return {
      status: stored.status,
      issues: stored.issues,
      review_id: stored.id,
      content_hash: stored.content_hash,
      policy_version: CONTENT_POLICY_VERSION,
      moderation_case_id: stored.moderation_case_id ?? undefined,
    };
  }

  const result = await reviewParticipantContent({
    userId: input.userId,
    contextType: input.contextType,
    contextId: input.contextId,
    text: trimmed,
    quote: input.quote,
    source: input.source,
    debateId: input.debateId,
    roundId: input.roundId,
  });

  throwIfContentNotPublishable(result);
  return result;
}

const spellCheckSuggestionSchema = z.object({
  original: z.string(),
  suggestion: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});

export type SpellCheckSuggestion = z.infer<typeof spellCheckSuggestionSchema>;

export async function spellCheckParticipantContent(input: {
  text: string;
}): Promise<{ suggestions: SpellCheckSuggestion[] }> {
  const trimmed = input.text.trim();
  if (!trimmed) {
    throw new ApiError(422, "VALIDATION_ERROR", "A szöveg nem lehet üres");
  }

  const { apiKey, model } = getOpenAiConfig();
  if (!apiKey) {
    throw new ApiError(
      503,
      "SPELL_CHECK_UNAVAILABLE",
      "A helyesírás-ellenőrzés most nem érhető el",
    );
  }

  const localSuggestions = detectMissingSpaceSuggestions(trimmed);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "winunio_spell_check",
          strict: true,
          schema: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    original: { type: "string" },
                    suggestion: { type: "string" },
                    start: { type: "integer" },
                    end: { type: "integer" },
                  },
                  required: ["original", "suggestion", "start", "end"],
                  additionalProperties: false,
                },
              },
            },
            required: ["suggestions"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "Csak helyesírási és központozási javításokat adj (elütés, ékezet, hiányzó szóköz, összeérő szavak). TILOS stílus, hangnem, mondatszerkezet vagy tartalmi módosítás.",
        },
        { role: "user", content: trimmed },
      ],
    }),
  });

  if (!res.ok) {
    throw new ApiError(
      503,
      "SPELL_CHECK_UNAVAILABLE",
      "A helyesírás-ellenőrzés most nem érhető el",
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) {
    throw new ApiError(
      503,
      "SPELL_CHECK_UNAVAILABLE",
      "A helyesírás-ellenőrzés most nem érhető el",
    );
  }

  const parsed = JSON.parse(raw) as { suggestions: SpellCheckSuggestion[] };
  const aiSuggestions = z
    .array(spellCheckSuggestionSchema)
    .parse(parsed.suggestions ?? []);

  return {
    suggestions: mergeSpellCheckSuggestions(localSuggestions, aiSuggestions),
  };
}

export function applySpellCheckSuggestions(
  text: string,
  suggestions: SpellCheckSuggestion[],
  acceptedIndices: number[],
): string {
  const accepted = new Set(acceptedIndices);
  const sorted = suggestions
    .map((s, index) => ({ ...s, index }))
    .filter((s) => accepted.has(s.index))
    .sort((a, b) => b.start - a.start);

  let result = text;
  for (const s of sorted) {
    result = result.slice(0, s.start) + s.suggestion + result.slice(s.end);
  }
  return result;
}
