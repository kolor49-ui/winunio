import Link from "next/link";
import { DebateCard, type DebateListItem } from "./debate-card";

type Props = {
  title: string;
  description: string;
  debates: DebateListItem[];
  variant: "live" | "open";
  isLoggedIn: boolean;
  sort?: "new" | "popular";
  showSortTabs?: boolean;
  emptyTitle: string;
  emptyHint: string;
  listBasePath: string;
};

export function DebateBucketList({
  title,
  description,
  debates,
  variant,
  isLoggedIn,
  sort = "new",
  showSortTabs = false,
  emptyTitle,
  emptyHint,
  listBasePath,
}: Props) {
  const toneClass =
    variant === "open" ? "debate-feed-section-open" : "debate-feed-section-live";

  return (
    <div className="page-layout">
      <header className="page-hero page-hero-compact">
        <div className="page-hero-copy">
          <p className="hint">
            <Link href="/">← Főoldal</Link>
          </p>
          <h1 className="page-title">{title}</h1>
          <p className="page-lead">{description}</p>
        </div>
      </header>

      <section className={`layout-panel debate-feed-section ${toneClass}`}>
        <div className="layout-panel-header layout-panel-header-row">
          <div>
            <p className="layout-panel-title">
              {debates.length} vita
            </p>
          </div>
          {showSortTabs ? (
            <div className="feed-tabs" role="tablist" aria-label="Rendezés">
              <Link
                href={listBasePath}
                className={`feed-tab ${sort === "new" ? "feed-tab-active" : ""}`}
                role="tab"
                aria-selected={sort === "new"}
              >
                Új viták
              </Link>
              <Link
                href={`${listBasePath}?sort=popular`}
                className={`feed-tab ${sort === "popular" ? "feed-tab-active" : ""}`}
                role="tab"
                aria-selected={sort === "popular"}
              >
                Népszerű (7 nap)
              </Link>
            </div>
          ) : null}
        </div>

        {debates.length === 0 ? (
          <div className="empty-state">
            <p>{emptyTitle}</p>
            <p className="hint">{emptyHint}</p>
            <Link href="/" className="btn btn-secondary">
              Vissza a főoldalra
            </Link>
          </div>
        ) : (
          <div className="debate-grid">
            {debates.map((debate) => (
              <DebateCard
                key={debate.id}
                debate={debate}
                variant={variant}
                isLoggedIn={isLoggedIn}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
