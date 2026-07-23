"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const sent = searchParams.get("sent");
  const emailError = searchParams.get("error");
  const [productionSandbox, setProductionSandbox] = useState<boolean | null>(
    null,
  );
  const [status, setStatus] = useState<
    "idle" | "verifying" | "verified" | "error"
  >(token ? "verifying" : "idle");
  const [message, setMessage] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/health/readiness");
        const data = await res.json();
        if (cancelled) return;
        setProductionSandbox(
          Boolean(
            data.email_sandbox &&
              typeof data.app_url === "string" &&
              data.app_url.includes("winunio.com"),
          ),
        );
      } catch {
        if (!cancelled) setProductionSandbox(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          setMessage(data.error?.message ?? "Megerősítés sikertelen");
          return;
        }
        setStatus("verified");
        setMessage("Az e-mail címed megerősítve. Köszönjük!");
        router.refresh();
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Hálózati hiba");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  async function resend() {
    setResendLoading(true);
    setResendMessage(null);
    try {
      const res = await fetch("/api/v1/auth/resend-verification", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setResendMessage(data.error?.message ?? "Nem sikerült újraküldeni");
        return;
      }
      if (data.already_verified) {
        setResendMessage("Az e-mail címed már meg van erősítve.");
        setStatus("verified");
      } else {
        setResendMessage("Új megerősítő linket küldtünk.");
      }
    } catch {
      setResendMessage("Hálózati hiba");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <>
      <h1>E-mail megerősítés</h1>

      {sent === "1" && status === "idle" && (
        <div className="card">
          <p>
            Regisztráció sikeres. Küldtünk egy megerősítő linket az e-mail
            címedre.
          </p>
          <p className="hint">
            Nézd meg a bejövő leveleket (és a spam mappát is). A link 24 óráig
            érvényes.
          </p>
        </div>
      )}

      {sent === "0" && status === "idle" && (
        <div className="card">
          <p className="error">
            A fiók létrejött, de a megerősítő levelet nem sikerült elküldeni.
          </p>
          {emailError ? (
            <p className="hint">{emailError}</p>
          ) : productionSandbox ? (
            <p className="hint">
              Az éles oldalon még nincs beállítva a winunio.com e-mail domain a
              Resenden. Addig csak a Resend-fiók e-mail címére megy levél.
            </p>
          ) : (
            <p className="hint">
              Sandbox tesztnél a regisztrációs e-mail címed legyen ugyanaz,
              amivel a Resend fiókot regisztráltad.
            </p>
          )}
          <button
            className="btn"
            type="button"
            disabled={resendLoading}
            onClick={resend}
          >
            {resendLoading ? "Küldés…" : "Megerősítő link küldése"}
          </button>
          {resendMessage && <p className="hint">{resendMessage}</p>}
        </div>
      )}

      {status === "verifying" && <p className="hint">Megerősítés folyamatban…</p>}

      {status === "verified" && (
        <div className="card">
          <p>{message}</p>
          <p className="hint">
            <Link href="/debates/new">Vitát indítok</Link> ·{" "}
            <Link href="/">Főoldal</Link>
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="card">
          <p className="error">{message}</p>
          <p className="hint">
            Kérhetsz új linket, ha be vagy jelentkezve:
          </p>
          <button
            className="btn"
            type="button"
            disabled={resendLoading}
            onClick={resend}
          >
            {resendLoading ? "Küldés…" : "Új link küldése"}
          </button>
          {resendMessage && <p className="hint">{resendMessage}</p>}
        </div>
      )}

      {status === "idle" && !sent && (
        <div className="card">
          <p className="hint">
            Ha nem kaptál levelet, jelentkezz be, majd kérj új linket.
          </p>
          <button
            className="btn"
            type="button"
            disabled={resendLoading}
            onClick={resend}
          >
            {resendLoading ? "Küldés…" : "Megerősítő link újraküldése"}
          </button>
          {resendMessage && <p className="hint">{resendMessage}</p>}
          <p className="hint">
            <Link href="/login">Bejelentkezés</Link>
          </p>
        </div>
      )}
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<p className="hint">Betöltés…</p>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
