"use client";

import { useState } from "react";

type Props = {
  initialEnabled: boolean;
};

type SetupState = {
  qrCodeDataUrl: string;
  manualSecret: string;
} | null;

export function TotpSetupPanel({ initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setup, setSetup] = useState<SetupState>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function startSetup() {
    setError(null);
    setInfo(null);
    setLoading("setup");
    try {
      const res = await fetch("/api/v1/auth/totp/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Beállítás indítása sikertelen");
        return;
      }
      setSetup({
        qrCodeDataUrl: data.qr_code_data_url,
        manualSecret: data.manual_secret,
      });
      setCode("");
      setInfo(
        "Olvasd be a QR-kódot a Google Authenticatorral (vagy add meg kézzel a kulcsot), majd írd be az app 6 jegyű kódját.",
      );
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(null);
    }
  }

  async function confirmSetup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("A kód 6 számjegy.");
      return;
    }
    setError(null);
    setLoading("confirm");
    try {
      const res = await fetch("/api/v1/auth/totp/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Megerősítés sikertelen");
        return;
      }
      setEnabled(true);
      setSetup(null);
      setCode("");
      setInfo("Authenticator app beállítva. Most már kérhetsz folytatást.");
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(null);
    }
  }

  if (enabled) {
    return (
      <div id="authenticator">
        <p className="hint">
          Az authenticator app be van állítva. Minden folytatáskérésnél a Google
          Authenticator (vagy más TOTP app) 6 jegyű kódját kell megadnod.
        </p>
      </div>
    );
  }

  return (
    <div id="authenticator">
      <p className="hint">
        A folytatáskéréshez egyszer be kell állítanod egy authenticator appot
        (pl. Google Authenticator). Ez ingyenes, SMS nem kell.
      </p>

      {!setup ? (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void startSetup()}
          disabled={loading !== null}
        >
          {loading === "setup" ? "Indítás…" : "Authenticator beállítása"}
        </button>
      ) : (
        <form onSubmit={confirmSetup} className="form">
          <div className="totp-setup-qr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={setup.qrCodeDataUrl}
              alt="QR-kód az authenticator apphoz"
              width={220}
              height={220}
            />
          </div>
          <p className="hint">
            Kézi kulcs: <code>{setup.manualSecret}</code>
          </p>
          <label htmlFor="totp-setup-code">
            6 jegyű kód az appból
            <input
              id="totp-setup-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
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
              disabled={loading !== null || code.length !== 6}
            >
              {loading === "confirm" ? "Ellenőrzés…" : "Beállítás megerősítése"}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={loading !== null}
              onClick={() => {
                setSetup(null);
                setCode("");
                setError(null);
                setInfo(null);
              }}
            >
              Mégse
            </button>
          </div>
        </form>
      )}

      {info && <p className="hint">{info}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
