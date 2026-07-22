"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
      router.refresh();
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="nav-logout"
      onClick={logout}
      disabled={loading}
    >
      {loading ? "…" : "Kijelentkezés"}
    </button>
  );
}
