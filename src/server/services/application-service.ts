import { z } from "zod";
import { transitionDebate } from "@/domain/debate";
import { transitionDebateApplication } from "@/domain/debate-application";
import { DomainError } from "@/domain/types";
import { ApiError } from "@/server/api/http";
import { getSql } from "@/server/db";

const INVITATION_HOURS = 48;
const ROUND_DEADLINE_HOURS = 72;

const applySchema = z.object({
  stance: z.string().min(1).max(2000),
});

export function parseApplyBody(body: unknown) {
  return applySchema.parse(body);
}

const selectPartnerSchema = z.object({
  application_id: z.string().uuid(),
});

export function parseSelectPartnerBody(body: unknown) {
  return selectPartnerSchema.parse(body);
}

function mapDomainError(error: DomainError): ApiError {
  return new ApiError(409, error.code, error.message);
}

export async function applyToDebate(
  debateId: string,
  userId: string,
  stance: string,
) {
  const sql = getSql();
  const trimmed = stance.trim();

  return sql.begin(async (tx) => {
    const [debate] = await tx<
      { id: string; initiator_id: string; status: string }[]
    >`
      SELECT id, initiator_id, status::text AS status
      FROM debates
      WHERE id = ${debateId}
      FOR UPDATE
    `;

    if (!debate) {
      throw new ApiError(404, "NOT_FOUND", "Vita nem található");
    }
    if (debate.initiator_id === userId) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "A vitaindító nem jelentkezhet partnernek",
      );
    }
    if (debate.status !== "waiting_for_partner") {
      throw new ApiError(
        409,
        "DEBATE_NOT_OPEN",
        "Erre a vitára jelenleg nem lehet jelentkezni",
      );
    }

    const [existing] = await tx<
      { id: string; status: string }[]
    >`
      SELECT id, status::text AS status
      FROM debate_applications
      WHERE debate_id = ${debateId} AND user_id = ${userId}
      FOR UPDATE
    `;

    if (existing) {
      if (existing.status === "pending" || existing.status === "invited") {
        throw new ApiError(
          409,
          "ALREADY_APPLIED",
          "Már jelentkeztél erre a vitára",
        );
      }
      if (existing.status === "accepted" || existing.status === "closed") {
        throw new ApiError(
          409,
          "APPLICATION_CLOSED",
          "Erre a vitára már nem jelentkezhetsz",
        );
      }

      if (existing.status === "rejected" || existing.status === "expired") {
        transitionDebateApplication(existing.status as "rejected" | "expired", {
          type: "REAPPLY",
        });
      }

      if (
        existing.status === "rejected" ||
        existing.status === "expired" ||
        existing.status === "withdrawn"
      ) {
        const [updated] = await tx<
          {
            id: string;
            stance: string;
            status: string;
            created_at: Date;
          }[]
        >`
          UPDATE debate_applications
          SET
            stance = ${trimmed},
            status = 'pending',
            invited_at = NULL,
            invitation_expires_at = NULL,
            created_at = now()
          WHERE id = ${existing.id}
          RETURNING id, stance, status::text AS status, created_at
        `;
        return formatApplication(updated);
      }

      throw new ApiError(
        409,
        "APPLICATION_CLOSED",
        "Erre a vitára már nem jelentkezhetsz",
      );
    }

    transitionDebateApplication("pending", { type: "APPLY" });

    const [created] = await tx<
      {
        id: string;
        stance: string;
        status: string;
        created_at: Date;
      }[]
    >`
      INSERT INTO debate_applications (debate_id, user_id, stance, status)
      VALUES (${debateId}, ${userId}, ${trimmed}, 'pending')
      RETURNING id, stance, status::text AS status, created_at
    `;

    return formatApplication(created);
  });
}

export async function listApplicationsForDebate(
  debateId: string,
  initiatorUserId: string,
) {
  const sql = getSql();

  const [debate] = await sql<
    { id: string; initiator_id: string; status: string }[]
  >`
    SELECT id, initiator_id, status::text AS status
    FROM debates
    WHERE id = ${debateId}
    LIMIT 1
  `;

  if (!debate) {
    throw new ApiError(404, "NOT_FOUND", "Vita nem található");
  }
  if (debate.initiator_id !== initiatorUserId) {
    throw new ApiError(403, "FORBIDDEN", "Csak a vitaindító láthatja a listát");
  }

  const rows = await sql<
    {
      id: string;
      user_id: string;
      stance: string;
      status: string;
      invited_at: Date | null;
      invitation_expires_at: Date | null;
      created_at: Date;
      display_name: string | null;
      is_anonymous: boolean;
    }[]
  >`
    SELECT
      a.id,
      a.user_id,
      a.stance,
      a.status::text AS status,
      a.invited_at,
      a.invitation_expires_at,
      a.created_at,
      p.display_name,
      p.is_anonymous
    FROM debate_applications a
    JOIN public_profiles p ON p.user_id = a.user_id
    WHERE a.debate_id = ${debateId}
      AND a.status IN ('pending', 'invited')
    ORDER BY a.created_at ASC
  `;

  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    stance: row.stance,
    status: row.status,
    invited_at: row.invited_at?.toISOString() ?? null,
    invitation_expires_at: row.invitation_expires_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    applicant_label: row.is_anonymous
      ? "Anonim jelentkező"
      : (row.display_name ?? "Névtelen"),
  }));
}

export async function withdrawApplication(applicationId: string, userId: string) {
  const sql = getSql();

  return sql.begin(async (tx) => {
    const [app] = await tx<
      { id: string; user_id: string; status: string; debate_id: string }[]
    >`
      SELECT id, user_id, status::text AS status, debate_id
      FROM debate_applications
      WHERE id = ${applicationId}
      FOR UPDATE
    `;

    if (!app) {
      throw new ApiError(404, "NOT_FOUND", "Jelentkezés nem található");
    }
    if (app.user_id !== userId) {
      throw new ApiError(403, "FORBIDDEN", "Nem a te jelentkezésed");
    }

    try {
      transitionDebateApplication(app.status as "pending", { type: "WITHDRAW" });
    } catch (error) {
      if (error instanceof DomainError) throw mapDomainError(error);
      throw error;
    }

    await tx`
      UPDATE debate_applications
      SET status = 'withdrawn'
      WHERE id = ${applicationId}
    `;

    return { id: applicationId, status: "withdrawn" };
  });
}

export async function selectPartner(
  debateId: string,
  initiatorUserId: string,
  applicationId: string,
) {
  const sql = getSql();

  return sql.begin(async (tx) => {
    const [debate] = await tx<
      { id: string; initiator_id: string; status: string }[]
    >`
      SELECT id, initiator_id, status::text AS status
      FROM debates
      WHERE id = ${debateId}
      FOR UPDATE
    `;

    if (!debate) {
      throw new ApiError(404, "NOT_FOUND", "Vita nem található");
    }
    if (debate.initiator_id !== initiatorUserId) {
      throw new ApiError(403, "FORBIDDEN", "Csak a vitaindító választhat partnert");
    }

    try {
      transitionDebate({ status: debate.status as "waiting_for_partner" }, {
        type: "SELECT_PARTNER",
      });
    } catch (error) {
      if (error instanceof DomainError) throw mapDomainError(error);
      throw error;
    }

    const [application] = await tx<
      { id: string; user_id: string; status: string; debate_id: string }[]
    >`
      SELECT id, user_id, status::text AS status, debate_id
      FROM debate_applications
      WHERE id = ${applicationId} AND debate_id = ${debateId}
      FOR UPDATE
    `;

    if (!application) {
      throw new ApiError(404, "NOT_FOUND", "Jelentkezés nem található");
    }
    if (application.user_id === initiatorUserId) {
      throw new ApiError(409, "INVALID_APPLICATION", "Érvénytelen jelentkezés");
    }

    try {
      transitionDebateApplication(application.status as "pending", {
        type: "SELECT_FOR_INVITATION",
      });
    } catch (error) {
      if (error instanceof DomainError) throw mapDomainError(error);
      throw error;
    }

    const expiresAt = new Date(Date.now() + INVITATION_HOURS * 60 * 60 * 1000);

    await tx`
      UPDATE debates
      SET status = 'invitation_pending'
      WHERE id = ${debateId}
    `;

    const [updated] = await tx<
      {
        id: string;
        status: string;
        invited_at: Date;
        invitation_expires_at: Date;
      }[]
    >`
      UPDATE debate_applications
      SET
        status = 'invited',
        invited_at = now(),
        invitation_expires_at = ${expiresAt}
      WHERE id = ${applicationId}
      RETURNING id, status::text AS status, invited_at, invitation_expires_at
    `;

    return {
      invitation: {
        id: updated.id,
        status: updated.status,
        invited_at: updated.invited_at.toISOString(),
        invitation_expires_at: updated.invitation_expires_at.toISOString(),
      },
      debate_status: "invitation_pending",
    };
  });
}

export async function acceptInvitation(applicationId: string, userId: string) {
  const sql = getSql();

  return sql.begin(async (tx) => {
    const [application] = await tx<
      {
        id: string;
        user_id: string;
        status: string;
        debate_id: string;
        invitation_expires_at: Date | null;
      }[]
    >`
      SELECT
        id,
        user_id,
        status::text AS status,
        debate_id,
        invitation_expires_at
      FROM debate_applications
      WHERE id = ${applicationId}
      FOR UPDATE
    `;

    if (!application) {
      throw new ApiError(404, "NOT_FOUND", "Meghívás nem található");
    }
    if (application.user_id !== userId) {
      throw new ApiError(403, "FORBIDDEN", "Nem neked szól ez a meghívás");
    }
    if (application.status !== "invited") {
      throw new ApiError(409, "INVALID_INVITATION", "A meghívás már nem aktív");
    }
    if (
      application.invitation_expires_at &&
      application.invitation_expires_at.getTime() <= Date.now()
    ) {
      await tx`
        UPDATE debate_applications SET status = 'expired' WHERE id = ${applicationId}
      `;
      await tx`
        UPDATE debates SET status = 'waiting_for_partner'
        WHERE id = ${application.debate_id} AND status = 'invitation_pending'
      `;
      throw new ApiError(410, "INVITATION_EXPIRED", "A meghívás lejárt");
    }

    const [debate] = await tx<
      { id: string; initiator_id: string; status: string }[]
    >`
      SELECT id, initiator_id, status::text AS status
      FROM debates
      WHERE id = ${application.debate_id}
      FOR UPDATE
    `;

    if (!debate || debate.status !== "invitation_pending") {
      throw new ApiError(409, "INVALID_STATE", "A vita nem vár meghívásra");
    }

    transitionDebate({ status: "invitation_pending" }, { type: "INVITATION_ACCEPTED" });
    transitionDebateApplication("invited", { type: "ACCEPT_INVITATION" });

    await tx`
      UPDATE debate_applications
      SET status = 'accepted'
      WHERE id = ${applicationId}
    `;

    await tx`
      UPDATE debate_applications
      SET status = 'closed'
      WHERE debate_id = ${debate.id}
        AND id != ${applicationId}
        AND status IN ('pending', 'invited')
    `;

    await tx`
      UPDATE debates
      SET status = 'active', published_at = COALESCE(published_at, now())
      WHERE id = ${debate.id}
    `;

    const [initiatorProfile] = await tx<{ id: string }[]>`
      SELECT id FROM public_profiles WHERE user_id = ${debate.initiator_id}
    `;
    const [partnerProfile] = await tx<{ id: string }[]>`
      SELECT id FROM public_profiles WHERE user_id = ${userId}
    `;

    if (!initiatorProfile || !partnerProfile) {
      throw new ApiError(500, "INTERNAL_ERROR", "Profil hiányzik");
    }

    await tx`
      INSERT INTO debate_participants (
        debate_id, user_id, role, side, public_profile_id
      )
      VALUES
        (${debate.id}, ${debate.initiator_id}, 'initiator', 'A', ${initiatorProfile.id}),
        (${debate.id}, ${userId}, 'partner', 'B', ${partnerProfile.id})
    `;

    const deadlineAt = new Date(
      Date.now() + ROUND_DEADLINE_HOURS * 60 * 60 * 1000,
    );

    const [round] = await tx<
      {
        id: string;
        round_number: number;
        deadline_at: Date;
      }[]
    >`
      INSERT INTO rounds (debate_id, round_number, status, opened_at, deadline_at)
      VALUES (${debate.id}, 1, 'open', now(), ${deadlineAt})
      RETURNING id, round_number, deadline_at
    `;

    return {
      debate_id: debate.id,
      debate_status: "active",
      round: {
        id: round.id,
        round_number: round.round_number,
        deadline_at: round.deadline_at.toISOString(),
      },
    };
  });
}

export async function rejectInvitation(applicationId: string, userId: string) {
  const sql = getSql();

  return sql.begin(async (tx) => {
    const [application] = await tx<
      {
        id: string;
        user_id: string;
        status: string;
        debate_id: string;
      }[]
    >`
      SELECT id, user_id, status::text AS status, debate_id
      FROM debate_applications
      WHERE id = ${applicationId}
      FOR UPDATE
    `;

    if (!application) {
      throw new ApiError(404, "NOT_FOUND", "Meghívás nem található");
    }
    if (application.user_id !== userId) {
      throw new ApiError(403, "FORBIDDEN", "Nem neked szól ez a meghívás");
    }

    try {
      transitionDebateApplication(application.status as "invited", {
        type: "REJECT_INVITATION",
      });
      transitionDebate({ status: "invitation_pending" }, {
        type: "INVITATION_REJECTED",
      });
    } catch (error) {
      if (error instanceof DomainError) throw mapDomainError(error);
      throw error;
    }

    await tx`
      UPDATE debate_applications
      SET status = 'rejected', invited_at = NULL, invitation_expires_at = NULL
      WHERE id = ${applicationId}
    `;

    await tx`
      UPDATE debates
      SET status = 'waiting_for_partner'
      WHERE id = ${application.debate_id} AND status = 'invitation_pending'
    `;

    return {
      debate_id: application.debate_id,
      debate_status: "waiting_for_partner",
      application_status: "rejected",
    };
  });
}

export async function getMyApplicationForDebate(debateId: string, userId: string) {
  const sql = getSql();

  const [row] = await sql<
    {
      id: string;
      stance: string;
      status: string;
      invited_at: Date | null;
      invitation_expires_at: Date | null;
      created_at: Date;
    }[]
  >`
    SELECT
      id,
      stance,
      status::text AS status,
      invited_at,
      invitation_expires_at,
      created_at
    FROM debate_applications
    WHERE debate_id = ${debateId} AND user_id = ${userId}
    LIMIT 1
  `;

  if (!row) return null;

  if (
    row.status === "invited" &&
    row.invitation_expires_at &&
    row.invitation_expires_at.getTime() <= Date.now()
  ) {
    return {
      ...formatApplication(row),
      status: "expired" as const,
      expired: true,
    };
  }

  return formatApplication(row);
}

function formatApplication(row: {
  id: string;
  stance: string;
  status: string;
  created_at: Date;
  invited_at?: Date | null;
  invitation_expires_at?: Date | null;
}) {
  return {
    id: row.id,
    stance: row.stance,
    status: row.status,
    created_at: row.created_at.toISOString(),
    invited_at: row.invited_at?.toISOString() ?? null,
    invitation_expires_at: row.invitation_expires_at?.toISOString() ?? null,
  };
}
