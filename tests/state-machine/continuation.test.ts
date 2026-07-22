import { describe, expect, it } from "vitest";
import {
  recordContinuationRequest,
  shouldShowRewardUi,
  transitionContinuationChallenge,
} from "../../src/domain/continuation.js";
import { MVP_UNLOCK_RULES } from "../../src/domain/unlock-rules.js";
import type { ContinuationRequestRecord } from "../../src/domain/types.js";

const ROUND_1_ID = "round-1-uuid";

function makeRequests(count: number): ContinuationRequestRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    userId: `user-${i}`,
    completedRoundId: ROUND_1_ID,
  }));
}

describe("Continuation requests", () => {
  it("rejects when debate not waiting_for_continuation", () => {
    expect(() =>
      recordContinuationRequest({
        debateStatus: "active",
        completedRoundNumber: 1,
        completedRoundId: ROUND_1_ID,
        completedRoundStatus: "published",
        userId: "user-a",
        existingRequests: [],
        currentReward: null,
      }),
    ).toThrow(/waiting_for_continuation/);
  });

  it("rejects when round not published", () => {
    expect(() =>
      recordContinuationRequest({
        debateStatus: "waiting_for_continuation",
        completedRoundNumber: 1,
        completedRoundId: ROUND_1_ID,
        completedRoundStatus: "open",
        userId: "user-a",
        existingRequests: [],
        currentReward: null,
      }),
    ).toThrow(/published/);
  });

  it("duplicate request is idempotent — count does not increase", () => {
    const existing = [{ userId: "user-a", completedRoundId: ROUND_1_ID }];
    const result = recordContinuationRequest({
      debateStatus: "waiting_for_continuation",
      completedRoundNumber: 1,
      completedRoundId: ROUND_1_ID,
      completedRoundStatus: "published",
      userId: "user-a",
      existingRequests: existing,
      currentReward: null,
    });
    expect(result.validRequestCount).toBe(1);
    expect(result.requests).toHaveLength(1);
    expect(result.effects).toEqual([{ type: "REQUEST_RECORDED", isNew: false }]);
    expect(result.thresholdMet).toBe(false);
  });

  it("24th request — threshold not met for round 1 (needs 25)", () => {
    const result = recordContinuationRequest({
      debateStatus: "waiting_for_continuation",
      completedRoundNumber: 1,
      completedRoundId: ROUND_1_ID,
      completedRoundStatus: "published",
      userId: "user-new",
      existingRequests: makeRequests(23),
      currentReward: null,
    });
    expect(result.validRequestCount).toBe(24);
    expect(result.thresholdMet).toBe(false);
  });

  it("25th request unlocks round 2 with 1000 Ft reward", () => {
    const result = recordContinuationRequest({
      debateStatus: "waiting_for_continuation",
      completedRoundNumber: 1,
      completedRoundId: ROUND_1_ID,
      completedRoundStatus: "published",
      userId: "user-25",
      existingRequests: makeRequests(24),
      unlockRules: MVP_UNLOCK_RULES,
      currentReward: null,
    });
    expect(result.thresholdMet).toBe(true);
    const thresholdEffect = result.effects.find((e) => e.type === "THRESHOLD_MET");
    expect(thresholdEffect).toMatchObject({
      type: "THRESHOLD_MET",
      nextRoundNumber: 2,
      reward: {
        unlockedByCompletedRoundNumber: 1,
        amountPerParticipant: 1000,
        status: "simulated",
      },
    });
  });

  it("no reward UI before first threshold", () => {
    expect(shouldShowRewardUi(null)).toBe(false);
    expect(
      shouldShowRewardUi({
        unlockedByCompletedRoundNumber: 1,
        amountPerParticipant: 1000,
        status: "simulated",
      }),
    ).toBe(true);
  });

  it("challenge is single-use", () => {
    expect(
      transitionContinuationChallenge("issued", { type: "VERIFY_SUCCESS" }),
    ).toBe("consumed");
    expect(
      transitionContinuationChallenge("issued", { type: "VERIFY_FAILED" }),
    ).toBe("invalidated");
    expect(() =>
      transitionContinuationChallenge("consumed", { type: "VERIFY_SUCCESS" }),
    ).toThrow(/not usable/);
  });
});
