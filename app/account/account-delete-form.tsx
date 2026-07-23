"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AccountDeleteForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function onDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (confirmText !== "TÖRÖLÉM") {
      setError("Írd be pontosan: TÖRÖLÉM");
      return;
    }

    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/v1/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: form.get("password") }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Törlés sikertelen");
        return;
      }
      router.push("/?account_deleted=1");
      router.refresh();
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2 style={{ fontSize: "1.1rem", marginBottom: 8 }}>
          Fiók végleges törlése
        </h2>
        <p className="hint" style={{ lineHeight: 1.55 }}>
          A személyes adataid (e-mail, jelszó, profilnév) törlődnek. A már
          publikált vitáid szövege megmarad, de a neved helyett „Törölt fiók”
          jelenik meg. A még el nem indult vitáid visszavonásra kerülnek.
        </p>
        <p className="hint">
          Ugyanazzal az e-mail címmel később újra regisztrálhatsz.
        </p>

        <form className="form" onSubmit={onDelete} style={{ marginTop: 16 }}>
          <label>
            Jelszó megerősítése
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          <label>
            Írd be: TÖRÖLÉM
            <input
              name="confirm"
              type="text"
              required
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-danger" type="submit" disabled={loading}>
            {loading ? "Törlés…" : "Fiók végleges törlése"}
          </button>
        </form>
      </div>

      <p className="hint">
        <Link href="/">Vissza a főoldalra</Link>
      </p>
    </>
  );
}
