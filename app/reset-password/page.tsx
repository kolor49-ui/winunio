"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <>
        <h1>Új jelszó</h1>
        <p className="error">Hiányzó vagy érvénytelen link.</p>
        <p className="hint">
          <Link href="/forgot-password">Új visszaállító link kérése</Link>
        </p>
      </>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    const confirm = String(form.get("confirm"));
    if (password !== confirm) {
      setError("A két jelszó nem egyezik");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Visszaállítás sikertelen");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1>Új jelszó beállítása</h1>
      {done ? (
        <div className="card">
          <p>A jelszó frissítve. Átirányítás a bejelentkezéshez…</p>
        </div>
      ) : (
        <form className="form card" onSubmit={onSubmit}>
          <label>
            Új jelszó (min. 8 karakter)
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label>
            Új jelszó mégegyszer
            <input
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Mentés…" : "Jelszó mentése"}
          </button>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="hint">Betöltés…</p>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
