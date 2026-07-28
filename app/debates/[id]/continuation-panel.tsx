"use client";

import Link from "next/link";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatHuPhoneDisplay, formatHuPhoneForApi } from "../../phone-hu";
import { PhoneInputHu } from "../../phone-input-hu";
import { TurnstileWidget } from "./turnstile-widget";

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
  viewer_has_passkey: boolean;
  viewer_phone_verified: boolean;
};

type Props = {
  initialStatus: ContinuationStatusView;
  viewerUserId: string | null;
  turnstileSiteKey: string;
  variant?: "card" | "bar";
};

type PendingSubmit = {
  challengeId: string;
  passkeyAssertion: unknown;
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
  turnstileSiteKey,
  variant = "card",
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [pendingSubmit, setPendingSubmit] = useState<PendingSubmit | null>(
    null,
  );
  const [phoneVerified, setPhoneVerified] = useState(
    initialStatus.viewer_phone_verified,
  );
  const [hasPasskey, setHasPasskey] = useState(initialStatus.viewer_has_passkey);
  const [phoneLocal, setPhoneLocal] = useState("");
  const [pendingPhoneE164, setPendingPhoneE164] = useState<string | null>(null);
  const [smsCode, setSmsCode] = useState("");
  const finalizingRef = useRef(false);

  const handleTurnstileToken = useCallback((token: string | null) => {
    setTurnstileToken(token);
  }, []);

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
      setSmsCode("");
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
    if (!/^\d{6}$/.test(smsCode)) {
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
          code: smsCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Telefon megerősítés sikertelen");
        return;
      }
      setPhoneVerified(true);
      setPendingPhoneE164(null);
      setSmsCode("");
      setInfo("Telefonszám megerősítve.");
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(null);
    }
  }

  function resetPhoneFlow() {
    setPendingPhoneE164(null);
    setSmsCode("");
    setError(null);
    setInfo(null);
  }

  async function registerPasskey() {
    if (!viewerUserId) return;
    setError(null);
    setLoading("passkey");
    try {
      const optionsRes = await fetch(
        "/api/v1/passkeys/register?action=options",
        { method: "POST" },
      );
      const options = await optionsRes.json();
      if (!optionsRes.ok) {
        setError(options.error?.message ?? "Passkey indítás sikertelen");
        return;
      }

      const attestation = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch(
        "/api/v1/passkeys/register?action=verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(attestation),
        },
      );
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setError(verifyData.error?.message ?? "Passkey regisztráció sikertelen");
        return;
      }
      setHasPasskey(true);
      setInfo("Biztonságos azonosítás (Passkey) beállítva.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Passkey regisztráció megszakadt",
      );
    } finally {
      setLoading(null);
    }
  }

  async function submitContinuation(
    challengeId: string,
    passkeyAssertion: unknown,
    token: string,
  ) {
    const res = await fetch(
      `/api/v1/rounds/${status.completed_round_id}/continuation-requests`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge_id: challengeId,
          turnstile_token: token,
          passkey_assertion: passkeyAssertion,
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
    setPendingSubmit(null);
    setTurnstileToken(null);
    setTurnstileReset((n) => n + 1);

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
    if (!turnstileToken) {
      setError("Előbb fejezd be a Turnstile ellenőrzést.");
      return;
    }

    setError(null);
    setInfo(null);
    setLoading("continuation");

    try {
      const challengeRes = await fetch(
        `/api/v1/rounds/${status.completed_round_id}/continuation-requests/challenge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ turnstile_token: turnstileToken }),
        },
      );
      const challengeData = await challengeRes.json();
      if (!challengeRes.ok) {
        setError(challengeData.error?.message ?? "Challenge sikertelen");
        return;
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

      const assertion = await startAuthentication({
        optionsJSON: challengeData.passkey_options,
      });

      setTurnstileToken(null);
      setTurnstileReset((n) => n + 1);
      setPendingSubmit({
        challengeId: challengeData.challenge_id,
        passkeyAssertion: assertion,
      });
      setInfo("Utolsó lépés: erősítsd meg újra a kérést (Turnstile).");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Folytatáskérés megszakadt",
      );
    } finally {
      setLoading(null);
    }
  }

  async function finalizePending() {
    if (!pendingSubmit || !turnstileToken) return;
    setError(null);
    setLoading("finalize");
    try {
      await submitContinuation(
        pendingSubmit.challengeId,
        pendingSubmit.passkeyAssertion,
        turnstileToken,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Véglegesítés sikertelen");
    } finally {
      setLoading(null);
    }
  }

  useEffect(() => {
    if (!pendingSubmit || !turnstileToken || finalizingRef.current) return;
    finalizingRef.current = true;
    void finalizePending().finally(() => {
      finalizingRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSubmit, turnstileToken]);

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
                  Első folytatáskérés előtt telefonszám megerősítés szükséges.
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
                        value={smsCode}
                        onChange={(e) =>
                          setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 6))
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
                        disabled={loading !== null || smsCode.length !== 6}
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

            {phoneVerified && !hasPasskey && (
              <div className="continuation-setup">
                <p className="hint">
                  Biztonságos azonosítás (Passkey) szükséges minden
                  folytatáskéréshez.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void registerPasskey()}
                  disabled={loading !== null}
                >
                  Passkey beállítása
                </button>
              </div>
            )}

            {phoneVerified && hasPasskey && !pendingSubmit && (
              <>
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  onToken={handleTurnstileToken}
                  resetKey={turnstileReset}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => void requestContinuation()}
                  disabled={loading !== null || !turnstileToken}
                >
                  KÉREM A FOLYTATÁST
                </button>
              </>
            )}

            {pendingSubmit && (
              <>
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  onToken={handleTurnstileToken}
                  resetKey={turnstileReset}
                />
                <p className="hint">Passkey ellenőrzés kész — Turnstile után véglegesítjük.</p>
              </>
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
