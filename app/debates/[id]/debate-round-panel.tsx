"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DebatePair, DebatePairSide } from "../debate-pair";
import {
  ContentReviewFeedback,
  extractContentReviewIssues,
  extractContentReviewStatus,
  type ContentReviewIssue,
  type ContentReviewStatus,
} from "../../content-review-feedback";
import { ReportButton } from "../../report-button";

type ActiveRound = {
  id: string;
  round_number: number;
  deadline_at: string;
  phase: "awaiting_a" | "awaiting_b";
  published_sides: Array<{
    side: string;
    content: string;
    is_system_placeholder: boolean;
    published_at: string;
    argument_id: string;
  }>;
  my_submission: {
    content: string;
    submitted_at: string;
    published_at: string | null;
  } | null;
  can_submit: boolean;
};

type PublishedRound = {
  round_number: number;
  published_at: string;
  sides: Array<{
    side: string;
    content: string;
    is_system_placeholder: boolean;
    argument_id: string;
  }>;
};

type Props = {
  debateId: string;
  debateStatus: string;
  participantSide: string | null;
  activeRound: ActiveRound | null;
  publishedRounds: PublishedRound[];
};

function ArgumentContent({
  content,
  argumentId,
  debateId,
}: {
  content: string;
  argumentId?: string;
  debateId: string;
}) {
  return (
    <>
      <p>{content}</p>
      {!content.startsWith("[Eltávolítva") && argumentId && (
        <ReportButton debateId={debateId} argumentId={argumentId} />
      )}
    </>
  );
}

function SubmitForm({
  participantSide,
  activeRound,
  reviewIssues,
  reviewStatus,
  error,
  loading,
  onSubmit,
}: {
  participantSide: string;
  activeRound: ActiveRound;
  reviewIssues: ContentReviewIssue[] | null;
  reviewStatus: ContentReviewStatus | null;
  error: string | null;
  loading: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="form debate-pair-form" onSubmit={onSubmit}>
      <label>
        {participantSide === "A"
          ? "Megszólalásod (A oldal)"
          : "Válaszod B oldalról"}
        <textarea name="content" required maxLength={2000} />
      </label>
      {reviewIssues && reviewStatus && (
        <ContentReviewFeedback issues={reviewIssues} status={reviewStatus} />
      )}
      {error && <p className="error">{error}</p>}
      <button className="btn" type="submit" disabled={loading}>
        {loading ? "Küldés…" : "Beküldés"}
      </button>
    </form>
  );
}

function PublishedRoundCard({
  round,
  debateId,
}: {
  round: PublishedRound;
  debateId: string;
}) {
  const sideA = round.sides.find((s) => s.side === "A");
  const sideB = round.sides.find((s) => s.side === "B");

  return (
    <div className="card debate-round-card">
      <h2>{round.round_number}. forduló</h2>
      <p className="meta">
        Publikálva: {new Date(round.published_at).toLocaleString("hu-HU")}
      </p>
      <DebatePair>
        <DebatePairSide side="A" label="megszólalás">
          {sideA ? (
            <ArgumentContent
              content={sideA.content}
              argumentId={sideA.argument_id}
              debateId={debateId}
            />
          ) : (
            <p className="hint">Nincs A tartalom.</p>
          )}
        </DebatePairSide>
        <DebatePairSide side="B" label="válasz">
          {sideB ? (
            <ArgumentContent
              content={sideB.content}
              argumentId={sideB.argument_id}
              debateId={debateId}
            />
          ) : (
            <p className="hint">Nincs B tartalom.</p>
          )}
        </DebatePairSide>
      </DebatePair>
    </div>
  );
}

function ActiveRoundCard({
  debateId,
  participantSide,
  activeRound,
  reviewIssues,
  reviewStatus,
  error,
  loading,
  onSubmit,
}: {
  debateId: string;
  participantSide: string | null;
  activeRound: ActiveRound;
  reviewIssues: ContentReviewIssue[] | null;
  reviewStatus: ContentReviewStatus | null;
  error: string | null;
  loading: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const publishedA = activeRound.published_sides.find((s) => s.side === "A");
  const publishedB = activeRound.published_sides.find((s) => s.side === "B");

  const aPlaceholder =
    activeRound.phase === "awaiting_a" && !publishedA
      ? participantSide === "B"
        ? "Várakozás A megszólalására…"
        : "A vitázók között folyik a forduló."
      : undefined;

  const bPlaceholder =
    activeRound.phase === "awaiting_b" && !publishedB
      ? "B válaszára várunk."
      : activeRound.phase === "awaiting_a"
        ? "Várakozás A megszólalására…"
        : undefined;

  return (
    <div className="card debate-round-card">
      <h2>{activeRound.round_number}. forduló</h2>
      <p className="meta">
        Határidő: {new Date(activeRound.deadline_at).toLocaleString("hu-HU")}
      </p>
      <DebatePair>
        <DebatePairSide
          side="A"
          label="megszólalás"
          placeholder={aPlaceholder}
        >
          {publishedA ? (
            <ArgumentContent
              content={publishedA.content}
              argumentId={publishedA.argument_id}
              debateId={debateId}
            />
          ) : participantSide === "A" && activeRound.can_submit ? (
            <SubmitForm
              participantSide={participantSide}
              activeRound={activeRound}
              reviewIssues={reviewIssues}
              reviewStatus={reviewStatus}
              error={error}
              loading={loading}
              onSubmit={onSubmit}
            />
          ) : participantSide === "A" &&
            activeRound.my_submission &&
            activeRound.phase === "awaiting_b" ? (
            <p className="hint">Megszólalásod megjelent — B válaszára várunk.</p>
          ) : null}
        </DebatePairSide>
        <DebatePairSide
          side="B"
          label="válasz"
          placeholder={bPlaceholder}
        >
          {publishedB ? (
            <ArgumentContent
              content={publishedB.content}
              argumentId={publishedB.argument_id}
              debateId={debateId}
            />
          ) : participantSide === "B" && activeRound.can_submit ? (
            <SubmitForm
              participantSide={participantSide}
              activeRound={activeRound}
              reviewIssues={reviewIssues}
              reviewStatus={reviewStatus}
              error={error}
              loading={loading}
              onSubmit={onSubmit}
            />
          ) : null}
        </DebatePairSide>
      </DebatePair>
      {error && !activeRound.can_submit && <p className="error">{error}</p>}
    </div>
  );
}

export function DebateRoundPanel({
  debateId,
  debateStatus,
  participantSide,
  activeRound,
  publishedRounds,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [reviewIssues, setReviewIssues] = useState<ContentReviewIssue[] | null>(
    null,
  );
  const [reviewStatus, setReviewStatus] = useState<ContentReviewStatus | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeRound) return;
    setError(null);
    setReviewIssues(null);
    setReviewStatus(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/v1/rounds/${activeRound.id}/arguments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: form.get("content") }),
      });
      const data = await res.json();
      if (!res.ok) {
        const issues = extractContentReviewIssues(data);
        if (issues) {
          setReviewIssues(issues);
          setReviewStatus(
            extractContentReviewStatus(data) ?? "revision_required",
          );
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

  return (
    <>
      {publishedRounds.map((round) => (
        <PublishedRoundCard
          key={round.round_number}
          round={round}
          debateId={debateId}
        />
      ))}

      {debateStatus === "active" && activeRound && (
        <ActiveRoundCard
          debateId={debateId}
          participantSide={participantSide}
          activeRound={activeRound}
          reviewIssues={reviewIssues}
          reviewStatus={reviewStatus}
          error={error}
          loading={loading}
          onSubmit={submit}
        />
      )}
    </>
  );
}
