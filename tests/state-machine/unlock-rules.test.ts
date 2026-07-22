import { describe, expect, it } from "vitest";
import { getUnlockRuleForCompletedRound, MVP_UNLOCK_RULES } from "../../src/domain/unlock-rules.js";

describe("RoundUnlockRule", () => {
  it("MVP seed thresholds 1–5", () => {
    expect(getUnlockRuleForCompletedRound(1)?.requiredContinuationRequests).toBe(25);
    expect(getUnlockRuleForCompletedRound(2)?.requiredContinuationRequests).toBe(50);
    expect(getUnlockRuleForCompletedRound(3)?.requiredContinuationRequests).toBe(100);
    expect(getUnlockRuleForCompletedRound(4)?.requiredContinuationRequests).toBe(250);
    expect(getUnlockRuleForCompletedRound(5)?.requiredContinuationRequests).toBe(500);
  });

  it("round 6+ doubles threshold from round 5 base", () => {
    const rule6 = getUnlockRuleForCompletedRound(6, MVP_UNLOCK_RULES);
    expect(rule6?.requiredContinuationRequests).toBe(1000);
    const rule7 = getUnlockRuleForCompletedRound(7, MVP_UNLOCK_RULES);
    expect(rule7?.requiredContinuationRequests).toBe(2000);
  });

  it("reward amounts from seed", () => {
    expect(getUnlockRuleForCompletedRound(1)?.rewardAmountPerParticipant).toBe(1000);
    expect(getUnlockRuleForCompletedRound(5)?.rewardAmountPerParticipant).toBe(12000);
  });
});
