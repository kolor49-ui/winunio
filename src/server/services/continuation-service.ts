import { randomBytes } from "node:crypto";
import { z } from "zod";
import { transitionDebate } from "@/domain/debate";
import {
  recordContinuationRequest,
} from "@/domain/continuation";
import type { ContinuationRequestRecord, RoundUnlockRule } from "@/domain/types";
import { DomainError } from "@/domain/types";
import { ApiError } from "@/server/api/http";
import { getSql } from "@/server/db";
import { verifyTurnstileToken } from "@/server/turnstile";
import {
  createPasskeyAuthenticationOptions,
  userHasPasskey,
  verifyPasskeyAuthentication,
} from "@/server/services/passkey-service";
import { isPhoneVerified } from "@/server/services/phone-service";
import { logSecurityEvent } from "@/server/services/security-event-service";
import { notifyNewRoundOpened } from "@/server/services/user-notification-service";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import type { WebAuthnContext } from "@/server/webauthn-config";

const CHALLENGE_TTL_MINUTES = 10;
const CONTINUATION_RATE_LIMIT_PER_DAY = 20;
const ROUND_DEADLINE_HOURS = 72;

const challengeBodySchema = z.object({
  turnstile_token: z.string().min(1),
});

const submitBodySchema = z.object({
  challenge_id: z.string().uuid(),
  passkey_assertion: z.custom<AuthenticationResponseJSON>(),
});

export function parseContinuationChallengeBody(body: unknown) {
  return challengeBodySchema.parse(body);
}

export function parseContinuationSubmitBody(body: unknown) {
  return submitBodySchema.parse(body);
}

function mapDomainError(error: DomainError): ApiError {
  return new ApiError(409, error.code, error.message);
}

async function loadUnlockRules(): Promise<
  (RoundUnlockRule & { id: string })[]
> {
  const sql = getSql();
  const rows = await sql<
    {
      id: string;
      completed_round_number: number;
      required_continuation_requests: number;
      reward_amount_per_participant: string;
    }[]
  >`
    SELECT
      id,
      completed_round_number,
      required_continuation_requests,
      reward_amount_per_participant::text
    FROM round_unlock_rules
    WHERE active_to IS NULL OR active_to > now()
    ORDER BY completed_round_number ASC
  `;

  return rows.map((row) => ({
    id: row.id,
    completedRoundNumber: row.completed_round_number,
    requiredContinuationRequests: row.required_continuation_requests,
    rewardAmountPerParticipant: Number(row.reward_amount_per_participant),
  }));
}

async function assertCanRequestContinuation(
  userId: string,
  debateId: string,
  completedRoundId: string,
) {
  const sql = getSql();

  const [user] = await sql<
    {
      email_verified_at: Date | null;
      phone_verified_at: Date | null;
      status: string;
    }[]
  >`
    SELECT email_verified_at, phone_verified_at, status::text AS status
    FROM users WHERE id = ${userId} LIMIT 1
  `;

  if (!user || user.status !== "active") {
    throw new ApiError(401, "UNAUTHORIZED", "Érvénytelen fiók");
  }
  if (!user.email_verified_at) {
    throw new ApiError(403, "EMAIL_NOT_VERIFIED", "E-mail megerősítés szükséges");
  }
  if (!user.phone_verified_at) {
    throw new ApiError(
      403,
      "PHONE_NOT_VERIFIED",
      "Telefonszám megerősítés szükséges az első folytatáskéréshez",
    );
  }

  const [participant] = await sql<{ id: string }[]>`
    SELECT id FROM debate_participants
    WHERE debate_id = ${debateId} AND user_id = ${userId}
    LIMIT 1
  `;
  if (participant) {
    throw new ApiError(
      403,
      "PARTICIPANT_CANNOT_REQUEST",
      "A vitázók nem kérhetnek folytatást",
    );
  }

  const [round] = await sql<
    {
      id: string;
      debate_id: string;
      round_number: number;
      status: string;
    }[]
  >`
    SELECT id, debate_id, round_number, status::text AS status
    FROM rounds
    WHERE id = ${completedRoundId} AND debate_id = ${debateId}
    LIMIT 1
  `;

  if (!round || round.status !== "published") {
    throw new ApiError(
      409,
      "ROUND_NOT_PUBLISHED",
      "Folytatáskérés csak kétoldalú lezárt forduló után lehetséges",
    );
  }

  const [debate] = await sql<{ status: string }[]>`
    SELECT status::text AS status FROM debates WHERE id = ${debateId} LIMIT 1
  `;

  if (!debate || debate.status !== "waiting_for_continuation") {
    throw new ApiError(
      409,
      "DEBATE_NOT_WAITING_FOR_CONTINUATION",
      "A vita jelenleg nem fogad folytatáskéréseket",
    );
  }

  const [eligibleCount] = await sql<{ cnt: number }[]>`
    SELECT COUNT(*)::int AS cnt
    FROM arguments
    WHERE round_id = ${completedRoundId}
      AND is_system_placeholder = false
      AND published_at IS NOT NULL
  `;

  if ((eligibleCount?.cnt ?? 0) < 2) {
    throw new ApiError(
      409,
      "ROUND_NOT_ELIGIBLE",
      "Ehhez a fordulóhoz nem adható folytatáskérés",
    );
  }

  const [rateCount] = await sql<{ cnt: number }[]>`
    SELECT COUNT(*)::int AS cnt
    FROM continuation_requests
    WHERE user_id = ${userId}
      AND created_at > now() - interval '1 day'
  `;

  if ((rateCount?.cnt ?? 0) >= CONTINUATION_RATE_LIMIT_PER_DAY) {
    throw new ApiError(429, "RATE_LIMIT", "Túl sok folytatáskérés ma");
  }

  return round;
}

export async function getContinuationStatus(
  debateId: string,
  viewerUserId: string | null,
) {
  const sql = getSql();

  const [debate] = await sql<{ status: string }[]>`
    SELECT status::text AS status FROM debates WHERE id = ${debateId} LIMIT 1
  `;

  if (!debate || debate.status !== "waiting_for_continuation") {
    return null;
  }

  const [latestRound] = await sql<
    {
      id: string;
      round_number: number;
      status: string;
    }[]
  >`
    SELECT id, round_number, status::text AS status
    FROM rounds
    WHERE debate_id = ${debateId} AND status = 'published'
    ORDER BY round_number DESC
    LIMIT 1
  `;

  if (!latestRound) return null;

  const [countRow] = await sql<{ cnt: number }[]>`
    SELECT COUNT(*)::int AS cnt
    FROM continuation_requests
    WHERE completed_round_id = ${latestRound.id}
  `;

  const unlockRules = await loadUnlockRules();
  const rule = unlockRules.find(
    (r) => r.completedRoundNumber === latestRound.round_number,
  );

  let viewerAlreadyRequested = false;
  let viewerIsParticipant = false;
  let viewerCanRequest = false;
  let viewerBlockReason: string | null = null;

  if (viewerUserId) {
    const [existing] = await sql<{ id: string }[]>`
      SELECT id FROM continuation_requests
      WHERE user_id = ${viewerUserId} AND completed_round_id = ${latestRound.id}
      LIMIT 1
    `;
    viewerAlreadyRequested = Boolean(existing);

    const [participant] = await sql<{ id: string }[]>`
      SELECT id FROM debate_participants
      WHERE debate_id = ${debateId} AND user_id = ${viewerUserId}
      LIMIT 1
    `;
    viewerIsParticipant = Boolean(participant);

    if (viewerIsParticipant) {
      viewerBlockReason = "A vitázók nem kérhetnek folytatást";
    } else if (viewerAlreadyRequested) {
      viewerBlockReason = null;
    } else {
      try {
        await assertCanRequestContinuation(
          viewerUserId,
          debateId,
          latestRound.id,
        );
        viewerCanRequest = true;
      } catch (error) {
        if (error instanceof ApiError) {
          viewerBlockReason = error.message;
        }
      }
    }
  }

  const requestCount = countRow?.cnt ?? 0;
  const required = rule?.requiredContinuationRequests ?? null;
  const remaining =
    required != null ? Math.max(required - requestCount, 0) : null;

  return {
    completed_round_id: latestRound.id,
    completed_round_number: latestRound.round_number,
    request_count: requestCount,
    required_requests: required,
    remaining_requests: remaining,
    viewer_already_requested: viewerAlreadyRequested,
    viewer_is_participant: viewerIsParticipant,
    viewer_can_request: viewerCanRequest,
    viewer_block_reason: viewerBlockReason,
    viewer_has_passkey: viewerUserId
      ? await userHasPasskey(viewerUserId)
      : false,
    viewer_phone_verified: viewerUserId
      ? await isPhoneVerified(viewerUserId)
      : false,
  };
}

export async function issueContinuationChallenge(
  completedRoundId: string,
  userId: string,
  turnstileToken: string,
  webAuthnContext?: WebAuthnContext,
) {
  const turnstileOk = await verifyTurnstileToken(turnstileToken);
  if (!turnstileOk) {
    await logSecurityEvent({
      userId,
      eventType: "continuation_turnstile_fail",
      metadata: { completed_round_id: completedRoundId },
    });
    throw new ApiError(422, "TURNSTILE_FAILED", "Turnstile ellenőrzés sikertelen");
  }

  const sql = getSql();
  const [round] = await sql<{ id: string; debate_id: string }[]>`
    SELECT id, debate_id FROM rounds WHERE id = ${completedRoundId} LIMIT 1
  `;
  if (!round) {
    throw new ApiError(404, "NOT_FOUND", "Forduló nem található");
  }

  await assertCanRequestContinuation(userId, round.debate_id, completedRoundId);

  if (!(await userHasPasskey(userId))) {
    throw new ApiError(
      403,
      "PASSKEY_REQUIRED",
      "Előbb regisztrálj biztonságos azonosítást (Passkey)",
    );
  }

  const [existingRequest] = await sql<{ id: string }[]>`
    SELECT id FROM continuation_requests
    WHERE user_id = ${userId} AND completed_round_id = ${completedRoundId}
    LIMIT 1
  `;
  if (existingRequest) {
    return {
      already_requested: true as const,
      request_id: existingRequest.id,
    };
  }

  const challengeToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60 * 1000);

  const [challenge] = await sql<
    { id: string; challenge_token: string; expires_at: Date }[]
  >`
    INSERT INTO continuation_challenges (
      user_id,
      completed_round_id,
      challenge_token,
      expires_at
    )
    VALUES (${userId}, ${completedRoundId}, ${challengeToken}, ${expiresAt})
    RETURNING id, challenge_token, expires_at
  `;

  const passkeyOptions = await createPasskeyAuthenticationOptions(
    userId,
    challenge.challenge_token,
    webAuthnContext,
  );

  return {
    already_requested: false as const,
    challenge_id: challenge.id,
    expires_at: challenge.expires_at.toISOString(),
    passkey_options: passkeyOptions,
  };
}

export async function submitContinuationRequest(
  completedRoundId: string,
  userId: string,
  input: z.infer<typeof submitBodySchema>,
  webAuthnContext?: WebAuthnContext,
) {
  const sql = getSql();

  const [round] = await sql<
    { id: string; debate_id: string; round_number: number; status: string }[]
  >`
    SELECT id, debate_id, round_number, status::text AS status
    FROM rounds
    WHERE id = ${completedRoundId}
    LIMIT 1
  `;

  if (!round) {
    throw new ApiError(404, "NOT_FOUND", "Forduló nem található");
  }

  await assertCanRequestContinuation(userId, round.debate_id, completedRoundId);

  const [existing] = await sql<{ id: string }[]>`
    SELECT id FROM continuation_requests
    WHERE user_id = ${userId} AND completed_round_id = ${completedRoundId}
    LIMIT 1
  `;

  if (existing) {
    const status = await getContinuationStatus(round.debate_id, userId);
    return {
      idempotent: true as const,
      request_id: existing.id,
      request_count: status?.request_count ?? 0,
      remaining_requests: status?.remaining_requests ?? null,
      threshold_met: false,
    };
  }

  const [challenge] = await sql<
    {
      id: string;
      user_id: string;
      completed_round_id: string;
      challenge_token: string;
      status: string;
      expires_at: Date;
    }[]
  >`
    SELECT
      id,
      user_id,
      completed_round_id,
      challenge_token,
      status::text AS status,
      expires_at
    FROM continuation_challenges
    WHERE id = ${input.challenge_id}
    LIMIT 1
  `;

  if (
    !challenge ||
    challenge.user_id !== userId ||
    challenge.completed_round_id !== completedRoundId
  ) {
    throw new ApiError(422, "CHALLENGE_INVALID", "Érvénytelen challenge");
  }
  if (challenge.status !== "issued") {
    throw new ApiError(422, "CHALLENGE_NOT_USABLE", "A challenge már felhasználva");
  }
  if (challenge.expires_at.getTime() <= Date.now()) {
    await sql`
      UPDATE continuation_challenges
      SET status = 'expired'::continuation_challenge_status
      WHERE id = ${challenge.id}
    `;
    throw new ApiError(410, "CHALLENGE_EXPIRED", "A challenge lejárt");
  }

  await verifyPasskeyAuthentication(
    userId,
    input.passkey_assertion,
    challenge.challenge_token,
    webAuthnContext,
  );

  const unlockRules = await loadUnlockRules();

  try {
    const result = await sql.begin(async (tx) => {
      const [debate] = await tx<{ id: string; status: string }[]>`
        SELECT id, status::text AS status
        FROM debates
        WHERE id = ${round.debate_id}
        FOR UPDATE
      `;

      if (!debate || debate.status !== "waiting_for_continuation") {
        throw new ApiError(
          409,
          "DEBATE_NOT_WAITING_FOR_CONTINUATION",
          "A vita jelenleg nem fogad folytatáskéréseket",
        );
      }

      const [existingLocked] = await tx<{ id: string }[]>`
        SELECT id FROM continuation_requests
        WHERE user_id = ${userId} AND completed_round_id = ${completedRoundId}
        LIMIT 1
      `;

      if (existingLocked) {
        const [countRow] = await tx<{ cnt: number }[]>`
          SELECT COUNT(*)::int AS cnt
          FROM continuation_requests
          WHERE completed_round_id = ${completedRoundId}
        `;
        const rule = unlockRules.find(
          (r) => r.completedRoundNumber === round.round_number,
        );
        const requestCount = countRow?.cnt ?? 0;
        return {
          idempotent: true as const,
          request_id: existingLocked.id,
          request_count: requestCount,
          remaining_requests:
            rule != null
              ? Math.max(rule.requiredContinuationRequests - requestCount, 0)
              : null,
          threshold_met: false,
        };
      }

      const [challengeLocked] = await tx<
        { id: string; status: string; expires_at: Date }[]
      >`
        SELECT id, status::text AS status, expires_at
        FROM continuation_challenges
        WHERE id = ${challenge.id}
        FOR UPDATE
      `;

      if (!challengeLocked || challengeLocked.status !== "issued") {
        throw new ApiError(422, "CHALLENGE_NOT_USABLE", "A challenge már felhasználva");
      }

      const existingRows = await tx<
        { user_id: string; completed_round_id: string }[]
      >`
        SELECT user_id, completed_round_id
        FROM continuation_requests
        WHERE completed_round_id = ${completedRoundId}
      `;

      const existingRequests: ContinuationRequestRecord[] = existingRows.map(
        (row) => ({
          userId: row.user_id,
          completedRoundId: row.completed_round_id,
        }),
      );

      let domainResult;
      try {
        domainResult = recordContinuationRequest({
          debateStatus: "waiting_for_continuation",
          completedRoundNumber: round.round_number,
          completedRoundId,
          completedRoundStatus: "published",
          userId,
          existingRequests,
          unlockRules,
          currentReward: null,
        });
      } catch (error) {
        if (error instanceof DomainError) throw mapDomainError(error);
        throw error;
      }

      const [inserted] = await tx<{ id: string }[]>`
        INSERT INTO continuation_requests (
          debate_id,
          completed_round_id,
          user_id,
          challenge_id
        )
        VALUES (
          ${round.debate_id},
          ${completedRoundId},
          ${userId},
          ${challenge.id}
        )
        RETURNING id
      `;

      await tx`
        UPDATE continuation_challenges
        SET status = 'consumed'::continuation_challenge_status, consumed_at = now()
        WHERE id = ${challenge.id}
      `;

      let thresholdMet = domainResult.thresholdMet;

      if (thresholdMet) {
        const thresholdEffect = domainResult.effects.find(
          (e) => e.type === "THRESHOLD_MET",
        );
        if (thresholdEffect?.type === "THRESHOLD_MET") {
          const rule = unlockRules.find(
            (r) => r.completedRoundNumber === round.round_number,
          );
          if (!rule) {
            throw new ApiError(500, "INTERNAL_ERROR", "Unlock rule hiányzik");
          }

          transitionDebate(
            { status: "waiting_for_continuation" },
            { type: "CONTINUATION_THRESHOLD_MET" },
          );

          const deadlineAt = new Date(
            Date.now() + ROUND_DEADLINE_HOURS * 60 * 60 * 1000,
          );

          await tx`
            INSERT INTO rounds (debate_id, round_number, status, opened_at, deadline_at)
            VALUES (
              ${round.debate_id},
              ${thresholdEffect.nextRoundNumber},
              'open'::round_status,
              now(),
              ${deadlineAt}
            )
          `;

          await tx`
            INSERT INTO debate_rewards (
              debate_id,
              unlocked_by_completed_round_id,
              round_unlock_rule_id,
              amount_per_participant,
              status
            )
            VALUES (
              ${round.debate_id},
              ${completedRoundId},
              ${rule.id},
              ${thresholdEffect.reward.amountPerParticipant},
              'pending'::debate_reward_status
            )
            ON CONFLICT (debate_id, unlocked_by_completed_round_id) DO NOTHING
          `;

          await tx`
            UPDATE debates
            SET status = 'active'::debate_status
            WHERE id = ${round.debate_id}
          `;
        }
      }

      const rule = unlockRules.find(
        (r) => r.completedRoundNumber === round.round_number,
      );
      const requestCount = domainResult.validRequestCount;
      const remaining =
        rule != null
          ? Math.max(rule.requiredContinuationRequests - requestCount, 0)
          : null;

      return {
        idempotent: false as const,
        request_id: inserted.id,
        request_count: requestCount,
        remaining_requests: remaining,
        threshold_met: thresholdMet,
      };
    });

    await logSecurityEvent({
      userId,
      eventType: "continuation_request",
      metadata: {
        debate_id: round.debate_id,
        completed_round_id: completedRoundId,
        threshold_met: result.threshold_met,
        idempotent: result.idempotent,
      },
    });

    if (!result.idempotent && result.threshold_met) {
      void notifyNewRoundOpened(round.debate_id).catch((error) => {
        console.error("[continuation] new round notify failed:", error);
      });
    }

    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      await logSecurityEvent({
        userId,
        eventType: "continuation_request_fail",
        metadata: {
          completed_round_id: completedRoundId,
          code: error.code,
        },
      });
    }
    throw error;
  }
}
