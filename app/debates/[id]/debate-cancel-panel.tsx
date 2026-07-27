"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  debateId: string;
};

export function DebateCancelPanel({ debateId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function cancelDebate() {
    if (
      !window.confirm(
        "Biztosan visszavonod a vitát? A nyitott jelentkezések lezárulnak.",
      )
    ) {
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/debates/${debateId}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Visszavonás sikertelen");
        return;
      }
      router.push("/vitaim");
      router.refresh();
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2 className="section-title">Vitaindítás visszavonása</h2>
      <p className="hint">
        A vita még nem indult el. Visszavonás után nem jelenik meg a nyilvános
        listában, és a nyitott jelentkezések lezárulnak.
      </p>
      <button
        type="button"
        className="btn btn-danger"
        disabled={loading}
        onClick={cancelDebate}
      >
        {loading ? "Visszavonás…" : "Vita visszavonása"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
