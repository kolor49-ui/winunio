"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ContentReviewFeedback,
  extractContentReviewIssues,
  type ContentReviewIssue,
} from "../../content-review-feedback";

export type ClosingStatementContext = {
  phase: "collecting" | "published";
  viewer_can_submit: boolean;
  viewer_submitted: boolean;
  viewer_statement?: string | null;
  waiting_for_partner?: boolean;
  statements?: Array<{
    side: string;
    content: string;
    published_at: string;
  }>;
};

type Props = {
  debateId: string;
  context: ClosingStatementContext;
};

export function ClosingStatementPanel({ debateId, context }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [reviewIssues, setReviewIssues] = useState<ContentReviewIssue[] | null>(
    null,
  );
  const [reviewBlocked, setReviewBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setReviewIssues(null);
    setReviewBlocked(false);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(
        `/api/v1/debates/${debateId}/closing-statements`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: form.get("content") }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        const issues = extractContentReviewIssues(data);
        if (issues) {
          setReviewIssues(issues);
          setReviewBlocked(data.error?.code === "CONTENT_BLOCKED");
        }
        setError(data.error?.message ?? "Beküldés sikertelen");
        return;
      }
      router.refresh();
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

  if (context.phase === "published" && context.statements) {
    return (
      <div className="card">
        <h2>Zárógondolatok</h2>
        <p className="hint">
          Mindkét vitázó benyújtotta — egyszerre jelentek meg.
        </p>
        {context.statements.map((statement) => (
          <div key={statement.side} className="round-side-block">
            <p>
              <span
                className={`side-badge ${statement.side === "A" ? "side-a" : "side-b"}`}
              >
                {statement.side}
              </span>{" "}
              zárógondolat
            </p>
            <p>{statement.content}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Zárógondolat</h2>
      <p className="hint">
        A vita zárásra vár. Mindkét vitázónak kötelező zárógondolatot írnia.
        A partner szövege beküldés közben nem látható.
      </p>

      {context.viewer_can_submit && (
        <form className="form" onSubmit={submit}>
          <label>
            Zárógondolatod
            <textarea name="content" required maxLength={2000} />
          </label>
          {reviewIssues && (
            <ContentReviewFeedback
              issues={reviewIssues}
              blocked={reviewBlocked}
            />
          )}
          {error && <p className="error">{error}</p>}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Küldés…" : "Zárógondolat beküldése"}
          </button>
        </form>
      )}

      {context.viewer_submitted && context.waiting_for_partner && (
        <p className="hint">Zárógondolatod rögzítve — várakozás a partnerére.</p>
      )}

      {!context.viewer_can_submit && !context.viewer_submitted && (
        <p className="hint">Csak a vitázók adhatnak le zárógondolatot.</p>
      )}
    </div>
  );
}
