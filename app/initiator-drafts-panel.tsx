"use client";

import {
  createDraftId,
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
  onSelectDraft: (draftId: string) => void;
  onCreateDraft: (draftId: string) => void;
  onDeleteDraft: (draftId: string) => void;
  onDeleteAllDrafts: () => void;
};

export function InitiatorDraftsPanel({
  activeDraftId,
  draftSaveStatus,
  drafts,
  onSelectDraft,
  onCreateDraft,
  onDeleteDraft,
  onDeleteAllDrafts,
}: Props) {
  function handleCreateDraft() {
    onCreateDraft(createDraftId());
  }

  function handleDeleteDraft(
    event: React.MouseEvent<HTMLButtonElement>,
    draftId: string,
  ) {
    event.stopPropagation();
    event.preventDefault();
    if (!window.confirm("Biztosan törlöd ezt a piszkozatot?")) return;
    onDeleteDraft(draftId);
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
              Automatikus mentés gépelés közben (3 mp). Kattints egy piszkozatra
              a betöltéshez. Az „Új” gomb üres lapot nyit.
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

        {drafts.length > 1 && (
          <div className="initiator-drafts-toolbar">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onDeleteAllDrafts}
            >
              Összes törlése ({drafts.length})
            </button>
          </div>
        )}

        {drafts.length === 0 ? (
          <p className="meta">
            Még nincs mentett piszkozat. Gépelés után automatikusan megjelenik
            itt.
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
                    className="btn btn-secondary btn-sm initiator-draft-delete"
                    aria-label="Piszkozat törlése"
                    onClick={(event) => handleDeleteDraft(event, draft.context_id)}
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
