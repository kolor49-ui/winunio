"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ActiveRound = {
  id: string;
  round_number: number;
  deadline_at: string;
  my_submission: { content: string; submitted_at: string } | null;
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
  activeRound: ActiveRound | null;
  publishedRounds: PublishedRound[];
};

export function DebateRoundPanel({
  debateStatus,
  participantSide,
  activeRound,
  publishedRounds,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
            <div key={side.side} className="round-side-block">
              <p>
                <span
                  className={`side-badge ${side.side === "A" ? "side-a" : "side-b"}`}
                >
                  {side.side}
                </span>
              </p>
              <p>{side.content}</p>
            </div>
          ))}
        </div>
      ))}

      {debateStatus === "active" && activeRound && participantSide && (
        <div className="card">
          <h2>{activeRound.round_number}. forduló — válaszod</h2>
          <p className="meta">
            Határidő:{" "}
            {new Date(activeRound.deadline_at).toLocaleString("hu-HU")}
          </p>
          <p className="hint">
            Zárolt forduló: a másik fél válasza csak lezáráskor jelenik meg.
          </p>

          {activeRound.my_submission ? (
            <>
              <p>
                <span
                  className={`side-badge ${participantSide === "A" ? "side-a" : "side-b"}`}
                >
                  {participantSide}
                </span>{" "}
                beküldve
              </p>
              <p>{activeRound.my_submission.content}</p>
              <p className="hint">Várakozás a másik fél válaszára…</p>
            </>
          ) : (
            <form className="form" onSubmit={submit}>
              <label>
                Válaszod ({participantSide} oldal)
                <textarea name="content" required maxLength={2000} />
              </label>
              {error && <p className="error">{error}</p>}
              <button className="btn" type="submit" disabled={loading}>
                {loading ? "Küldés…" : "Válasz beküldése"}
              </button>
            </form>
          )}
        </div>
      )}

      {debateStatus === "active" && activeRound && !participantSide && (
        <div className="card">
          <p className="hint">
            Aktív forduló folyamatban — csak a vitázók küldhetnek választ.
          </p>
        </div>
      )}
    </>
  );
}
