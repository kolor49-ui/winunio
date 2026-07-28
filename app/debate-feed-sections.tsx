import Link from "next/link";
import { HOME_DEBATE_PREVIEW_LIMIT } from "@/domain/debate-list-buckets";
import { DebateCard, type DebateListItem } from "./debate-card";

type SectionProps = {
  id: string;
  title: string;
  description: string;
  debates: DebateListItem[];
  allHref: string;
  variant: "live" | "open";
  isLoggedIn: boolean;
  emptyTitle: string;
  emptyHint: string;
  previewLimit?: number;
};

export function DebateFeedSection({
  id,
  title,
  description,
  debates,
  allHref,
  variant,
  isLoggedIn,
  emptyTitle,
  emptyHint,
  previewLimit = HOME_DEBATE_PREVIEW_LIMIT,
}: SectionProps) {
  const preview = debates.slice(0, previewLimit);
  const toneClass =
    variant === "open" ? "debate-feed-section-open" : "debate-feed-section-live";

  return (
    <section id={id} className={`debate-feed-section ${toneClass}`}>
      <header className="debate-feed-section-header">
        <div className="debate-feed-section-heading">
          <h2 className="debate-feed-section-title">{title}</h2>
          <span className="debate-feed-section-count">{debates.length}</span>
        </div>
        <p className="hint debate-feed-section-desc">{description}</p>
      </header>

      {debates.length === 0 ? (
        <div className="debate-feed-section-empty">
          <p>{emptyTitle}</p>
          <p className="hint">{emptyHint}</p>
          {variant === "open" && isLoggedIn ? (
            <p style={{ marginTop: "0.75rem" }}>
              <Link href="/debates/new" className="btn btn-secondary btn-sm">
                Vitát indítok
              </Link>
            </p>
          ) : null}
          {!isLoggedIn && variant === "open" ? (
            <p className="debate-card-actions" style={{ marginTop: "0.75rem" }}>
              <Link href="/login" className="btn btn-secondary btn-sm">
                Bejelentkezés
              </Link>
              <Link href="/register" className="btn btn-secondary btn-sm">
                Regisztráció
              </Link>
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="debate-grid">
            {preview.map((debate) => (
              <DebateCard
                key={debate.id}
                debate={debate}
                variant={variant}
                isLoggedIn={isLoggedIn}
              />
            ))}
          </div>
          {debates.length > preview.length && (
            <p className="hint debate-feed-section-preview-note">
              {preview.length} / {debates.length} vita a főoldalon
            </p>
          )}
          <Link href={allHref} className="btn btn-secondary debate-feed-section-all">
            Összes vita ({debates.length}) →
          </Link>
        </>
      )}
    </section>
  );
}

type FeedSectionsProps = {
  liveDebates: DebateListItem[];
  openDebates: DebateListItem[];
  isLoggedIn: boolean;
};

export function DebateFeedSections({
  liveDebates,
  openDebates,
  isLoggedIn,
}: FeedSectionsProps) {
  return (
    <div className="debate-feed-sections">
      <DebateFeedSection
        id="folyamatban"
        title="Folyamatban zajlik"
        description="Két vitázó már részt vesz — olvashatod a fordulókat; folytatást kérni csak bejelentkezve."
        debates={liveDebates}
        allHref="/vitak/folyamatban"
        variant="live"
        isLoggedIn={isLoggedIn}
        emptyTitle="Most nincs folyamatban lévő vita."
        emptyHint="Nézd meg a partnerre váró vitákat — ott lehet jelentkezni."
      />
      <DebateFeedSection
        id="partnerre-var"
        title="Partnerre vár"
        description="Ezeknél a vitáknál még nincs B oldali partner — jelentkezni lehet (bejelentkezés után)."
        debates={openDebates}
        allHref="/vitak/partnerre-var"
        variant="open"
        isLoggedIn={isLoggedIn}
        emptyTitle="Most nincs partnerre váró vita."
        emptyHint={
          isLoggedIn
            ? "Indíts új vitát, ha szeretnél vitaindító lenni."
            : "Jelentkezz be, ha vitát indítanál vagy partnernek jelentkeznél."
        }
      />
    </div>
  );
}
