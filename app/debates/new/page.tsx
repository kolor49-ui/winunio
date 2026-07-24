"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  applyAcceptedSpellSuggestions,
  ContentReviewFeedback,
  extractContentReviewIssues,
  extractContentReviewStatus,
  MultiFieldContentReviewFeedback,
  requestHumanReview,
  requestSpellCheck,
  reviewTextBeforePublish,
  SpellCheckDiff,
  type ContentReviewIssue,
  type ContentReviewStatus,
  type FieldReviewBlock,
  type SpellCheckSuggestion,
} from "../../content-review-feedback";

type PendingReviews = {
  questionReviewId: string;
  stanceReviewId: string;
};

type FieldSpellSuggestions = {
  question: SpellCheckSuggestion[];
  stance: SpellCheckSuggestion[];
};

async function reviewDebateTexts(input: {
  question: string;
  stance: string;
}): Promise<
  | { ok: true; pending: PendingReviews }
  | {
      ok: false;
      status: "revision_required" | "under_review" | "advisory_language";
      fieldBlocks: FieldReviewBlock[];
    }
> {
  const [questionReview, stanceReview] = await Promise.all([
    reviewTextBeforePublish({
      text: input.question,
      contextType: "debate_question",
    }),
    reviewTextBeforePublish({
      text: input.stance,
      contextType: "initiator_stance",
    }),
  ]);

  const fields: FieldReviewBlock[] = [
    {
      fieldLabel: "Vitakérdés",
      status: questionReview.status,
      issues: questionReview.issues,
      reviewId: questionReview.review_id,
    },
    {
      fieldLabel: "Kiinduló álláspont",
      status: stanceReview.status,
      issues: stanceReview.issues,
      reviewId: stanceReview.review_id,
    },
  ];

  const blocking = fields.filter(
    (field) =>
      field.status === "revision_required" || field.status === "under_review",
  );

  if (blocking.length > 0) {
    return {
      ok: false,
      status: blocking.some((field) => field.status === "under_review")
        ? "under_review"
        : "revision_required",
      fieldBlocks: blocking,
    };
  }

  const advisory = fields.filter((field) => field.status === "advisory_language");
  if (advisory.length > 0) {
    return {
      ok: false,
      status: "advisory_language",
      fieldBlocks: advisory,
    };
  }

  return {
    ok: true,
    pending: {
      questionReviewId: questionReview.review_id,
      stanceReviewId: stanceReview.review_id,
    },
  };
}

export default function NewDebatePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [reviewIssues, setReviewIssues] = useState<ContentReviewIssue[] | null>(
    null,
  );
  const [reviewStatus, setReviewStatus] = useState<ContentReviewStatus | null>(
    null,
  );
  const [fieldBlocks, setFieldBlocks] = useState<FieldReviewBlock[] | null>(
    null,
  );
  const [humanReviewDone, setHumanReviewDone] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [stanceText, setStanceText] = useState("");
  const [spellSuggestions, setSpellSuggestions] =
    useState<FieldSpellSuggestions | null>(null);
  const [acceptedQuestionSpell, setAcceptedQuestionSpell] = useState<Set<number>>(
    new Set(),
  );
  const [acceptedStanceSpell, setAcceptedStanceSpell] = useState<Set<number>>(
    new Set(),
  );
  const [loading, setLoading] = useState(false);
  const [spellLoading, setSpellLoading] = useState(false);
  const [displayMode, setDisplayMode] = useState<"named" | "anonymous">("named");

  function clearReviewState() {
    setReviewIssues(null);
    setReviewStatus(null);
    setFieldBlocks(null);
    setHumanReviewDone(false);
    setSpellSuggestions(null);
  }

  async function createDebate(
    form: HTMLFormElement,
    reviews: PendingReviews,
    overrides?: { question?: string; stance?: string },
  ) {
    const formData = new FormData(form);
    const res = await fetch("/api/v1/debates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: overrides?.question ?? formData.get("question"),
        initiator_stance: overrides?.stance ?? formData.get("initiator_stance"),
        category: formData.get("category"),
        display_mode: displayMode,
        display_name:
          displayMode === "named" ? formData.get("display_name") : undefined,
        question_content_review_id: reviews.questionReviewId,
        content_review_id: reviews.stanceReviewId,
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
    clearReviewState();
    setLoading(true);
    const form = e.currentTarget;
    const question = String(new FormData(form).get("question") ?? "").trim();
    const stance = String(new FormData(form).get("initiator_stance") ?? "").trim();
    setQuestionText(question);
    setStanceText(stance);

    try {
      const result = await reviewDebateTexts({ question, stance });
      if (!result.ok) {
        setFieldBlocks(result.fieldBlocks);
        setReviewStatus(result.status);
        setReviewIssues(
          result.fieldBlocks.flatMap((block) => block.issues),
        );
        if (result.status === "under_review") {
          setError("A szöveg emberi felülvizsgálatot igényel.");
        } else if (result.status === "revision_required") {
          setError("Egy vagy több mező jelenleg nem tehető közzé.");
        }
        return;
      }

      await createDebate(form, result.pending, { question, stance });
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

  async function continueAfterAdvisory(formId: string) {
    setLoading(true);
    setError(null);
    try {
      const form = document.getElementById(formId) as HTMLFormElement;
      const question = questionText.trim();
      const stance = stanceText.trim();
      const result = await reviewDebateTexts({ question, stance });
      if (!result.ok) {
        setFieldBlocks(result.fieldBlocks);
        setReviewStatus(result.status);
        setReviewIssues(
          result.fieldBlocks.flatMap((block) => block.issues),
        );
        setError("A szöveg továbbra sem tehető közzé.");
        return;
      }
      await createDebate(form, result.pending, { question, stance });
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

  async function runSpellCheck() {
    setSpellLoading(true);
    setError(null);
    try {
      const [questionSuggestions, stanceSuggestions] = await Promise.all([
        questionText.trim()
          ? requestSpellCheck(questionText.trim())
          : Promise.resolve([]),
        stanceText.trim()
          ? requestSpellCheck(stanceText.trim())
          : Promise.resolve([]),
      ]);
      setSpellSuggestions({
        question: questionSuggestions,
        stance: stanceSuggestions,
      });
      setAcceptedQuestionSpell(
        new Set(questionSuggestions.map((_, index) => index)),
      );
      setAcceptedStanceSpell(
        new Set(stanceSuggestions.map((_, index) => index)),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Helyesírás-ellenőrzés sikertelen",
      );
    } finally {
      setSpellLoading(false);
    }
  }

  async function applySpellAndContinue(formId: string) {
    if (!spellSuggestions) return;
    const correctedQuestion = applyAcceptedSpellSuggestions(
      questionText,
      spellSuggestions.question,
      acceptedQuestionSpell,
    );
    const correctedStance = applyAcceptedSpellSuggestions(
      stanceText,
      spellSuggestions.stance,
      acceptedStanceSpell,
    );
    setQuestionText(correctedQuestion);
    setStanceText(correctedStance);
    setLoading(true);
    setError(null);
    clearReviewState();

    try {
      const result = await reviewDebateTexts({
        question: correctedQuestion,
        stance: correctedStance,
      });
      if (!result.ok) {
        setFieldBlocks(result.fieldBlocks);
        setReviewStatus(result.status);
        setReviewIssues(
          result.fieldBlocks.flatMap((block) => block.issues),
        );
        setError("A javított szöveg továbbra sem tehető közzé.");
        return;
      }
      const form = document.getElementById(formId) as HTMLFormElement;
      await createDebate(form, result.pending, {
        question: correctedQuestion,
        stance: correctedStance,
      });
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

  async function submitHumanReviewRequest() {
    if (!fieldBlocks?.length) return;
    setLoading(true);
    setError(null);
    try {
      const result = await requestHumanReview({
        contentReviewIds: fieldBlocks.map((block) => block.reviewId),
      });
      setHumanReviewDone(true);
      setReviewStatus("under_review");
      setError(null);
      setReviewIssues(null);
      alert(result.message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Felülvizsgálat kérése sikertelen",
      );
    } finally {
      setLoading(false);
    }
  }

  const showAdvisoryActions = reviewStatus === "advisory_language";
  const showBlockingActions =
    (reviewStatus === "revision_required" || reviewStatus === "under_review") &&
    fieldBlocks &&
    fieldBlocks.length > 0 &&
    !humanReviewDone;

  return (
    <>
      <h1>Vitát indítok</h1>
      <p className="hint">Max. 160 karakteres vitakérdés.</p>
      <form id="new-debate-form" className="form card" onSubmit={onSubmit}>
        <label>
          Vitakérdés
          <input
            name="question"
            required
            maxLength={160}
            value={questionText}
            onChange={(e) => {
              setQuestionText(e.target.value);
              clearReviewState();
            }}
          />
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
              clearReviewState();
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
        {fieldBlocks &&
          fieldBlocks.length > 0 &&
          (reviewStatus === "revision_required" ||
            reviewStatus === "under_review") && (
            <MultiFieldContentReviewFeedback
              fieldBlocks={fieldBlocks}
              overallStatus={reviewStatus}
            />
          )}
        {reviewIssues &&
          reviewStatus === "advisory_language" &&
          fieldBlocks &&
          fieldBlocks.length > 0 && (
            <>
              {fieldBlocks.map((block) => (
                <div key={block.reviewId}>
                  <p className="meta">{block.fieldLabel}</p>
                  <ContentReviewFeedback
                    issues={block.issues}
                    status="advisory_language"
                  />
                </div>
              ))}
            </>
          )}
        {showBlockingActions && (
          <div className="content-review-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={clearReviewState}
            >
              Vissza a szerkesztéshez
            </button>
            <button
              type="button"
              className="btn"
              disabled={loading}
              onClick={submitHumanReviewRequest}
            >
              {loading ? "Küldés…" : "Felülvizsgálat kérése"}
            </button>
          </div>
        )}
        {humanReviewDone && (
          <p className="hint">
            Felülvizsgálati kérelmed rögzítve. Adminisztrátor dönt — addig a vita
            nem jelenik meg nyilvánosan.
          </p>
        )}
        {showAdvisoryActions && (
          <div className="content-review-actions">
            {!spellSuggestions ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={spellLoading}
                  onClick={runSpellCheck}
                >
                  {spellLoading ? "Ellenőrzés…" : "Helyesírás ellenőrzése"}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={loading}
                  onClick={() => continueAfterAdvisory("new-debate-form")}
                >
                  Folytatás ellenőrzés nélkül
                </button>
              </>
            ) : (
              <>
                {spellSuggestions.question.length > 0 && (
                  <>
                    <p className="meta">Vitakérdés</p>
                    <SpellCheckDiff
                      text={questionText}
                      suggestions={spellSuggestions.question}
                      accepted={acceptedQuestionSpell}
                      onToggle={(index) => {
                        setAcceptedQuestionSpell((prev) => {
                          const next = new Set(prev);
                          if (next.has(index)) next.delete(index);
                          else next.add(index);
                          return next;
                        });
                      }}
                    />
                  </>
                )}
                {spellSuggestions.stance.length > 0 && (
                  <>
                    <p className="meta">Kiinduló álláspont</p>
                    <SpellCheckDiff
                      text={stanceText}
                      suggestions={spellSuggestions.stance}
                      accepted={acceptedStanceSpell}
                      onToggle={(index) => {
                        setAcceptedStanceSpell((prev) => {
                          const next = new Set(prev);
                          if (next.has(index)) next.delete(index);
                          else next.add(index);
                          return next;
                        });
                      }}
                    />
                  </>
                )}
                {spellSuggestions.question.length === 0 &&
                  spellSuggestions.stance.length === 0 && (
                    <p className="hint">
                      Nincs egyértelmű helyesírási javaslat a két mezőben.
                    </p>
                  )}
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
        {!showAdvisoryActions && !showBlockingActions && !humanReviewDone && (
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
