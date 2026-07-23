"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ContentReviewFeedback,
  extractContentReviewIssues,
  type ContentReviewIssue,
} from "../../content-review-feedback";

export default function NewDebatePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [reviewIssues, setReviewIssues] = useState<ContentReviewIssue[] | null>(
    null,
  );
  const [reviewBlocked, setReviewBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [displayMode, setDisplayMode] = useState<"named" | "anonymous">("named");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setReviewIssues(null);
    setReviewBlocked(false);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/v1/debates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: form.get("question"),
          initiator_stance: form.get("initiator_stance"),
          category: form.get("category"),
          display_mode: displayMode,
          display_name:
            displayMode === "named" ? form.get("display_name") : undefined,
        }),
      });
      const raw = await res.text();
      let data: {
        debate?: { id: string };
        error?: { message?: string; code?: string; details?: unknown };
      };
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        setError(
          res.ok
            ? "Váratlan szerverválasz"
            : `Szerver hiba (${res.status}) — próbáld újra később`,
        );
        return;
      }
      if (!res.ok) {
        if (res.status === 401) {
          setError("Előbb jelentkezz be.");
          return;
        }
        const issues = extractContentReviewIssues(
          data as Parameters<typeof extractContentReviewIssues>[0],
        );
        if (issues) {
          setReviewIssues(issues);
          setReviewBlocked(data.error?.code === "CONTENT_BLOCKED");
        }
        setError(data.error?.message ?? "Vitaindítás sikertelen");
        return;
      }
      if (!data.debate?.id) {
        setError("Váratlan szerverválasz");
        return;
      }
      router.push(`/debates/${data.debate.id}`);
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1>Vitát indítok</h1>
      <p className="hint">Max. 160 karakteres vitakérdés.</p>
      <form className="form card" onSubmit={onSubmit}>
        <label>
          Vitakérdés
          <input name="question" required maxLength={160} />
        </label>
        <label>
          Kiinduló álláspontod
          <textarea name="initiator_stance" required maxLength={2000} />
        </label>
        <label>
          Kategória
          <input name="category" required maxLength={80} placeholder="pl. tech" />
        </label>
        <label>
          Megjelenés
          <select
            value={displayMode}
            onChange={(e) =>
              setDisplayMode(e.target.value as "named" | "anonymous")
            }
          >
            <option value="named">Névvel</option>
            <option value="anonymous">Anonim</option>
          </select>
        </label>
        {displayMode === "named" && (
          <label>
            Megjelenített név
            <input name="display_name" required maxLength={80} />
          </label>
        )}
        {reviewIssues && (
          <ContentReviewFeedback
            issues={reviewIssues}
            blocked={reviewBlocked}
          />
        )}
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Folyamatban…" : "Vita létrehozása"}
        </button>
      </form>
      <p className="hint">
        <span className="side-badge side-a">A</span> bal ·{" "}
        <span className="side-badge side-b">B</span> jobb — fix pozíciók.
      </p>
    </>
  );
}
