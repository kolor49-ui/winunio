import type {
  ContinuationChallengeStatus,
  ContinuationRequestRecord,
  DebateReward,
  DebateStatus,
  RoundStatus,
  RoundUnlockRule,
} from "./types";
import { DomainError } from "./types";
import { getUnlockRuleForCompletedRound, isThresholdMet } from "./unlock-rules";
import { canAcceptContinuationRequests } from "./round";

export type ContinuationChallengeEvent =
  | { type: "VERIFY_SUCCESS" }
  | { type: "VERIFY_FAILED" }
  | { type: "TTL_EXPIRED" };

export function transitionContinuationChallenge(
  status: ContinuationChallengeStatus,
  event: ContinuationChallengeEvent,
): ContinuationChallengeStatus {
  if (status !== "issued") {
    throw new DomainError(
      "CHALLENGE_NOT_USABLE",
      `Challenge not usable from status ${status}`,
    );
  }

  switch (event.type) {
    case "VERIFY_SUCCESS":
      return "consumed";
    case "VERIFY_FAILED":
      return "invalidated";
    case "TTL_EXPIRED":
      return "expired";
    default:
      throw new DomainError("INVALID_TRANSITION", "Unknown challenge event");
  }
}

export interface RecordContinuationInput {
  debateStatus: DebateStatus;
  completedRoundNumber: number;
  completedRoundId: string;
  completedRoundStatus: RoundStatus;
  userId: string;
  existingRequests: ContinuationRequestRecord[];
  unlockRules?: RoundUnlockRule[];
  currentReward: DebateReward | null;
}

export type ContinuationRecordEffect =
  | { type: "REQUEST_RECORDED"; isNew: boolean }
  | { type: "THRESHOLD_MET"; nextRoundNumber: number; reward: DebateReward }
  | { type: "CHALLENGE_CONSUMED" };

export interface RecordContinuationResult {
  requests: ContinuationRequestRecord[];
  validRequestCount: number;
  effects: ContinuationRecordEffect[];
  thresholdMet: boolean;
}

/**
 * Records a continuation request and evaluates threshold (STATE_MACHINE §ContinuationRequest, BUSINESS_RULES §8–10).
 * Round number -1 in debate effects is resolved by caller from completedRoundNumber + 1.
 */
export function recordContinuationRequest(
  input: RecordContinuationInput,
): RecordContinuationResult {
  const {
    debateStatus,
    completedRoundNumber,
    completedRoundId,
    completedRoundStatus,
    userId,
    existingRequests,
    unlockRules,
    currentReward,
  } = input;

  if (debateStatus !== "waiting_for_continuation") {
    throw new DomainError(
      "DEBATE_NOT_WAITING_FOR_CONTINUATION",
      `Debate must be waiting_for_continuation, got ${debateStatus}`,
    );
  }

  if (!canAcceptContinuationRequests(completedRoundStatus)) {
    throw new DomainError(
      "ROUND_NOT_PUBLISHED",
      "Continuation only allowed after a published round with both sides",
    );
  }

  const duplicate = existingRequests.some(
    (r) => r.userId === userId && r.completedRoundId === completedRoundId,
  );

  if (duplicate) {
    return {
      requests: existingRequests,
      validRequestCount: existingRequests.length,
      effects: [{ type: "REQUEST_RECORDED", isNew: false }],
      thresholdMet: false,
    };
  }

  const requests = [
    ...existingRequests,
    { userId, completedRoundId },
  ];
  const validRequestCount = requests.length;

  const rule = getUnlockRuleForCompletedRound(
    completedRoundNumber,
    unlockRules,
  );

  if (!rule) {
    return {
      requests,
      validRequestCount,
      effects: [{ type: "REQUEST_RECORDED", isNew: true }],
      thresholdMet: false,
    };
  }

  if (!isThresholdMet(validRequestCount, rule)) {
    return {
      requests,
      validRequestCount,
      effects: [{ type: "REQUEST_RECORDED", isNew: true }],
      thresholdMet: false,
    };
  }

  const nextRoundNumber = completedRoundNumber + 1;
  const reward: DebateReward = {
    unlockedByCompletedRoundNumber: completedRoundNumber,
    amountPerParticipant: rule.rewardAmountPerParticipant,
    status: "pending",
  };

  return {
    requests,
    validRequestCount,
    effects: [
      { type: "REQUEST_RECORDED", isNew: true },
      { type: "CHALLENGE_CONSUMED" },
      {
        type: "THRESHOLD_MET",
        nextRoundNumber,
        reward,
      },
    ],
    thresholdMet: true,
  };
}

/** First reward appears after round 1 threshold (25 requests) → round 2 opens (ADR-017) */
export function shouldShowRewardUi(reward: DebateReward | null): boolean {
  return reward !== null;
}

export function mergeRewardOnThreshold(
  current: DebateReward | null,
  next: DebateReward,
): DebateReward {
  return {
    ...next,
    amountPerParticipant: next.amountPerParticipant,
  };
}
