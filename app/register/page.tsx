"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Readiness = {
  ready: boolean;
  email_sandbox?: boolean;
  issues?: string[];
  sandbox?: string | null;
};

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [readiness, setReadiness] = useState<Readiness | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/health/readiness");
        const data = (await res.json()) as Readiness;
        if (!cancelled) setReadiness(data);
      } catch {
        if (!cancelled) setReadiness(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
          display_name: form.get("display_name") || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Regisztráció sikertelen");
        return;
      }
      const params = new URLSearchParams({
        sent: data.verification_email_sent ? "1" : "0",
      });
      if (data.email_error) {
        params.set("error", data.email_error);
      }
      router.push(`/verify-email?${params.toString()}`);
      router.refresh();
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1>Regisztráció</h1>
      <p className="hint">Vitázóknak: e-mail + jelszó (MVP).</p>

      {readiness && !readiness.ready && (
        <div className="card">
          <p className="error">A regisztráció ideiglenesen nem elérhető.</p>
          {readiness.sandbox && <p className="hint">{readiness.sandbox}</p>}
          {readiness.issues?.map((issue) => (
            <p key={issue} className="hint">
              {issue}
            </p>
          ))}
        </div>
      )}

      <form className="form card" onSubmit={onSubmit}>
        <label>
          E-mail
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Jelszó (min. 8 karakter)
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <label>
          Megjelenített név (opcionális)
          <input name="display_name" type="text" maxLength={80} />
        </label>
        {error && <p className="error">{error}</p>}
        <button
          className="btn"
          type="submit"
          disabled={loading || readiness?.ready === false}
        >
          {loading ? "Folyamatban…" : "Regisztráció"}
        </button>
      </form>
      <p className="hint">
        Van már fiókod? <Link href="/login">Bejelentkezés</Link>
      </p>
    </>
  );
}
