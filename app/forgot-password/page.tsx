"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email") }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Kérés sikertelen");
        return;
      }
      setDone(true);
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1>Elfelejtett jelszó</h1>
      {done ? (
        <div className="card">
          <p>
            Ha ez az e-mail cím regisztrálva van, küldtünk visszaállító linket.
          </p>
          <p className="hint">
            <Link href="/login">Vissza a bejelentkezéshez</Link>
          </p>
        </div>
      ) : (
        <>
          <p className="hint">
            Add meg az e-mail címed — küldünk egy linket az új jelszó
            beállításához.
          </p>
          <form className="form card" onSubmit={onSubmit}>
            <label>
              E-mail
              <input name="email" type="email" required autoComplete="email" />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn" type="submit" disabled={loading}>
              {loading ? "Küldés…" : "Link küldése"}
            </button>
          </form>
          <p className="hint">
            <Link href="/login">Bejelentkezés</Link>
          </p>
        </>
      )}
    </>
  );
}
