import { getDebateById } from "@/server/services/debate-service";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function DebatePage({ params }: Props) {
  const { id } = await params;
  const debate = await getDebateById(id);

  if (!debate) {
    return (
      <div className="card">
        <p>Vita nem található.</p>
      </div>
    );
  }

  return (
    <>
      <h1>{debate.question}</h1>
      <p className="meta">
        {debate.category} · {debate.status}
      </p>

      <div className="card">
        <p>
          <span className="side-badge side-a">A</span> kiinduló álláspont
        </p>
        <p>{debate.initiator_stance}</p>
      </div>

      {debate.active_round && (
        <div className="card">
          <p>
            Aktív forduló: #{debate.active_round.round_number} · határidő:{" "}
            {new Date(debate.active_round.deadline_at).toLocaleString("hu-HU")}
          </p>
        </div>
      )}

      {debate.status === "waiting_for_continuation" && (
        <div className="card">
          <p>
            {debate.continuation_request_count} folytatáskérés (aktuális
            forduló)
          </p>
          <p className="hint">A gomb és Passkey flow későbbi lépés.</p>
        </div>
      )}

      {debate.reward && (
        <div className="card">
          <p>
            Jutalom (szimulált):{" "}
            {debate.reward.amount_per_participant.toLocaleString("hu-HU")} Ft /
            résztvevő
          </p>
          <p className="hint">
            Tesztüzem – a megjelenített összeg szimuláció, nem kerül
            kifizetésre.
          </p>
        </div>
      )}
    </>
  );
}
