"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  createDraftId,
  deleteInitiatorDraft,
  fetchInitiatorDraft,
  fetchInitiatorDrafts,
  persistInitiatorDraft,
  type InitiatorDraft,
} from "../../initiator-draft-api";
import { InitiatorDraftsPanel } from "../../initiator-drafts-panel";
import {
  DebateEditor,
  formatEditorValuesForPublish,
  validateEditorValues,
  type DebateEditorValues,
} from "../../debate-editor";
import {
  applyAcceptedSpellSuggestions,
  checkStoredContentReviews,
  ContentReviewFeedback,
  extractContentReviewIssues,
  extractContentReviewStatus,
  fieldLabelForContext,
  MultiFieldContentReviewFeedback,
  requestHumanReview,
  requestSpellCheck,
  reviewTextBeforePublish,
  SpellCheckDiff,
  type ContentReviewIssue,
  type ContentReviewStatus,
  type FieldReviewBlock,
  type SpellCheckSuggestion,
  type StoredReviewCheckResult,
} from "../../content-review-feedback";

type PendingReviews = {
  questionReviewId: string;
  stanceReviewId: string;
};

type AppealState = "waiting" | "ready" | null;

type FieldSpellSuggestions = {
  question: SpellCheckSuggestion[];
};

function emptyStanceEditor(): DebateEditorValues {
  return { reasoning: "", quote: "", source: "" };
}

const DRAFT_DEBOUNCE_MS = 800;

function sortDrafts(drafts: InitiatorDraft[]): InitiatorDraft[] {
  return [...drafts].sort(
    (a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime(),
  );
}

function upsertDraftList(
  drafts: InitiatorDraft[],
  saved: InitiatorDraft,
): InitiatorDraft[] {
  return sortDrafts([
    saved,
    ...drafts.filter((draft) => draft.context_id !== saved.context_id),
  ]);
}

function fieldBlocksFromStoredCheck(
  result: StoredReviewCheckResult,
): FieldReviewBlock[] {
  return result.reviews
    .filter(
      (review) =>
        review.status === "revision_required" || review.status === "under_review",
    )
    .map((review) => ({
      fieldLabel: fieldLabelForContext(review.context_type),
      status: review.status,
      issues: review.issues,
      reviewId: review.review_id,
    }));
}

async function reviewDebateTexts(input: {
  question: string;
  stance: DebateEditorValues;
}): Promise<
  | { ok: true; pending: PendingReviews }
  | {
      ok: false;
      status: "revision_required" | "under_review" | "advisory_language";
      fieldBlocks: FieldReviewBlock[];
      reviewIds: PendingReviews;
    }
> {
  const stanceText = formatEditorValuesForPublish(input.stance);
  const [questionReview, stanceReview] = await Promise.all([
    reviewTextBeforePublish({
      text: input.question,
      contextType: "debate_question",
    }),
    reviewTextBeforePublish({
      text: stanceText,
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
      reviewIds: {
        questionReviewId: questionReview.review_id,
        stanceReviewId: stanceReview.review_id,
      },
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
  const [pendingReviews, setPendingReviews] = useState<PendingReviews | null>(
    null,
  );
  const [appealState, setAppealState] = useState<AppealState>(null);
  const [questionText, setQuestionText] = useState("");
  const [stanceEditor, setStanceEditor] = useState<DebateEditorValues>(
    emptyStanceEditor,
  );
  const [spellSuggestions, setSpellSuggestions] =
    useState<FieldSpellSuggestions | null>(null);
  const [acceptedQuestionSpell, setAcceptedQuestionSpell] = useState<Set<number>>(
    new Set(),
  );
  const [loading, setLoading] = useState(false);
  const [spellLoading, setSpellLoading] = useState(false);
  const [displayMode, setDisplayMode] = useState<"named" | "anonymous">("named");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<InitiatorDraft[]>([]);
  const [draftSaveStatus, setDraftSaveStatus] = useState<
    "idle" | "loading" | "saving" | "saved" | "error"
  >("loading");
  const [draftReady, setDraftReady] = useState(false);
  const draftSaveTimer = useRef<number | undefined>(undefined);
  const switchingDraft = useRef(false);

  function clearReviewState() {
    setReviewIssues(null);
    setReviewStatus(null);
    setFieldBlocks(null);
    setPendingReviews(null);
    setAppealState(null);
    setSpellSuggestions(null);
  }

  function clearInitiatorForm() {
    setQuestionText("");
    setStanceEditor(emptyStanceEditor());
    setDisplayMode("named");
    clearReviewState();
    const form = document.getElementById(
      "new-debate-form",
    ) as HTMLFormElement | null;
    form?.reset();
  }

  function resetToNewDraftSheet(draftId?: string) {
    switchingDraft.current = true;
    window.clearTimeout(draftSaveTimer.current);
    clearInitiatorForm();
    setActiveDraftId(draftId ?? createDraftId());
    setDraftSaveStatus("idle");
    window.setTimeout(() => {
      switchingDraft.current = false;
    }, 0);
  }

  async function flushDraftSave(): Promise<void> {
    if (!activeDraftId) return;
    window.clearTimeout(draftSaveTimer.current);
    const saved = await persistInitiatorDraft(activeDraftId, {
      question: questionText,
      stance: stanceEditor,
    });
    if (saved) {
      setDrafts((current) => upsertDraftList(current, saved));
    }
  }

  async function selectDraft(draftId: string) {
    if (!draftReady || draftId === activeDraftId) return;
    switchingDraft.current = true;
    setDraftSaveStatus("saving");
    try {
      await flushDraftSave();
      const draft = await fetchInitiatorDraft(draftId);
      const form = document.getElementById(
        "new-debate-form",
      ) as HTMLFormElement | null;
      form?.reset();
      setActiveDraftId(draftId);
      setQuestionText(draft?.question ?? "");
      setStanceEditor(
        draft
          ? {
              reasoning: draft.reasoning ?? "",
              quote: draft.quote ?? "",
              source: draft.source ?? "",
            }
          : emptyStanceEditor(),
      );
      setDisplayMode("named");
      clearReviewState();
      setDraftSaveStatus("saved");
    } catch {
      setDraftSaveStatus("error");
    } finally {
      switchingDraft.current = false;
    }
  }

  async function createDraft(draftId: string) {
    if (!draftReady) return;
    switchingDraft.current = true;
    setDraftSaveStatus("saving");
    try {
      await flushDraftSave();
      resetToNewDraftSheet(draftId);
    } catch {
      setDraftSaveStatus("error");
      switchingDraft.current = false;
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setDraftSaveStatus("loading");
      try {
        const loadedDrafts = await fetchInitiatorDrafts();
        if (cancelled) return;
        setDrafts(loadedDrafts);
        setActiveDraftId(createDraftId());
        setQuestionText("");
        setStanceEditor(emptyStanceEditor());
        setDraftReady(true);
        setDraftSaveStatus("idle");
      } catch {
        if (cancelled) return;
        setDraftReady(true);
        setDraftSaveStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!draftReady || !activeDraftId || switchingDraft.current || loading) return;

    setDraftSaveStatus("saving");
    window.clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = window.setTimeout(() => {
      void (async () => {
        try {
          const saved = await persistInitiatorDraft(activeDraftId, {
            question: questionText,
            stance: stanceEditor,
          });
          if (saved) {
            setDrafts((current) => upsertDraftList(current, saved));
            resetToNewDraftSheet();
            setDraftSaveStatus("saved");
            return;
          }
          setDraftSaveStatus("saved");
        } catch {
          setDraftSaveStatus("error");
        }
      })();
    }, DRAFT_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(draftSaveTimer.current);
    };
  }, [questionText, stanceEditor, activeDraftId, draftReady, loading]);

  async function checkStoredDebateReviews(): Promise<StoredReviewCheckResult | null> {
    if (!pendingReviews) return null;
    return checkStoredContentReviews({
      reviews: [
        {
          review_id: pendingReviews.questionReviewId,
          text: questionText.trim(),
          context_type: "debate_question",
        },
        {
          review_id: pendingReviews.stanceReviewId,
          text: stancePublishText(),
          context_type: "initiator_stance",
        },
      ],
    });
  }

  async function refreshAppealStatus(options?: { silent?: boolean }) {
    if (!pendingReviews || appealState !== "waiting") return;
    if (!options?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const result = await checkStoredDebateReviews();
      if (!result) return;

      if (result.publishable) {
        setAppealState("ready");
        setReviewStatus("approved");
        setFieldBlocks(null);
        setReviewIssues(null);
        setError(null);
        return;
      }

      if (result.overall_status === "under_review") {
        setAppealState("waiting");
        return;
      }

      setAppealState(null);
      setReviewStatus(result.overall_status);
      const blocks = fieldBlocksFromStoredCheck(result);
      setFieldBlocks(blocks);
      setReviewIssues(blocks.flatMap((block) => block.issues));
      setError(
        result.overall_status === "revision_required"
          ? "Az admin javítást kért, vagy elutasította a felülvizsgálatot."
          : "A szöveg továbbra sem tehető közzé.",
      );
    } catch (err) {
      if (!options?.silent) {
        setError(
          err instanceof Error ? err.message : "Állapot lekérdezése sikertelen",
        );
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (appealState !== "waiting") return;
    const intervalId = window.setInterval(() => {
      void refreshAppealStatus({ silent: true });
    }, 20000);
    return () => window.clearInterval(intervalId);
  }, [appealState, pendingReviews, questionText, stanceEditor]);

  function stancePublishText(values = stanceEditor): string {
    return formatEditorValuesForPublish(values);
  }

  async function publishWithApprovedReviews() {
    if (!pendingReviews) return;
    setLoading(true);
    setError(null);
    try {
      const result = await checkStoredDebateReviews();
      if (!result?.publishable) {
        await refreshAppealStatus();
        return;
      }
      const form = document.getElementById("new-debate-form") as HTMLFormElement;
      await createDebate(form, pendingReviews, {
        question: questionText.trim(),
        stance: stancePublishText(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vitaindítás sikertelen");
    } finally {
      setLoading(false);
    }
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
    if (activeDraftId) {
      try {
        await deleteInitiatorDraft(activeDraftId);
        setDrafts((current) =>
          current.filter((draft) => draft.context_id !== activeDraftId),
        );
      } catch {
        /* vita létrejött — piszkozat törlése nem kritikus */
      }
    }
    router.push(`/debates/${data.debate.id}`);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    clearReviewState();
    setLoading(true);
    window.clearTimeout(draftSaveTimer.current);
    const form = e.currentTarget;
    const question = String(new FormData(form).get("question") ?? "").trim();
    const stanceError = validateEditorValues(stanceEditor);
    setQuestionText(question);

    if (stanceError) {
      setError(stanceError);
      setLoading(false);
      return;
    }

    try {
      const result = await reviewDebateTexts({ question, stance: stanceEditor });
      if (!result.ok) {
        setPendingReviews(result.reviewIds);
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

      await createDebate(form, result.pending, {
        question,
        stance: stancePublishText(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hálózati hiba");
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
      const stanceError = validateEditorValues(stanceEditor);
      if (stanceError) {
        setError(stanceError);
        setLoading(false);
        return;
      }
      const result = await reviewDebateTexts({ question, stance: stanceEditor });
      if (!result.ok) {
        setPendingReviews(result.reviewIds);
        setFieldBlocks(result.fieldBlocks);
        setReviewStatus(result.status);
        setReviewIssues(
          result.fieldBlocks.flatMap((block) => block.issues),
        );
        setError("A szöveg továbbra sem tehető közzé.");
        return;
      }
      await createDebate(form, result.pending, {
        question,
        stance: stancePublishText(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

  async function runSpellCheck() {
    setSpellLoading(true);
    setError(null);
    try {
      const [questionSuggestions] = await Promise.all([
        questionText.trim()
          ? requestSpellCheck(questionText.trim())
          : Promise.resolve([]),
      ]);
      setSpellSuggestions({
        question: questionSuggestions,
      });
      setAcceptedQuestionSpell(
        new Set(questionSuggestions.map((_, index) => index)),
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
    setQuestionText(correctedQuestion);
    setLoading(true);
    setError(null);
    clearReviewState();

    try {
      const result = await reviewDebateTexts({
        question: correctedQuestion,
        stance: stanceEditor,
      });
      if (!result.ok) {
        setPendingReviews(result.reviewIds);
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
        stance: stancePublishText(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

  async function submitHumanReviewRequest() {
    if (!fieldBlocks?.length || !pendingReviews) return;
    setLoading(true);
    setError(null);
    try {
      const result = await requestHumanReview({
        contentReviewIds: fieldBlocks.map((block) => block.reviewId),
      });
      setAppealState("waiting");
      setReviewStatus("under_review");
      setFieldBlocks(null);
      setReviewIssues(null);
      setError(null);
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
    !appealState;

  return (
    <div className="page-layout">
      <header className="page-hero page-hero-compact">
        <div className="page-hero-copy">
          <p className="page-eyebrow">Vitaindítás</p>
          <h1 className="page-title">Vitát indítok</h1>
          <p className="page-lead">Max. 160 karakteres vitakérdés.</p>
        </div>
      </header>

      <div className="layout-main layout-main-with-sidebar-right">
        <div className="layout-content">
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
        <DebateEditor
          key={activeDraftId ?? "draft"}
          embedded
          disableDraftPersistence
          initialValues={stanceEditor}
          contextType="initiator_stance"
          contextId={activeDraftId ?? "new"}
          reasoningLabel="Kiinduló álláspontod"
          onValuesChange={(values) => {
            setStanceEditor(values);
            clearReviewState();
          }}
        />
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
          !appealState &&
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
        {appealState === "waiting" && (
          <div
            className="content-review-feedback content-review-under-review"
            role="status"
          >
            <p className="content-review-title">Felülvizsgálat folyamatban.</p>
            <p className="hint">
              Adminisztrátor dönt a kérelmedről. Ha jóváhagyja, itt folytathatod a
              vitaindítást — addig nem kell újra futtatni az AI-ellenőrzést.
            </p>
            <div className="content-review-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={loading}
                onClick={() => refreshAppealStatus()}
              >
                {loading ? "Ellenőrzés…" : "Állapot frissítése"}
              </button>
            </div>
          </div>
        )}
        {appealState === "ready" && (
          <div className="content-review-feedback" role="status">
            <p className="content-review-title">
              Az admin jóváhagyta a szöveget.
            </p>
            <p className="hint">
              Most létrehozhatod a vitát a jóváhagyott ellenőrzés alapján.
            </p>
            <div className="content-review-actions">
              <button
                type="button"
                className="btn"
                disabled={loading}
                onClick={publishWithApprovedReviews}
              >
                {loading ? "Folyamatban…" : "Vita létrehozása"}
              </button>
            </div>
          </div>
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
                {spellSuggestions.question.length === 0 && (
                  <p className="hint">
                    Nincs egyértelmű helyesírási javaslat a vitakérdésben. Az
                    álláspont mezőnél használd a „Helyesírás ellenőrzése” gombot.
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
        {!showAdvisoryActions &&
          !showBlockingActions &&
          !appealState && (
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Folyamatban…" : "Vita létrehozása"}
          </button>
        )}
      </form>
      <p className="hint">
        <span className="side-badge side-a">A</span> bal ·{" "}
        <span className="side-badge side-b">B</span> jobb — fix pozíciók.
      </p>
        </div>

        {draftReady && (
          <InitiatorDraftsPanel
            activeDraftId={activeDraftId}
            draftSaveStatus={draftSaveStatus}
            drafts={drafts}
            onDraftsChange={setDrafts}
            onSelectDraft={(draftId) => void selectDraft(draftId)}
            onCreateDraft={(draftId) => void createDraft(draftId)}
          />
        )}
      </div>
    </div>
  );
}
