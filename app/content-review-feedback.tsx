"use client";

import {
  formatIssueCategory,
  formatRuleReference,
} from "./review-labels";

export type ContentReviewIssue = {
  excerpt: string;
  start: number;
  end: number;
  category: string;
  rule_reference: string;
  explanation: string;
};

export type ContentReviewStatus =
  | "approved"
  | "advisory_language"
  | "revision_required"
  | "under_review";

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: {
      status?: ContentReviewStatus;
      issues?: ContentReviewIssue[];
    };
  };
};

export function extractContentReviewIssues(
  data: ApiErrorBody,
): ContentReviewIssue[] | null {
  const code = data.error?.code;
  if (
    code !== "CONTENT_REVISION_REQUIRED" &&
    code !== "CONTENT_BLOCKED" &&
    code !== "CONTENT_UNDER_REVIEW"
  ) {
    return null;
  }
  return data.error?.details?.issues ?? [];
}

export function extractContentReviewStatus(
  data: ApiErrorBody,
): ContentReviewStatus | null {
  return data.error?.details?.status ?? null;
}

export type FieldReviewBlock = {
  fieldLabel: string;
  status: ContentReviewStatus;
  issues: ContentReviewIssue[];
  reviewId: string;
};

export { formatIssueCategory, formatRuleReference };

function formatIssueMeta(issue: ContentReviewIssue): string {
  return [
    `Probléma: ${formatIssueCategory(issue.category)}`,
    formatRuleReference(issue.rule_reference),
    issue.explanation,
  ].join(" · ");
}

function IssueList({ issues }: { issues: ContentReviewIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="content-review-list">
      {issues.map((issue, index) => (
        <li key={`${issue.start}-${issue.end}-${index}`}>
          <p>
            <strong>„{issue.excerpt}”</strong>
          </p>
          <p className="meta">{formatIssueMeta(issue)}</p>
        </li>
      ))}
    </ul>
  );
}

export function MultiFieldContentReviewFeedback({
  fieldBlocks,
  overallStatus,
}: {
  fieldBlocks: FieldReviewBlock[];
  overallStatus: ContentReviewStatus;
}) {
  const resolvedStatus = overallStatus;

  return (
    <div
      className={`content-review-feedback ${
        resolvedStatus === "under_review"
          ? "content-review-under-review"
          : ""
      }`}
      role="alert"
    >
      <p className="content-review-title">
        {resolvedStatus === "under_review"
          ? "A szöveg emberi felülvizsgálatot igényel. Addig nem jelenik meg nyilvánosan."
          : "A szöveg jelenleg nem tehető közzé."}
      </p>
      {fieldBlocks.map((block) => (
        <div key={block.reviewId} className="content-review-field-block">
          <p className="meta">
            <strong>{block.fieldLabel}</strong>
          </p>
          <IssueList issues={block.issues} />
        </div>
      ))}
      <p className="hint">
        Az AI megjelöli a kifogásolt részt, de nem fogalmaz helyetted.
      </p>
    </div>
  );
}

export function ContentReviewFeedback({
  issues,
  status,
}: {
  issues: ContentReviewIssue[];
  status?: ContentReviewStatus | "blocked";
}) {
  const resolvedStatus =
    status === "blocked" ? "under_review" : status ?? "revision_required";

  if (resolvedStatus === "advisory_language") {
    return (
      <div className="content-review-feedback content-review-advisory" role="status">
        <p className="content-review-title">
          A szöveg nehezen érthető lehet. Kérsz helyesírás-ellenőrzést?
        </p>
        {issues.length > 0 && (
          <ul className="content-review-list">
            {issues.map((issue, index) => (
              <li key={`${issue.start}-${issue.end}-${index}`}>
                <p>
                  <strong>„{issue.excerpt}”</strong>
                </p>
                <p className="meta">{issue.explanation}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (resolvedStatus === "under_review") {
    return (
      <div
        className="content-review-feedback content-review-under-review"
        role="alert"
      >
        <p className="content-review-title">
          A szöveg emberi felülvizsgálatot igényel. Addig nem jelenik meg
          nyilvánosan.
        </p>
        {issues.length > 0 && (
          <ul className="content-review-list">
            {issues.map((issue, index) => (
              <li key={`${issue.start}-${issue.end}-${index}`}>
                <p>
                  <strong>„{issue.excerpt}”</strong>
                </p>
                <p className="meta">
                  {formatRuleReference(issue.rule_reference)} · {issue.explanation}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="content-review-feedback" role="alert">
      <p className="content-review-title">
        A szöveg jelenleg nem tehető közzé.
        {issues[0]?.category
          ? ` Probléma: ${formatIssueCategory(issues[0].category)}.`
          : ""}
      </p>
      <IssueList issues={issues} />
      <p className="hint">
        Az AI megjelöli a kifogásolt részt, de nem fogalmaz helyetted.
      </p>
    </div>
  );
}

export type SpellCheckSuggestion = {
  original: string;
  suggestion: string;
  start: number;
  end: number;
};

export function SpellCheckDiff({
  text,
  suggestions,
  accepted,
  onToggle,
}: {
  text: string;
  suggestions: SpellCheckSuggestion[];
  accepted: Set<number>;
  onToggle: (index: number) => void;
}) {
  if (suggestions.length === 0) {
    return <p className="hint">Nincs egyértelmű helyesírási javaslat.</p>;
  }

  return (
    <ul className="content-review-list">
      {suggestions.map((s, index) => (
        <li key={`${s.start}-${s.end}`}>
          <label>
            <input
              type="checkbox"
              checked={accepted.has(index)}
              onChange={() => onToggle(index)}
            />{" "}
            <span className="meta">„{s.original}”</span> →{" "}
            <strong>„{s.suggestion}”</strong>
          </label>
        </li>
      ))}
    </ul>
  );
}

export async function reviewTextBeforePublish(input: {
  text: string;
  contextType: string;
  contextId?: string;
}): Promise<{
  status: ContentReviewStatus;
  issues: ContentReviewIssue[];
  review_id: string;
  content_hash: string;
}> {
  const res = await fetch("/api/v1/content-reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context_type: input.contextType,
      context_id: input.contextId,
      text: input.text,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message ?? "Ellenőrzés sikertelen");
  }
  return data;
}

export async function requestHumanReview(input: {
  contentReviewIds: string[];
  note?: string;
}): Promise<{ message: string }> {
  const res = await fetch("/api/v1/content-reviews/request-human-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content_review_ids: input.contentReviewIds,
      note: input.note,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message ?? "Felülvizsgálat kérése sikertelen");
  }
  return data;
}

export type StoredReviewCheckResult = {
  reviews: Array<{
    review_id: string;
    context_type: string;
    status: ContentReviewStatus;
    issues: ContentReviewIssue[];
  }>;
  publishable: boolean;
  overall_status: ContentReviewStatus;
};

export async function checkStoredContentReviews(input: {
  reviews: Array<{
    review_id: string;
    text: string;
    context_type: string;
  }>;
}): Promise<StoredReviewCheckResult> {
  const res = await fetch("/api/v1/content-reviews/check-stored", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message ?? "Ellenőrzés sikertelen");
  }
  return data;
}

export const DEBATE_FIELD_LABELS: Record<string, string> = {
  debate_question: "Vitakérdés",
  initiator_stance: "Kiinduló álláspont",
};

export function fieldLabelForContext(contextType: string): string {
  return DEBATE_FIELD_LABELS[contextType] ?? contextType.replaceAll("_", " ");
}

export async function requestSpellCheck(text: string): Promise<SpellCheckSuggestion[]> {
  const res = await fetch("/api/v1/content-reviews/spell-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message ?? "Helyesírás-ellenőrzés sikertelen");
  }
  return data.suggestions ?? [];
}

export function applyAcceptedSpellSuggestions(
  text: string,
  suggestions: SpellCheckSuggestion[],
  accepted: Set<number>,
): string {
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
