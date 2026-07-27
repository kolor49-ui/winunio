import type { DebateEditorValues } from "./debate-editor";

export type InitiatorDraft = {
  context_id: string;
  question: string | null;
  reasoning: string;
  quote: string | null;
  source: string | null;
  version: number;
  saved_at: string;
};

export function createDraftId(): string {
  return crypto.randomUUID();
}

export function draftPreviewLabel(draft: InitiatorDraft): string {
  const question = draft.question?.trim();
  if (question) {
    return question.length > 72 ? `${question.slice(0, 69)}…` : question;
  }
  const reasoning = draft.reasoning.trim();
  if (reasoning) {
    return reasoning.length > 72 ? `${reasoning.slice(0, 69)}…` : reasoning;
  }
  return "Névtelen piszkozat";
}

export function formatDraftSavedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("hu-HU", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function fetchInitiatorDrafts(): Promise<InitiatorDraft[]> {
  const res = await fetch(
    "/api/v1/content-drafts?context_type=initiator_stance",
  );
  if (res.status === 401) return [];
  if (!res.ok) {
    throw new Error("Piszkozatok betöltése sikertelen");
  }
  const data = (await res.json()) as { drafts?: InitiatorDraft[] };
  return data.drafts ?? [];
}

export async function fetchInitiatorDraft(
  contextId: string,
): Promise<InitiatorDraft | null> {
  const res = await fetch(
    `/api/v1/content-drafts/initiator_stance/${encodeURIComponent(contextId)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = (await res.json()) as { draft?: InitiatorDraft | null };
  return data.draft ?? null;
}

export async function saveInitiatorDraft(
  contextId: string,
  input: {
    question: string;
    stance: DebateEditorValues;
  },
): Promise<InitiatorDraft> {
  const res = await fetch(
    `/api/v1/content-drafts/initiator_stance/${encodeURIComponent(contextId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: input.question.trim() || null,
        reasoning: input.stance.reasoning,
        quote: input.stance.quote || null,
        source: input.stance.source || null,
      }),
    },
  );
  if (!res.ok) {
    throw new Error("Piszkozat mentése sikertelen");
  }
  const data = (await res.json()) as { draft: InitiatorDraft };
  return data.draft;
}

export async function deleteInitiatorDraft(contextId: string): Promise<void> {
  const res = await fetch(
    `/api/v1/content-drafts/initiator_stance/${encodeURIComponent(contextId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    throw new Error("Piszkozat törlése sikertelen");
  }
}

export function draftToEditorValues(draft: InitiatorDraft): DebateEditorValues {
  return {
    reasoning: draft.reasoning ?? "",
    quote: draft.quote ?? "",
    source: draft.source ?? "",
  };
}

export function isDraftEmpty(input: {
  question: string;
  stance: DebateEditorValues;
}): boolean {
  return (
    !input.question.trim() &&
    !input.stance.reasoning.trim() &&
    !input.stance.quote.trim() &&
    !input.stance.source.trim()
  );
}

export async function loadInitiatorDraftsWithFallback(): Promise<{
  drafts: InitiatorDraft[];
  activeDraftId: string;
  question: string;
  stance: DebateEditorValues;
}> {
  const drafts = await fetchInitiatorDrafts();
  const activeDraftId = drafts[0]?.context_id ?? createDraftId();
  const activeDraft =
    drafts.find((draft) => draft.context_id === activeDraftId) ?? null;

  return {
    drafts,
    activeDraftId,
    question: activeDraft?.question ?? "",
    stance: activeDraft
      ? draftToEditorValues(activeDraft)
      : { reasoning: "", quote: "", source: "" },
  };
}

export async function persistInitiatorDraft(
  contextId: string,
  input: {
    question: string;
    stance: DebateEditorValues;
  },
): Promise<InitiatorDraft | null> {
  if (isDraftEmpty(input)) return null;
  return saveInitiatorDraft(contextId, input);
}
