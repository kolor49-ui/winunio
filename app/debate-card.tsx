import Link from "next/link";
import { DebateStatusPill } from "./debate-status-pill";

type DebateListItem = {
  id: string;
  question: string;
  category: string;
  status: string;
  continuation_count_7d?: number;
};

export function DebateCard({ debate }: { debate: DebateListItem }) {
  return (
    <Link href={`/debates/${debate.id}`} className="debate-link">
      <article className="debate-card">
        <div className="debate-card-head">
          <DebateStatusPill status={debate.status} />
          <span className="meta">{debate.category}</span>
        </div>
        <h3 className="debate-card-title">{debate.question}</h3>
        {debate.continuation_count_7d !== undefined &&
          debate.continuation_count_7d > 0 && (
            <p className="hint">
              {debate.continuation_count_7d} folytatáskérés (7 nap)
            </p>
          )}
        <p className="debate-card-cta">Megnyitás →</p>
      </article>
    </Link>
  );
}
