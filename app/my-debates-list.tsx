import Link from "next/link";
import {
  formatUserDebateRole,
  formatUserDebateStatus,
  sortUserDebates,
} from "./debate-labels";
import type { UserDebateListItem } from "@/server/services/debate-service";

type Props = {
  debates: UserDebateListItem[];
  id?: string;
  showEmpty?: boolean;
};

export function MyDebatesList({ debates, id, showEmpty = false }: Props) {
  const sorted = sortUserDebates(debates);

  if (sorted.length === 0 && !showEmpty) {
    return null;
  }

  return (
    <section className="card" id={id}>
      <h2>Vitáim</h2>
      <p className="hint">
        Viták, amelyeket indítottál, amelyekben részt veszel, vagy amelyekre
        jelentkeztél.
      </p>
      {sorted.length === 0 ? (
        <p className="meta">
          Még nincs ilyen vitád.{" "}
          <Link href="/debates/new">Vitát indítok</Link> vagy jelentkezz az
          alábbi nyitott vitákra.
        </p>
      ) : (
        <ul className="admin-list">
          {sorted.map((debate) => {
            const needsAction =
              debate.application_status === "invited" ||
              (debate.involvement === "participant" && debate.status === "active");

            return (
              <li key={debate.id} className={needsAction ? "my-debate-action" : ""}>
                <p>
                  <Link href={`/debates/${debate.id}`}>
                    <strong>{debate.question}</strong>
                  </Link>
                </p>
                <p className="meta">
                  {debate.category} · {formatUserDebateStatus(debate)} ·{" "}
                  {formatUserDebateRole(debate)}
                </p>
                {debate.application_status === "invited" && (
                  <p className="hint">Meghívásod van — nyisd meg és fogadd el.</p>
                )}
                {debate.involvement === "participant" && debate.status === "active" && (
                  <p className="hint">Aktív forduló — nyisd meg a vitát.</p>
                )}
                <p className="hint">Megnyitás →</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
