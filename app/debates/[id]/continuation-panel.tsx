"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type ContinuationStatusView = {
  completed_round_id: string;
  completed_round_number: number;
  request_count: number;
  required_requests: number | null;
  remaining_requests: number | null;
  viewer_already_requested: boolean;
  viewer_is_participant: boolean;
  viewer_can_request: boolean;
  viewer_block_reason: string | null;
  viewer_totp_enabled: boolean;
};

type Props = {
  initialStatus: ContinuationStatusView;
  viewerUserId: string | null;
  variant?: "card" | "bar";
};

function counterText(status: ContinuationStatusView): string {
  const count = status.request_count;
  if (status.required_requests == null) {
    return `${count} ember kéri a folytatást.`;
  }
  const remaining = status.remaining_requests ?? 0;
  if (remaining <= 0) {
    return `${count} ember kéri a folytatást.`;
  }
  return `${count} ember kéri a folytatást. Még ${remaining} kérés szükséges.`;
}

export function ContinuationPanel({
  initialStatus,
  viewerUserId,
  variant = "card",
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const totpEnabled = initialStatus.viewer_totp_enabled;
  const [pendingChallengeId, setPendingChallengeId] = useState<string | null>(
    null,
  );
  const [continuationCode, setContinuationCode] = useState("");

  function resetContinuationFlow() {
    setPendingChallengeId(null);
    setContinuationCode("");
  }

  async function submitContinuation(challengeId: string, totpCode: string) {
    const res = await fetch(
      `/api/v1/rounds/${status.completed_round_id}/continuation-requests`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge_id: challengeId,
          totp_code: totpCode,
        }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message ?? "Folytatáskérés sikertelen");
    }

    setStatus((prev) => ({
      ...prev,
      request_count: data.request_count ?? prev.request_count,
      remaining_requests:
        data.remaining_requests ?? prev.remaining_requests,
      viewer_already_requested: true,
      viewer_can_request: false,
    }));

    resetContinuationFlow();

    if (data.threshold_met) {
      setInfo("Küszöb teljesült — a vita folytatódik.");
    } else if (data.idempotent) {
      setInfo("Már leadtad a folytatáskérésed erre a fordulóra.");
    } else {
      setInfo("Folytatáskérésed rögzítve.");
    }

    router.refresh();
  }

  async function requestContinuation() {
    if (!viewerUserId) {
      setError("Előbb jelentkezz be.");
      return;
    }

    setError(null);
    setInfo(null);
    setLoading("continuation");

    try {
      const challengeRes = await fetch(
        `/api/v1/rounds/${status.completed_round_id}/continuation-requests/challenge`,
        { method: "POST" },
      );
      const challengeData = await challengeRes.json();
      if (!challengeRes.ok) {
        throw new Error(
          challengeData.error?.message ?? "Challenge indítás sikertelen",
        );
      }

      if (challengeData.already_requested) {
        setStatus((prev) => ({
          ...prev,
          viewer_already_requested: true,
          viewer_can_request: false,
        }));
        setInfo("Már leadtad a folytatáskérésed erre a fordulóra.");
        return;
      }

      setPendingChallengeId(challengeData.challenge_id);
      setContinuationCode("");
      setInfo("Írd be a Google Authenticator 6 jegyű kódját.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hálózati hiba");
    } finally {
      setLoading(null);
    }
  }

  async function confirmContinuation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pendingChallengeId) return;
    if (!/^\d{6}$/.test(continuationCode)) {
      setError("A kód 6 számjegy.");
      return;
    }
    setError(null);
    setLoading("continuation-confirm");
    try {
      await submitContinuation(pendingChallengeId, continuationCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Folytatáskérés sikertelen");
    } finally {
      setLoading(null);
    }
  }

  const rootClass =
    variant === "bar"
      ? "continuation-panel continuation-panel-bar"
      : "card continuation-panel";

  return (
    <div className={rootClass}>
      <p className="continuation-counter">{counterText(status)}</p>

      {status.viewer_is_participant && (
        <p className="hint">A vitázók nem kérhetnek folytatást.</p>
      )}

      {status.viewer_already_requested && (
        <p className="hint">Már leadtad a folytatáskérésed erre a fordulóra.</p>
      )}

      {!viewerUserId && !status.viewer_is_participant && (
        <p>
          <Link href="/login">Jelentkezz be</Link> a folytatáskéréshez.
        </p>
      )}

      {viewerUserId &&
        !status.viewer_is_participant &&
        !status.viewer_already_requested && (
          <>
            {!totpEnabled && (
              <div className="continuation-setup">
                <p className="hint">
                  Első folytatáskérés előtt egyszer be kell állítanod egy
                  authenticator appot (pl. Google Authenticator).
                </p>
                <Link href="/account#authenticator" className="btn btn-secondary">
                  Authenticator beállítása
                </Link>
              </div>
            )}

            {totpEnabled && !pendingChallengeId && (
              <button
                type="button"
                className="btn"
                onClick={() => void requestContinuation()}
                disabled={loading !== null}
              >
                {loading === "continuation"
                  ? "Indítás…"
                  : "KÉREM A FOLYTATÁST"}
              </button>
            )}

            {totpEnabled && pendingChallengeId && (
              <form onSubmit={confirmContinuation} className="form phone-verify-form">
                <label htmlFor="continuation-totp-code">
                  6 jegyű kód az authenticator appból
                  <input
                    id="continuation-totp-code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    maxLength={6}
                    placeholder="123456"
                    value={continuationCode}
                    onChange={(e) =>
                      setContinuationCode(
                        e.target.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                    required
                    disabled={loading !== null}
                    autoFocus
                  />
                </label>
                <div className="phone-verify-actions">
                  <button
                    type="submit"
                    className="btn"
                    disabled={loading !== null || continuationCode.length !== 6}
                  >
                    {loading === "continuation-confirm"
                      ? "Rögzítés…"
                      : "Folytatáskérés megerősítése"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={loading !== null}
                    onClick={() => {
                      resetContinuationFlow();
                      setInfo(null);
                      setError(null);
                    }}
                  >
                    Mégse
                  </button>
                </div>
              </form>
            )}

            {status.viewer_block_reason &&
              !totpEnabled &&
              !status.viewer_can_request && (
                <p className="hint">{status.viewer_block_reason}</p>
              )}
          </>
        )}

      {info && <p className="hint">{info}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
