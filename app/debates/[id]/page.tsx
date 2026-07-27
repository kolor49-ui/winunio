import Link from "next/link";
import { AudienceActionBar } from "./audience-action-bar";
import { ClosingStatementPanel } from "./closing-statement-panel";
import { DebatePartnerPanel } from "./debate-partner-panel";
import { DebateCancelPanel } from "./debate-cancel-panel";
import {
  DebateRoundPanel,
} from "./debate-round-panel";
import { shouldShowNotifyBar } from "./debate-audience";
import { ParticipantContentDisplay } from "../../participant-content-display";
import { ReportButton } from "../../report-button";
import { DebatePair, DebatePairSide } from "../debate-pair";
import { DebateStatusPill } from "../../debate-status-pill";
import { getSession } from "@/server/api/http";
import { getUserById } from "@/server/services/auth-service";
import { getDebateById } from "@/server/services/debate-service";
import {
  getMyApplicationForDebate,
  listApplicationsForDebate,
} from "@/server/services/application-service";
import { getClosingStatementContext } from "@/server/services/closing-statement-service";
import { getContinuationStatus } from "@/server/services/continuation-service";
import { getViewerRoundContext } from "@/server/services/round-service";
import { getTurnstileSiteKey } from "@/server/turnstile";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function DebatePage({ params }: Props) {
  const { id } = await params;
  const debate = await getDebateById(id);
  const session = await getSession();
  let user: Awaited<ReturnType<typeof getUserById>> = null;
  if (session) {
    try {
      user = await getUserById(session.userId);
    } catch {
      user = null;
    }
  }

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

  const closingContext =
    debate.status === "awaiting_closure" || debate.status === "completed"
      ? await getClosingStatementContext(id, session?.userId ?? null)
      : null;

  const turnstileSiteKey = getTurnstileSiteKey() ?? "";

  const showNotifyBar = shouldShowNotifyBar(
    debate.status,
    roundContext.participant_side,
    roundContext.active_round,
  );
  const showContinuationBar =
    debate.status === "waiting_for_continuation" && continuationStatus !== null;
  const showAudienceBar = showNotifyBar || showContinuationBar;
  const canCancelDebate =
    isInitiator &&
    (debate.status === "waiting_for_partner" ||
      debate.status === "invitation_pending");

  return (
    <div className="page-layout">
      <div
        className={
          showAudienceBar ? "debate-layout debate-layout-with-bar" : "debate-layout"
        }
      >
      <p className="hint">
        <Link href="/">← Főoldal</Link>
        {user && (
          <>
            {" · "}
            <Link href="/vitaim">Vitáim</Link>
          </>
        )}
      </p>
      <h1>{debate.question}</h1>
      <p className="meta debate-meta-row">
        <DebateStatusPill status={debate.status} />
        <span>{debate.category}</span>
      </p>
      <p className="hint debate-layout-legend">
        <span className="side-badge side-a">A</span> bal ·{" "}
        <span className="side-badge side-b">B</span> jobb — fix pozíciók.
      </p>

      <section className="card debate-section">
        <h2 className="section-title">Kiinduló álláspontok</h2>
        <DebatePair>
          <DebatePairSide side="A" label="kiinduló álláspont">
            <ParticipantContentDisplay content={debate.initiator_stance} />
            <ReportButton debateId={debate.id} />
          </DebatePairSide>
          <DebatePairSide
            side="B"
            label="kiinduló álláspont"
            placeholder={
              debate.partner_stance ? undefined : "Partnerre vár — még nincs B álláspont."
            }
          >
            {debate.partner_stance ? (
              <ParticipantContentDisplay content={debate.partner_stance} />
            ) : null}
          </DebatePairSide>
        </DebatePair>
      </section>

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

      {canCancelDebate && <DebateCancelPanel debateId={debate.id} />}

      {debate.status === "cancelled" && (
        <div className="card">
          <p>
            {isInitiator
              ? "A vitát visszavontad."
              : "A vitát a vitaindító visszavonta."}
          </p>
        </div>
      )}

      <DebateRoundPanel
        debateId={debate.id}
        debateStatus={debate.status}
        participantSide={roundContext.participant_side}
        activeRound={roundContext.active_round}
        publishedRounds={roundContext.published_rounds}
      />

      {closingContext && debate.status === "awaiting_closure" && (
        <ClosingStatementPanel debateId={debate.id} context={closingContext} />
      )}

      {closingContext?.phase === "published" && debate.status === "completed" && (
        <ClosingStatementPanel debateId={debate.id} context={closingContext} />
      )}

      {debate.reward && (
        <div className="card">
          <p>
            Jutalom{" "}
            {debate.reward.status === "pending" ? "(függőben)" : "(szimulált)"}:{" "}
            {debate.reward.amount_per_participant.toLocaleString("hu-HU")} Ft /
            résztvevő
          </p>
          <p className="hint">
            {debate.reward.status === "pending"
              ? "A jutalom függőben van — kifizethetővé csak a vita szabályos lezárásakor válik."
              : "Tesztüzem – a megjelenített összeg szimuláció, nem kerül kifizetésre."}
          </p>
        </div>
      )}

      {showNotifyBar && roundContext.active_round && (
        <AudienceActionBar
          mode="notify"
          roundId={roundContext.active_round.id}
          viewerUserId={session?.userId ?? null}
        />
      )}

      {showContinuationBar && continuationStatus && (
        <AudienceActionBar
          mode="continuation"
          initialStatus={continuationStatus}
          viewerUserId={session?.userId ?? null}
          turnstileSiteKey={turnstileSiteKey}
        />
      )}
      </div>
    </div>
  );
}
