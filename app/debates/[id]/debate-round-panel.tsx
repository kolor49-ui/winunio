"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
  }>;
};

type Props = {
  debateStatus: string;
  participantSide: string | null;
  viewerUserId: string | null;
  activeRound: ActiveRound | null;
  publishedRounds: PublishedRound[];
};

function SideBlock({
  side,
  content,
}: {
  side: string;
  content: string;
}) {
  return (
    <div className="round-side-block">
      <p>
        <span
          className={`side-badge ${side === "A" ? "side-a" : "side-b"}`}
        >
          {side}
        </span>
      </p>
      <p>{content}</p>
    </div>
  );
}

export function DebateRoundPanel({
  debateStatus,
  participantSide,
  viewerUserId,
  activeRound,
  publishedRounds,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyInfo, setNotifyInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeRound) return;
    setError(null);
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

  async function requestBNotification() {
    if (!activeRound || !viewerUserId) return;
    setNotifyLoading(true);
    setNotifyInfo(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/rounds/${activeRound.id}/response-notifications`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Értesítés kérése sikertelen");
        return;
      }
      setNotifyInfo("Értesítünk, amikor B válasza megjelenik.");
    } catch {
      setError("Hálózati hiba");
    } finally {
      setNotifyLoading(false);
    }
  }

  return (
    <>
      {publishedRounds.map((round) => (
        <div key={round.round_number} className="card">
          <h2>{round.round_number}. forduló</h2>
          <p className="meta">
            Publikálva:{" "}
            {new Date(round.published_at).toLocaleString("hu-HU")}
          </p>
          {round.sides.map((side) => (
            <SideBlock
              key={side.side}
              side={side.side}
              content={side.content}
            />
          ))}
        </div>
      ))}

      {debateStatus === "active" && activeRound && (
        <div className="card">
          <h2>{activeRound.round_number}. forduló</h2>
          <p className="meta">
            Határidő:{" "}
            {new Date(activeRound.deadline_at).toLocaleString("hu-HU")}
          </p>

          {activeRound.published_sides.map((side) => (
            <SideBlock key={side.side} side={side.side} content={side.content} />
          ))}

          {activeRound.phase === "awaiting_b" && (
            <p className="hint">B válaszára várunk.</p>
          )}

          {participantSide && activeRound.can_submit && (
            <form className="form" onSubmit={submit}>
              <label>
                {participantSide === "A"
                  ? "Megszólalásod (A oldal)"
                  : "Válaszod B oldalról"}
                <textarea name="content" required maxLength={2000} />
              </label>
              {error && <p className="error">{error}</p>}
              <button className="btn" type="submit" disabled={loading}>
                {loading ? "Küldés…" : "Beküldés"}
              </button>
            </form>
          )}

          {participantSide &&
            activeRound.my_submission &&
            activeRound.phase === "awaiting_b" &&
            participantSide === "A" && (
              <p className="hint">Megszólalásod megjelent — B válaszára várunk.</p>
            )}

          {participantSide &&
            activeRound.my_submission &&
            !activeRound.can_submit &&
            participantSide === "B" &&
            activeRound.phase === "awaiting_a" && (
              <p className="hint">Várakozás A megszólalására…</p>
            )}

          {!participantSide && activeRound.phase === "awaiting_b" && (
            <>
              <p className="hint">
                A megszólalás megjelent — B válaszára várunk.
              </p>
              {viewerUserId ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={notifyLoading}
                  onClick={() => void requestBNotification()}
                >
                  {notifyLoading
                    ? "Kérés…"
                    : "Értesítést kérek B válaszáról"}
                </button>
              ) : (
                <p className="hint">
                  <a href="/login">Jelentkezz be</a> az értesítés kéréséhez.
                </p>
              )}
              {notifyInfo && <p className="hint">{notifyInfo}</p>}
            </>
          )}

          {!participantSide && activeRound.phase === "awaiting_a" && (
            <p className="hint">A vitázók között folyik a forduló.</p>
          )}

          {error && !activeRound.can_submit && (
            <p className="error">{error}</p>
          )}
        </div>
      )}
    </>
  );
}
