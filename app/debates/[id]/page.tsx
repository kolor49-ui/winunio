import Link from "next/link";
import { ContinuationPanel } from "./continuation-panel";
import { DebatePartnerPanel } from "./debate-partner-panel";
import { DebateRoundPanel } from "./debate-round-panel";
import { getSession } from "@/server/api/http";
import { getDebateById } from "@/server/services/debate-service";
import {
  getMyApplicationForDebate,
  listApplicationsForDebate,
} from "@/server/services/application-service";
import { getContinuationStatus } from "@/server/services/continuation-service";
import { getViewerRoundContext } from "@/server/services/round-service";
import { getTurnstileSiteKey } from "@/server/turnstile";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  waiting_for_partner: "Partnerre vár",
  invitation_pending: "Meghívás folyamatban",
  active: "Aktív vita",
  waiting_for_continuation: "Folytatásra vár",
  completed: "Lezárva",
  cancelled: "Visszavonva",
  under_review: "Felülvizsgálat alatt",
};

export default async function DebatePage({ params }: Props) {
  const { id } = await params;
  const debate = await getDebateById(id);
  const session = await getSession();

  if (!debate) {
    return (
      <div className="card">
        <p>Vita nem található.</p>
      </div>
    );
  }

  const isInitiator = session?.userId === debate.initiator_id;
  let applications: Awaited<ReturnType<typeof listApplicationsForDebate>> = [];
  if (isInitiator && debate.status === "waiting_for_partner") {
    try {
      applications = await listApplicationsForDebate(id, session!.userId);
    } catch {
      applications = [];
    }
  }

  let myApplication = null;
  if (session?.userId && !isInitiator) {
    myApplication = await getMyApplicationForDebate(id, session.userId);
  }

  const roundContext = await getViewerRoundContext(
    id,
    session?.userId ?? null,
  );

  const continuationStatus =
    debate.status === "waiting_for_continuation"
      ? await getContinuationStatus(id, session?.userId ?? null)
      : null;

  const turnstileSiteKey = getTurnstileSiteKey() ?? "";

  return (
    <>
      <h1>{debate.question}</h1>
      <p className="meta">
        {debate.category} · {STATUS_LABELS[debate.status] ?? debate.status}
      </p>

      <div className="card">
        <p>
          <span className="side-badge side-a">A</span> kiinduló álláspont
        </p>
        <p>{debate.initiator_stance}</p>
      </div>

      {debate.partner_stance && debate.status !== "active" && (
        <div className="card">
          <p>
            <span className="side-badge side-b">B</span> partner álláspontja
          </p>
          <p>{debate.partner_stance}</p>
        </div>
      )}

      <DebatePartnerPanel
        debateId={debate.id}
        debateStatus={debate.status}
        initiatorId={debate.initiator_id}
        viewerUserId={session?.userId ?? null}
        isInitiator={isInitiator}
        pendingInvitation={debate.pending_invitation}
        initialApplications={applications}
        myApplication={myApplication}
      />

      <DebateRoundPanel
        debateStatus={debate.status}
        participantSide={roundContext.participant_side}
        activeRound={roundContext.active_round}
        publishedRounds={roundContext.published_rounds}
      />

      {continuationStatus && (
        <ContinuationPanel
          initialStatus={continuationStatus}
          viewerUserId={session?.userId ?? null}
          turnstileSiteKey={turnstileSiteKey}
        />
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

      <p className="hint">
        <Link href="/">← Vissza a listához</Link>
      </p>
    </>
  );
}
