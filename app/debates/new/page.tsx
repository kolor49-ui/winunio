"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  applyAcceptedSpellSuggestions,
  ContentReviewFeedback,
  extractContentReviewIssues,
  extractContentReviewStatus,
  requestSpellCheck,
  reviewTextBeforePublish,
  SpellCheckDiff,
  type ContentReviewIssue,
  type ContentReviewStatus,
  type SpellCheckSuggestion,
} from "../../content-review-feedback";

export default function NewDebatePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [reviewIssues, setReviewIssues] = useState<ContentReviewIssue[] | null>(
    null,
  );
  const [reviewStatus, setReviewStatus] = useState<ContentReviewStatus | null>(
    null,
  );
  const [pendingReviewId, setPendingReviewId] = useState<string | null>(null);
  const [stanceText, setStanceText] = useState("");
  const [spellSuggestions, setSpellSuggestions] = useState<
    SpellCheckSuggestion[] | null
  >(null);
  const [acceptedSpell, setAcceptedSpell] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [spellLoading, setSpellLoading] = useState(false);
  const [displayMode, setDisplayMode] = useState<"named" | "anonymous">("named");

  async function createDebate(
    form: HTMLFormElement,
    contentReviewId?: string,
    stanceOverride?: string,
  ) {
    const formData = new FormData(form);
    const res = await fetch("/api/v1/debates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: formData.get("question"),
        initiator_stance: stanceOverride ?? formData.get("initiator_stance"),
        category: formData.get("category"),
        display_mode: displayMode,
        display_name:
          displayMode === "named" ? formData.get("display_name") : undefined,
        content_review_id: contentReviewId,
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
        setReviewStatus(
          extractContentReviewStatus(
            data as Parameters<typeof extractContentReviewStatus>[0],
          ) ?? "revision_required",
        );
      }
      setError(data.error?.message ?? "Vitaindítás sikertelen");
      return;
    }
    if (!data.debate?.id) {
      setError("Váratlan szerverválasz");
      return;
    }
    router.push(`/debates/${data.debate.id}`);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setReviewIssues(null);
    setReviewStatus(null);
    setPendingReviewId(null);
    setSpellSuggestions(null);
    setLoading(true);
    const form = e.currentTarget;
    const stance = String(new FormData(form).get("initiator_stance") ?? "").trim();
    setStanceText(stance);

    try {
      const review = await reviewTextBeforePublish({
        text: stance,
        contextType: "initiator_stance",
      });

      if (review.status === "revision_required" || review.status === "under_review") {
        setReviewIssues(review.issues);
        setReviewStatus(review.status);
        setError(
          review.status === "under_review"
            ? "A szöveg emberi felülvizsgálatot igényel."
            : "A szöveg jelenleg nem tehető közzé.",
        );
        return;
      }

      if (review.status === "advisory_language") {
        setReviewIssues(review.issues);
        setReviewStatus("advisory_language");
        setPendingReviewId(review.review_id);
        return;
      }

      await createDebate(form, review.review_id, stance);
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

  async function continueWithoutSpellCheck(formId: string) {
    if (!pendingReviewId) return;
    setLoading(true);
    setError(null);
    try {
      const form = document.getElementById(formId) as HTMLFormElement;
      await createDebate(form, pendingReviewId, stanceText);
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

  async function runSpellCheck(formId: string) {
    setSpellLoading(true);
    setError(null);
    try {
      const suggestions = await requestSpellCheck(stanceText);
      setSpellSuggestions(suggestions);
      setAcceptedSpell(new Set(suggestions.map((_, i) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Helyesírás-ellenőrzés sikertelen");
    } finally {
      setSpellLoading(false);
    }
  }

  async function applySpellAndContinue(formId: string) {
    if (!spellSuggestions) return;
    const corrected = applyAcceptedSpellSuggestions(
      stanceText,
      spellSuggestions,
      acceptedSpell,
    );
    setStanceText(corrected);
    setLoading(true);
    setError(null);
    setReviewIssues(null);
    setReviewStatus(null);
    setPendingReviewId(null);
    setSpellSuggestions(null);

    try {
      const review = await reviewTextBeforePublish({
        text: corrected,
        contextType: "initiator_stance",
      });
      if (
        review.status === "revision_required" ||
        review.status === "under_review"
      ) {
        setReviewIssues(review.issues);
        setReviewStatus(review.status);
        setError("A javított szöveg továbbra sem tehető közzé.");
        return;
      }
      const form = document.getElementById(formId) as HTMLFormElement;
      await createDebate(form, review.review_id, corrected);
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
      <form id="new-debate-form" className="form card" onSubmit={onSubmit}>
        <label>
          Vitakérdés
          <input name="question" required maxLength={160} />
        </label>
        <label>
          Kiinduló álláspontod
          <textarea
            name="initiator_stance"
            required
            maxLength={2000}
            value={stanceText}
            onChange={(e) => {
              setStanceText(e.target.value);
              setPendingReviewId(null);
              setReviewStatus(null);
            }}
          />
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
        <p className="hint">
          Kijelentem, hogy a közzétett szöveg a saját megfogalmazásom, és
          felelősséget vállalok az állításaimért.
        </p>
        {reviewIssues && reviewStatus && (
          <ContentReviewFeedback issues={reviewIssues} status={reviewStatus} />
        )}
        {reviewStatus === "advisory_language" && pendingReviewId && (
          <div className="content-review-actions">
            {!spellSuggestions ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={spellLoading}
                  onClick={() => runSpellCheck("new-debate-form")}
                >
                  {spellLoading ? "Ellenőrzés…" : "Helyesírás ellenőrzése"}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={loading}
                  onClick={() => continueWithoutSpellCheck("new-debate-form")}
                >
                  Folytatás ellenőrzés nélkül
                </button>
              </>
            ) : (
              <>
                <SpellCheckDiff
                  text={stanceText}
                  suggestions={spellSuggestions}
                  accepted={acceptedSpell}
                  onToggle={(index) => {
                    setAcceptedSpell((prev) => {
                      const next = new Set(prev);
                      if (next.has(index)) next.delete(index);
                      else next.add(index);
                      return next;
                    });
                  }}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={loading}
                  onClick={() => applySpellAndContinue("new-debate-form")}
                >
                  Kijelölt javítások elfogadása és folytatás
                </button>
              </>
            )}
          </div>
        )}
        {error && <p className="error">{error}</p>}
        {!pendingReviewId && (
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Folyamatban…" : "Vita létrehozása"}
          </button>
        )}
      </form>
      <p className="hint">
        <span className="side-badge side-a">A</span> bal ·{" "}
        <span className="side-badge side-b">B</span> jobb — fix pozíciók.
      </p>
    </>
  );
}
