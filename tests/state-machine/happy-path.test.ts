import { describe, expect, it } from "vitest";
import { transitionDebate, type DebateState } from "../../src/domain/debate.js";
import { recordContinuationRequest } from "../../src/domain/continuation.js";
import { transitionRound } from "../../src/domain/round.js";
import { MVP_UNLOCK_RULES } from "../../src/domain/unlock-rules.js";
import type {
  ContinuationRequestRecord,
  DebateReward,
  RoundStatus,
} from "../../src/domain/types.js";

/**
 * Happy path: STATE_MACHINE.md summary
 * waiting_for_partner → invitation_pending → active → waiting_for_continuation → active (threshold)
 */
describe("Happy path integration", () => {
  it("full cycle through first round and threshold unlock", () => {
    let debate: DebateState = { status: "waiting_for_partner" };

    debate = transitionDebate(debate, { type: "SELECT_PARTNER" }).state;
    expect(debate.status).toBe("invitation_pending");

    debate = transitionDebate(debate, { type: "INVITATION_ACCEPTED" }).state;
    expect(debate.status).toBe("active");

    let roundStatus: RoundStatus = "open";
    expect(roundStatus).toBe("open");

    const roundClose = transitionRound(roundStatus, {
      type: "BOTH_PARTICIPANTS_SUBMITTED",
    });
    roundStatus = roundClose.status;
    expect(roundStatus).toBe("published");
    expect(roundClose.eligibleForContinuation).toBe(true);

    debate = transitionDebate(debate, {
      type: "ROUND_PUBLISHED_BOTH_SIDES",
    }).state;
    expect(debate.status).toBe("waiting_for_continuation");

    const roundId = "round-1";
    let requests: ContinuationRequestRecord[] = [];
    let reward: DebateReward | null = null;

    for (let i = 0; i < 24; i++) {
      const r = recordContinuationRequest({
        debateStatus: debate.status,
        completedRoundNumber: 1,
        completedRoundId: roundId,
        completedRoundStatus: "published",
        userId: `user-${i}`,
        existingRequests: requests,
        unlockRules: MVP_UNLOCK_RULES,
        currentReward: reward,
      });
      requests = r.requests;
      expect(r.thresholdMet).toBe(false);
    }

    const final = recordContinuationRequest({
      debateStatus: debate.status,
      completedRoundNumber: 1,
      completedRoundId: roundId,
      completedRoundStatus: "published",
      userId: "user-24",
      existingRequests: requests,
      unlockRules: MVP_UNLOCK_RULES,
      currentReward: reward,
    });

    expect(final.validRequestCount).toBe(25);
    expect(final.thresholdMet).toBe(true);

    const threshold = final.effects.find((e) => e.type === "THRESHOLD_MET");
    expect(threshold).toMatchObject({
      nextRoundNumber: 2,
      reward: { amountPerParticipant: 1000 },
    });

    if (threshold?.type === "THRESHOLD_MET") {
      reward = threshold.reward;
    }

    debate = transitionDebate(debate, {
      type: "CONTINUATION_THRESHOLD_MET",
    }).state;
    expect(debate.status).toBe("active");
    expect(reward?.amountPerParticipant).toBe(1000);
  });

  it("partial timeout ends debate without continuation period", () => {
    let debate: DebateState = { status: "active" };

    const round = transitionRound("open", { type: "TIMEOUT_ONE_SUBMITTED" });
    expect(round.eligibleForContinuation).toBe(false);

    debate = transitionDebate(debate, {
      type: "ROUND_TIMEOUT_ONE_SIDE",
    }).state;
    expect(debate.status).toBe("completed");
  });
});
