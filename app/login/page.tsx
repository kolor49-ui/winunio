"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
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
      router.push("/");
      router.refresh();
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

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
        Nincs fiókod? <Link href="/register">Regisztráció</Link>
      </p>
    </>
  );
}
