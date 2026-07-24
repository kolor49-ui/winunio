"use client";

import { useState } from "react";

const REASONS = [
  { value: "illegal", label: "Jogellenes tartalom" },
  { value: "threat", label: "Fenyegetés" },
  { value: "pii", label: "Személyes adat" },
  { value: "harassment", label: "Zaklatás" },
  { value: "spam", label: "Spam" },
  { value: "abuse", label: "Visszaélés" },
] as const;

type Props = {
  debateId?: string;
  roundId?: string;
  argumentId?: string;
};

export function ReportButton({ debateId, roundId, argumentId }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>(
    "harassment",
  );
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitReport() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          note: note.trim() || undefined,
          debate_id: debateId,
          round_id: roundId,
          argument_id: argumentId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setError("Jelentéshez be kell jelentkezned.");
          return;
        }
        setError(data.error?.message ?? "Jelentés sikertelen");
        return;
      }
      setMessage("Köszönjük — a jelentésed rögzítve, moderátorok felülvizsgálják.");
      setOpen(false);
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="report-button-wrap">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen((v) => !v)}
      >
        Jelentés
      </button>
      {open && (
        <div className="card report-form">
          <label>
            Ok
            <select
              value={reason}
              onChange={(e) =>
                setReason(e.target.value as (typeof REASONS)[number]["value"])
              }
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Megjegyzés (opcionális)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={3}
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="btn"
              disabled={loading}
              onClick={submitReport}
            >
              {loading ? "Küldés…" : "Jelentés beküldése"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setOpen(false)}
            >
              Mégse
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      )}
      {message && <p className="hint">{message}</p>}
    </div>
  );
}
