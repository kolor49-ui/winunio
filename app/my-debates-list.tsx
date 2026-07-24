import Link from "next/link";
import {
  formatUserDebateRole,
  formatUserDebateStatus,
  sortUserDebates,
} from "./debate-labels";
import { DebateStatusPill } from "./debate-status-pill";
import type { UserDebateListItem } from "@/server/services/debate-service";

function needsAction(debate: UserDebateListItem): boolean {
  return (
    debate.application_status === "invited" ||
    (debate.involvement === "participant" && debate.status === "active") ||
    (debate.involvement === "initiator" && debate.status === "invitation_pending")
  );
}

function UserDebateCard({ debate }: { debate: UserDebateListItem }) {
  const action = needsAction(debate);

  return (
    <li className={`user-debate-card ${action ? "user-debate-card-action" : ""}`}>
      <div className="user-debate-card-head">
        <DebateStatusPill status={debate.status} />
        <span className="meta">{formatUserDebateRole(debate)}</span>
      </div>
      <p className="user-debate-card-title">
        <Link href={`/debates/${debate.id}`}>{debate.question}</Link>
      </p>
      <p className="meta">
        {debate.category} · {formatUserDebateStatus(debate)}
      </p>
      {debate.application_status === "invited" && (
        <p className="hint user-debate-alert">Meghívásod van — fogadd el vagy utasítsd.</p>
      )}
      {debate.involvement === "participant" && debate.status === "active" && (
        <p className="hint user-debate-alert">Aktív forduló — beküldés vagy olvasás.</p>
      )}
      {debate.involvement === "initiator" && debate.status === "waiting_for_partner" && (
        <p className="hint">Partnerre vár — válassz jelentkezőt.</p>
      )}
      <Link href={`/debates/${debate.id}`} className="debate-card-cta">
        Megnyitás →
      </Link>
    </li>
  );
}

export function MyDebatesPreview({ debates }: { debates: UserDebateListItem[] }) {
  const sorted = sortUserDebates(debates);
  const preview = sorted.slice(0, 4);

  return (
    <section className="layout-panel layout-panel-accent">
      <div className="layout-panel-header layout-panel-header-row">
        <div>
          <h2 className="layout-panel-title">Vitáim</h2>
          <p className="hint">Teendők és saját viták — rövid előnézet.</p>
        </div>
        <Link href="/vitaim" className="btn btn-secondary btn-sm">
          Összes →
        </Link>
      </div>
      {sorted.length === 0 ? (
        <p className="meta">
          Még nincs vitád.{" "}
          <Link href="/debates/new">Vitát indítok</Link> vagy jelentkezz az alábbi
          nyitott vitákra.
        </p>
      ) : (
        <ul className="user-debate-list">
          {preview.map((debate) => (
            <UserDebateCard key={debate.id} debate={debate} />
          ))}
        </ul>
      )}
      {sorted.length > preview.length && (
        <p className="hint">
          +{sorted.length - preview.length} további vita —{" "}
          <Link href="/vitaim">Vitáim oldal</Link>
        </p>
      )}
    </section>
  );
}

export function MyDebatesGrouped({ debates }: { debates: UserDebateListItem[] }) {
  const sorted = sortUserDebates(debates);
  const actionItems = sorted.filter(needsAction);
  const otherItems = sorted.filter((d) => !needsAction(d));

  if (sorted.length === 0) {
    return (
      <section className="layout-panel">
        <p className="meta">
          Még nincs ilyen vitád.{" "}
          <Link href="/debates/new">Vitát indítok</Link> vagy böngészd a{" "}
          <Link href="/">nyitott vitákat</Link>.
        </p>
      </section>
    );
  }

  return (
    <div className="vitaim-sections">
      {actionItems.length > 0 && (
        <section className="layout-panel layout-panel-accent">
          <h2 className="layout-panel-title">Teendő</h2>
          <p className="hint">Meghívás, aktív forduló vagy partner kiválasztása.</p>
          <ul className="user-debate-list">
            {actionItems.map((debate) => (
              <UserDebateCard key={debate.id} debate={debate} />
            ))}
          </ul>
        </section>
      )}

      {otherItems.length > 0 && (
        <section className="layout-panel">
          <h2 className="layout-panel-title">Minden vita</h2>
          <p className="hint">Indított, résztvevői és jelentkezői viták.</p>
          <ul className="user-debate-list">
            {otherItems.map((debate) => (
              <UserDebateCard key={debate.id} debate={debate} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
