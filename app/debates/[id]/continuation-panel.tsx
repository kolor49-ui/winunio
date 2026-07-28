"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatHuPhoneDisplay, formatHuPhoneForApi } from "../../phone-hu";
import { PhoneInputHu } from "../../phone-input-hu";

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
  viewer_phone_verified: boolean;
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
  const [phoneVerified, setPhoneVerified] = useState(
    initialStatus.viewer_phone_verified,
  );
  const [phoneLocal, setPhoneLocal] = useState("");
  const [pendingPhoneE164, setPendingPhoneE164] = useState<string | null>(null);
  const [phoneSetupCode, setPhoneSetupCode] = useState("");
  const [pendingChallengeId, setPendingChallengeId] = useState<string | null>(null);
  const [continuationCode, setContinuationCode] = useState("");

  async function startPhone(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!viewerUserId) return;
    setError(null);
    setLoading("phone-start");
    let phone: string;
    try {
      phone = formatHuPhoneForApi(phoneLocal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Érvénytelen telefonszám");
      setLoading(null);
      return;
    }
    try {
      const res = await fetch("/api/v1/phone/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "SMS indítás sikertelen");
        return;
      }
      setPendingPhoneE164(data.phone_e164 ?? phone);
      setPhoneSetupCode("");
      setInfo(
        data.delivery === "sms"
          ? `SMS elküldve: ${formatHuPhoneDisplay(data.phone_e164 ?? phone)}`
          : data.dev_code
            ? `Fejlesztői kód: ${data.dev_code}`
            : (data.message ?? "Ellenőrző kódot küldtünk."),
      );
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(null);
    }
  }

  async function confirmPhone(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!viewerUserId || !pendingPhoneE164) return;
    if (!/^\d{6}$/.test(phoneSetupCode)) {
      setError("A kód 6 számjegy.");
      return;
    }
    setError(null);
    setLoading("phone-confirm");
    try {
      const res = await fetch("/api/v1/phone/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: pendingPhoneE164,
          code: phoneSetupCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Telefon megerősítés sikertelen");
        return;
      }
      setPhoneVerified(true);
      setPendingPhoneE164(null);
      setPhoneSetupCode("");
      setInfo("Telefonszám megerősítve.");
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(null);
    }
  }

  function resetPhoneFlow() {
    setPendingPhoneE164(null);
    setPhoneSetupCode("");
    setError(null);
    setInfo(null);
  }

  function resetContinuationFlow() {
    setPendingChallengeId(null);
    setContinuationCode("");
  }

  async function submitContinuation(challengeId: string, smsCode: string) {
    const res = await fetch(
      `/api/v1/rounds/${status.completed_round_id}/continuation-requests`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge_id: challengeId,
          sms_code: smsCode,
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
        throw new Error(challengeData.error?.message ?? "SMS indítás sikertelen");
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
      setInfo(
        challengeData.delivery === "sms"
          ? `SMS kódot küldtünk ide: ${challengeData.phone_masked ?? "a regisztrált számodra"}.`
          : challengeData.dev_code
            ? `Fejlesztői kód: ${challengeData.dev_code}`
            : "Írd be az SMS-ben kapott 6 jegyű kódot.",
      );
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
            {!phoneVerified && (
              <div className="continuation-setup">
                <p className="hint">
                  Első folytatáskérés előtt telefonszám megerősítés szükséges (egyszeri).
                </p>

                {!pendingPhoneE164 ? (
                  <form onSubmit={startPhone} className="form phone-verify-form">
                    <label htmlFor="continuation-phone-local">
                      Telefonszám
                      <PhoneInputHu
                        id="continuation-phone-local"
                        value={phoneLocal}
                        onChange={setPhoneLocal}
                        disabled={loading !== null}
                      />
                    </label>
                    <button
                      type="submit"
                      className="btn btn-secondary"
                      disabled={loading !== null || phoneLocal.replace(/\D/g, "").length < 9}
                    >
                      {loading === "phone-start" ? "Küldés…" : "Kód küldése SMS-ben"}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={confirmPhone} className="form phone-verify-form">
                    <p className="hint phone-verify-sent">
                      Kódot küldtünk ide:{" "}
                      <strong>{formatHuPhoneDisplay(pendingPhoneE164)}</strong>
                    </p>
                    <label htmlFor="continuation-phone-setup-code">
                      6 jegyű SMS kód
                      <input
                        id="continuation-phone-setup-code"
                        name="code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="\d{6}"
                        maxLength={6}
                        placeholder="123456"
                        value={phoneSetupCode}
                        onChange={(e) =>
                          setPhoneSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                        required
                        disabled={loading !== null}
                        autoFocus
                      />
                    </label>
                    <div className="phone-verify-actions">
                      <button
                        type="submit"
                        className="btn btn-secondary"
                        disabled={loading !== null || phoneSetupCode.length !== 6}
                      >
                        {loading === "phone-confirm"
                          ? "Ellenőrzés…"
                          : "Telefon megerősítése"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={loading !== null}
                        onClick={resetPhoneFlow}
                      >
                        Másik szám
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {phoneVerified && !pendingChallengeId && (
              <button
                type="button"
                className="btn"
                onClick={() => void requestContinuation()}
                disabled={loading !== null}
              >
                {loading === "continuation" ? "SMS küldése…" : "KÉREM A FOLYTATÁST"}
              </button>
            )}

            {phoneVerified && pendingChallengeId && (
              <form onSubmit={confirmContinuation} className="form phone-verify-form">
                <label htmlFor="continuation-sms-code">
                  6 jegyű SMS kód
                  <input
                    id="continuation-sms-code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    maxLength={6}
                    placeholder="123456"
                    value={continuationCode}
                    onChange={(e) =>
                      setContinuationCode(e.target.value.replace(/\D/g, "").slice(0, 6))
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
                    Új SMS
                  </button>
                </div>
              </form>
            )}

            {status.viewer_block_reason &&
              !phoneVerified &&
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
