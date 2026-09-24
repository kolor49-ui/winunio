"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyAcceptedSpellSuggestions,
  ContentReviewFeedback,
  requestSpellCheck,
  reviewTextBeforePublish,
  SpellCheckDiff,
  type ContentReviewIssue,
  type ContentReviewStatus,
  type SpellCheckSuggestion,
} from "./content-review-feedback";

export type ContentDraftContext =
  | "argument"
  | "closing_statement"
  | "initiator_stance"
  | "application_stance";

export type DebateEditorValues = {
  reasoning: string;
  quote: string;
  source: string;
};

type SharedProps = {
  contextType: ContentDraftContext;
  contextId: string;
  reasoningLabel: string;
  className?: string;
  onValuesChange?: (values: DebateEditorValues) => void;
  disableDraftPersistence?: boolean;
  initialValues?: DebateEditorValues;
};

type StandaloneProps = SharedProps & {
  embedded?: false;
  submitLabel: string;
  loading?: boolean;
  onSubmit: (payload: {
    reasoning: string;
    quote: string | null;
    source: string | null;
    content_review_id?: string;
  }) => Promise<void>;
};

type EmbeddedProps = SharedProps & {
  embedded: true;
};

type Props = StandaloneProps | EmbeddedProps;

const PASTE_MESSAGE =
  "A saját érvelést a Winunio szerkesztőjében kell megírnod. Beilleszteni csak az Idézet vagy a Forrás mezőbe lehet.";

const DRAFT_DEBOUNCE_MS = 800;

function emptyValues(): DebateEditorValues {
  return { reasoning: "", quote: "", source: "" };
}

export function formatEditorValuesForPublish(values: DebateEditorValues): string {
  const reasoning = values.reasoning.trim();
  const quote = values.quote.trim();
  const source = values.source.trim();
  const parts = [reasoning];
  if (quote) {
    parts.push("", "— Idézet —", quote);
    if (source) {
      parts.push(`Forrás: ${source}`);
    }
  }
  return parts.join("\n");
}

async function loadDraft(
  contextType: ContentDraftContext,
  contextId: string,
): Promise<DebateEditorValues | null> {
  const res = await fetch(
    `/api/v1/content-drafts/${contextType}/${encodeURIComponent(contextId)}`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.draft) return null;
  return {
    reasoning: data.draft.reasoning ?? "",
    quote: data.draft.quote ?? "",
    source: data.draft.source ?? "",
  };
}

async function saveDraft(
  contextType: ContentDraftContext,
  contextId: string,
  values: DebateEditorValues,
): Promise<void> {
  await fetch(
    `/api/v1/content-drafts/${contextType}/${encodeURIComponent(contextId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reasoning: values.reasoning,
        quote: values.quote || null,
        source: values.source || null,
      }),
    },
  );
}

export function blockReasoningPaste(
  event: React.ClipboardEvent | React.DragEvent,
): void {
  event.preventDefault();
}

export function DebateEditor(props: Props) {
  const {
    contextType,
    contextId,
    reasoningLabel,
    className = "debate-editor",
    onValuesChange,
    disableDraftPersistence = false,
    initialValues,
  } = props;
  const embedded = props.embedded === true;
  const loading = !embedded ? props.loading : false;
  const submitLabel = !embedded ? props.submitLabel : "";
  const onSubmit = !embedded ? props.onSubmit : undefined;

  const [values, setValues] = useState<DebateEditorValues>(
    () => initialValues ?? emptyValues(),
  );
  const [draftStatus, setDraftStatus] = useState<
    "idle" | "loading" | "saving" | "saved" | "error"
  >(disableDraftPersistence ? "idle" : "loading");
  const [dirty, setDirty] = useState(false);
  const [pasteWarning, setPasteWarning] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reviewIssues, setReviewIssues] = useState<ContentReviewIssue[] | null>(
    null,
  );
  const [reviewStatus, setReviewStatus] = useState<ContentReviewStatus | null>(
    null,
  );
  const [spellSuggestions, setSpellSuggestions] = useState<
    SpellCheckSuggestion[] | null
  >(null);
  const [spellCheckBaseText, setSpellCheckBaseText] = useState<string | null>(
    null,
  );
  const [acceptedSpell, setAcceptedSpell] = useState<Set<number>>(new Set());
  const [spellLoading, setSpellLoading] = useState(false);
  const [spellError, setSpellError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const onValuesChangeRef = useRef(onValuesChange);

  useEffect(() => {
    onValuesChangeRef.current = onValuesChange;
  }, [onValuesChange]);

  useEffect(() => {
    onValuesChangeRef.current?.(values);
  }, [values]);

  useEffect(() => {
    if (disableDraftPersistence) return;
    let cancelled = false;
    void (async () => {
      setDraftStatus("loading");
      try {
        const draft = await loadDraft(contextType, contextId);
        if (cancelled) return;
        if (draft) {
          setValues(draft);
        }
        setDraftStatus("idle");
      } catch {
        if (!cancelled) setDraftStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contextType, contextId, disableDraftPersistence]);

  useEffect(() => {
    if (disableDraftPersistence || !dirty) return;

    setDraftStatus("saving");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void (async () => {
        try {
          await saveDraft(contextType, contextId, values);
          setDraftStatus("saved");
          setDirty(false);
        } catch {
          setDraftStatus("error");
        }
      })();
    }, DRAFT_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(saveTimer.current);
    };
  }, [values, dirty, contextType, contextId, disableDraftPersistence]);

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const updateField = useCallback(
    (field: keyof DebateEditorValues, value: string) => {
      setValues((current) => ({ ...current, [field]: value }));
      setDirty(true);
      setFieldError(null);
      setSubmitError(null);
      setReviewIssues(null);
      setReviewStatus(null);
      if (field === "reasoning") {
        setSpellSuggestions(null);
        setSpellCheckBaseText(null);
        setSpellError(null);
      }
    },
    [],
  );

  function showPasteWarning() {
    setPasteWarning(true);
    window.setTimeout(() => setPasteWarning(false), 4000);
  }

  function validateFields(): boolean {
    const reasoning = values.reasoning.trim();
    if (!reasoning) {
      setFieldError("A saját érvelés kötelező.");
      return false;
    }
    if (values.quote.trim() && !values.source.trim()) {
      setFieldError("Idézethez forrás kötelező.");
      return false;
    }
    return true;
  }

  async function runSpellCheck() {
    const text = values.reasoning.trim();
    if (!text) {
      setFieldError("Előbb írj saját érvelést a helyesírás-ellenőrzéshez.");
      return;
    }
    setSpellLoading(true);
    setSpellError(null);
    setSubmitError(null);
    try {
      const suggestions = await requestSpellCheck(text);
      setSpellCheckBaseText(text);
      setSpellSuggestions(suggestions);
      setAcceptedSpell(new Set(suggestions.map((_, index) => index)));
    } catch (error) {
      setSpellError(
        error instanceof Error
          ? error.message
          : "Helyesírás-ellenőrzés sikertelen",
      );
      setSpellSuggestions(null);
      setSpellCheckBaseText(null);
    } finally {
      setSpellLoading(false);
    }
  }

  function applySpellSuggestions() {
    if (!spellSuggestions || !spellCheckBaseText) return;
    const nextReasoning = applyAcceptedSpellSuggestions(
      spellCheckBaseText,
      spellSuggestions,
      acceptedSpell,
    );
    setValues((current) => ({ ...current, reasoning: nextReasoning }));
    setDirty(true);
    setSpellSuggestions(null);
    setSpellCheckBaseText(null);
    setAcceptedSpell(new Set());
  }

  function dismissSpellSuggestions() {
    setSpellSuggestions(null);
    setSpellCheckBaseText(null);
    setAcceptedSpell(new Set());
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (embedded || !onSubmit) return;
    if (!validateFields()) return;

    setSubmitting(true);
    setSubmitError(null);
    setReviewIssues(null);
    setReviewStatus(null);

    const payload = {
      reasoning: values.reasoning.trim(),
      quote: values.quote.trim() || null,
      source: values.source.trim() || null,
    };

    try {
      const review = await reviewTextBeforePublish({
        text: payload.reasoning,
        contextType,
        contextId,
        quote: payload.quote ?? undefined,
        source: payload.source ?? undefined,
      });

      if (
        review.status === "revision_required" ||
        review.status === "under_review"
      ) {
        setReviewIssues(review.issues);
        setReviewStatus(review.status);
        return;
      }

      await onSubmit({
        ...payload,
        content_review_id: review.review_id,
      });
      setDirty(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Beküldés sikertelen",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const draftMessage =
    draftStatus === "loading"
      ? "Piszkozat betöltése…"
      : draftStatus === "saving"
        ? "Mentés…"
        : draftStatus === "saved"
          ? "Mentve"
          : draftStatus === "error"
            ? "Mentés sikertelen"
            : "";

  const busy = loading || submitting;
  const Wrapper = embedded ? "div" : "form";
  const wrapperProps = embedded
    ? { className }
    : { className: `form ${className}`, onSubmit: handleSubmit };

  return (
    <Wrapper {...wrapperProps}>
      <p className="debate-editor-intro hint">
        A saját érvelést itt kell megírnod. Beilleszteni csak idézetet vagy
        forrást lehet — mások gondolatait sajátként nem.
      </p>

      <label className="debate-editor-field">
        {reasoningLabel}
        <textarea
          className="debate-editor-reasoning"
          value={values.reasoning}
          onChange={(event) => updateField("reasoning", event.target.value)}
          onPaste={(event) => {
            blockReasoningPaste(event);
            showPasteWarning();
          }}
          onDrop={(event) => {
            blockReasoningPaste(event);
            showPasteWarning();
          }}
          required={!embedded}
          maxLength={2000}
          rows={6}
          aria-describedby="debate-editor-paste-help"
        />
      </label>

      {pasteWarning && (
        <p className="debate-editor-paste-alert" role="alert">
          {PASTE_MESSAGE}
        </p>
      )}
      <p id="debate-editor-paste-help" className="hint">
        A fő mezőbe nem illeszthetsz be szöveget — csak gépelhetsz vagy
        diktálsz.
      </p>

      <div className="debate-editor-spell-toolbar">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void runSpellCheck()}
          disabled={busy || spellLoading}
        >
          {spellLoading ? "Ellenőrzés…" : "Helyesírás ellenőrzése"}
        </button>
        <p className="hint debate-editor-spell-hint">
          Elütés és szóköz javítása — jelentést nem változtatunk, minden javaslat külön elfogadható.
        </p>
      </div>

      {spellError && (
        <p className="error debate-editor-spell-error" role="alert">
          {spellError}
        </p>
      )}

      {spellSuggestions && spellCheckBaseText && (
        <div className="debate-editor-spell panel-nested">
          <p className="meta">
            Helyesírási javaslatok — csak elfogadás után kerülnek be.
          </p>
          <SpellCheckDiff
            text={spellCheckBaseText}
            suggestions={spellSuggestions}
            accepted={acceptedSpell}
            onToggle={(index) => {
              setAcceptedSpell((current) => {
                const next = new Set(current);
                if (next.has(index)) next.delete(index);
                else next.add(index);
                return next;
              });
            }}
          />
          {spellSuggestions.length > 0 && (
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={applySpellSuggestions}
              >
                Javaslatok elfogadása
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={dismissSpellSuggestions}
              >
                Elvetés
              </button>
            </div>
          )}
        </div>
      )}

      <label className="debate-editor-field debate-editor-quote">
        Idézet <span className="meta">(opcionális)</span>
        <textarea
          value={values.quote}
          onChange={(event) => updateField("quote", event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Más szavai — külön mezőben"
        />
      </label>

      <label className="debate-editor-field debate-editor-source">
        Forrás / link
        <input
          type="text"
          value={values.source}
          onChange={(event) => updateField("source", event.target.value)}
          maxLength={500}
          placeholder="Kötelező, ha idézetet adsz meg"
        />
      </label>

      {!disableDraftPersistence && draftMessage && (
        <p className="debate-editor-draft-status" aria-live="polite">
          {draftMessage}
        </p>
      )}

      {!embedded && reviewIssues && reviewStatus && (
        <ContentReviewFeedback issues={reviewIssues} status={reviewStatus} />
      )}

      {(fieldError || submitError) && (
        <p className="error" role="alert">
          {fieldError ?? submitError}
        </p>
      )}

      {!embedded && (
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Küldés…" : submitLabel}
        </button>
      )}
    </Wrapper>
  );
}

export function validateEditorValues(values: DebateEditorValues): string | null {
  if (!values.reasoning.trim()) {
    return "A kiinduló álláspont kötelező.";
  }
  if (values.quote.trim() && !values.source.trim()) {
    return "Idézethez forrás kötelező.";
  }
  return null;
}
