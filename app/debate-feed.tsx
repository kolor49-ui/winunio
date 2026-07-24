import Link from "next/link";
import { DebateCard } from "./debate-card";

type DebateListItem = {
  id: string;
  question: string;
  category: string;
  status: string;
  created_at: string;
  continuation_count_7d?: number;
};

type Props = {
  debates: DebateListItem[];
  sort: "new" | "popular";
};

export function DebateFeed({ debates, sort }: Props) {
  return (
    <section className="layout-panel">
      <div className="layout-panel-header layout-panel-header-row">
        <div>
          <h2 className="layout-panel-title">Nyitott viták</h2>
          <p className="hint">
            Böngészd a vitákat — jelentkezhetsz partnernek, vagy olvasóként
            folytatást kérhetsz.
          </p>
        </div>
        <div className="feed-tabs" role="tablist" aria-label="Rendezés">
          <Link
            href="/"
            className={`feed-tab ${sort === "new" ? "feed-tab-active" : ""}`}
            role="tab"
            aria-selected={sort === "new"}
          >
            Új viták
          </Link>
          <Link
            href="/?sort=popular"
            className={`feed-tab ${sort === "popular" ? "feed-tab-active" : ""}`}
            role="tab"
            aria-selected={sort === "popular"}
          >
            Népszerű (7 nap)
          </Link>
        </div>
      </div>

      {debates.length === 0 ? (
        <div className="empty-state">
          <p>Még nincs megjeleníthető vita ebben a listában.</p>
          <Link href="/debates/new" className="btn">
            Vitát indítok
          </Link>
        </div>
      ) : (
        <div className="debate-grid">
          {debates.map((debate) => (
            <DebateCard key={debate.id} debate={debate} />
          ))}
        </div>
      )}
    </section>
  );
}
