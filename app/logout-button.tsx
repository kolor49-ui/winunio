"use client";

import { useState } from "react";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        setError("Kijelentkezés sikertelen");
        return;
      }
      // Teljes oldal újratöltés — a router.refresh() nem mindig törli a sessiont
      window.location.href = "/";
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="nav-logout"
        onClick={logout}
        disabled={loading}
      >
        {loading ? "…" : "Kijelentkezés"}
      </button>
      {error && (
        <span className="nav-logout-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
