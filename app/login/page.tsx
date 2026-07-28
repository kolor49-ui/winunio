"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/";
  }
  return raw;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Bejelentkezés sikertelen");
        return;
      }
      window.location.href = nextPath;
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

  const registerHref =
    nextPath === "/"
      ? "/register"
      : `/register?next=${encodeURIComponent(nextPath)}`;

  return (
    <>
      <h1>Bejelentkezés</h1>
      <form className="form card" onSubmit={onSubmit}>
        <label>
          E-mail
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Jelszó
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Folyamatban…" : "Bejelentkezés"}
        </button>
      </form>
      <p className="hint">
        <Link href="/forgot-password">Elfelejtett jelszó</Link>
      </p>
      <p className="hint">
        Nincs fiókod? <Link href={registerHref}>Regisztráció</Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="hint">Betöltés…</p>}>
      <LoginForm />
    </Suspense>
  );
}
