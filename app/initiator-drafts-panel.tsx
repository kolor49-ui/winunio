"use client";

import {
  createDraftId,
  deleteInitiatorDraft,
  draftPreviewLabel,
  draftToEditorValues,
  formatDraftSavedAt,
  isDraftEmpty,
  type InitiatorDraft,
} from "./initiator-draft-api";

type Props = {
  activeDraftId: string | null;
  draftSaveStatus: "idle" | "loading" | "saving" | "saved" | "error";
  drafts: InitiatorDraft[];
  onDraftsChange: (drafts: InitiatorDraft[]) => void;
  onSelectDraft: (draftId: string) => void;
  onCreateDraft: (draftId: string) => void;
};

export function InitiatorDraftsPanel({
  activeDraftId,
  draftSaveStatus,
  drafts,
  onDraftsChange,
  onSelectDraft,
  onCreateDraft,
}: Props) {
  function handleCreateDraft() {
    onCreateDraft(createDraftId());
  }

  async function handleDeleteDraft(draftId: string) {
    if (!window.confirm("Biztosan törlöd ezt a piszkozatot?")) return;
    try {
      await deleteInitiatorDraft(draftId);
      const remaining = drafts.filter((draft) => draft.context_id !== draftId);
      onDraftsChange(remaining);
      if (activeDraftId === draftId) {
        if (remaining.length > 0) {
          onSelectDraft(remaining[0]!.context_id);
        } else {
          handleCreateDraft();
        }
      }
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Piszkozat törlése sikertelen",
      );
    }
  }

  const saveMessage =
    draftSaveStatus === "loading"
      ? "Betöltés…"
      : draftSaveStatus === "saving"
        ? "Mentés…"
        : draftSaveStatus === "saved"
          ? "Mentve"
          : draftSaveStatus === "error"
            ? "Mentés sikertelen"
            : "";

  return (
    <aside className="layout-sidebar initiator-drafts-panel" aria-label="Piszkozatok">
      <section className="layout-panel layout-panel-accent">
        <div className="layout-panel-header layout-panel-header-row">
          <div>
            <h2 className="layout-panel-title">Piszkozatok</h2>
            <p className="hint">
              Mentett vitaindítások — kattints a betöltéshez. Mentés után az
              adatlap kiürül.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCreateDraft}
          >
            Új
          </button>
        </div>

        {saveMessage && (
          <p className="initiator-drafts-save-status meta" aria-live="polite">
            {saveMessage}
          </p>
        )}

        {drafts.length === 0 ? (
          <p className="meta">
            Még nincs mentett piszkozat. Az első változtatás után megjelenik itt.
          </p>
        ) : (
          <ul className="initiator-drafts-list">
            {drafts.map((draft) => {
              const active = draft.context_id === activeDraftId;
              const empty = isDraftEmpty({
                question: draft.question ?? "",
                stance: draftToEditorValues(draft),
              });
              return (
                <li key={draft.context_id} className="initiator-drafts-item">
                  <button
                    type="button"
                    className={`initiator-draft-card${active ? " initiator-draft-card-active" : ""}`}
                    onClick={() => onSelectDraft(draft.context_id)}
                  >
                    <span className="initiator-draft-card-title">
                      {empty ? "Üres piszkozat" : draftPreviewLabel(draft)}
                    </span>
                    <span className="initiator-draft-card-meta">
                      {formatDraftSavedAt(draft.saved_at)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="initiator-draft-delete"
                    aria-label="Piszkozat törlése"
                    onClick={() => void handleDeleteDraft(draft.context_id)}
                  >
                    Törlés
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}
