"use client";

export type ContentReviewIssue = {
  excerpt: string;
  start: number;
  end: number;
  category: string;
  rule_reference: string;
  explanation: string;
};

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: {
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
    code !== "CONTENT_BLOCKED"
  ) {
    return null;
  }
  return data.error?.details?.issues ?? [];
}

export function ContentReviewFeedback({
  issues,
  blocked,
}: {
  issues: ContentReviewIssue[];
  blocked?: boolean;
}) {
  if (issues.length === 0) return null;

  return (
    <div
      className={`content-review-feedback ${blocked ? "content-review-blocked" : ""}`}
      role="alert"
    >
      <p className="content-review-title">
        {blocked
          ? "A szöveg nem tehető közzé."
          : "A szöveget javítani kell, mielőtt közzétehető."}
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
        Az AI nem fogalmaz helyetted — a javítást neked kell megtenned.
      </p>
    </div>
  );
}
