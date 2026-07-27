"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DebateEditor } from "../../debate-editor";
import { DebatePair, DebatePairSide } from "../debate-pair";

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
  const [loading, setLoading] = useState(false);

  async function submit(payload: {
    reasoning: string;
    quote: string | null;
    source: string | null;
    content_review_id?: string;
  }) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/debates/${debateId}/closing-statements`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
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
    const statementA = context.statements.find((s) => s.side === "A");
    const statementB = context.statements.find((s) => s.side === "B");

    return (
      <div className="card debate-section">
        <h2>Zárógondolatok</h2>
        <p className="hint">
          Mindkét vitázó benyújtotta — egyszerre jelentek meg.
        </p>
        <DebatePair>
          <DebatePairSide side="A" label="zárógondolat">
            {statementA ? <p>{statementA.content}</p> : null}
          </DebatePairSide>
          <DebatePairSide side="B" label="zárógondolat">
            {statementB ? <p>{statementB.content}</p> : null}
          </DebatePairSide>
        </DebatePair>
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
        <>
          <DebateEditor
            contextType="closing_statement"
            contextId={debateId}
            reasoningLabel="Saját zárógondolat"
            submitLabel="Zárógondolat beküldése"
            loading={loading}
            onSubmit={submit}
          />
          {error && <p className="error">{error}</p>}
        </>
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
