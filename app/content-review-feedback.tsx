"use client";

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
                  {issue.rule_reference} — {issue.explanation}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (issues.length === 0) return null;

  return (
    <div className="content-review-feedback" role="alert">
      <p className="content-review-title">
        A szöveg jelenleg nem tehető közzé.
        {issues[0]?.category ? ` Probléma: ${issues[0].category}.` : ""}
      </p>
      <ul className="content-review-list">
        {issues.map((issue, index) => (
          <li key={`${issue.start}-${issue.end}-${index}`}>
            <p>
              <strong>„{issue.excerpt}”</strong>
            </p>
            <p className="meta">
              {issue.rule_reference} — {issue.explanation}
            </p>
          </li>
        ))}
      </ul>
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
