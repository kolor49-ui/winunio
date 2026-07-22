import { describe, expect, it } from "vitest";
import {
  canAcceptContinuationRequests,
  transitionRound,
} from "../../src/domain/round.js";

describe("Round state machine", () => {
  it("both submitted → published, eligible for continuation", () => {
    const result = transitionRound("open", {
      type: "BOTH_PARTICIPANTS_SUBMITTED",
    });
    expect(result.status).toBe("published");
    expect(result.eligibleForContinuation).toBe(true);
    expect(result.effects).toContainEqual({
      type: "PUBLISH_ALL_CONTENT_SIMULTANEOUSLY",
    });
  });

  it("timeout with both answers → published", () => {
    const result = transitionRound("open", { type: "TIMEOUT_BOTH_SUBMITTED" });
    expect(result.status).toBe("published");
    expect(result.eligibleForContinuation).toBe(true);
  });

  it("timeout one side → published but debate completes, no continuation", () => {
    const result = transitionRound("open", { type: "TIMEOUT_ONE_SUBMITTED" });
    expect(result.status).toBe("published");
    expect(result.eligibleForContinuation).toBe(false);
    expect(result.effects).toContainEqual({
      type: "DEBATE_COMPLETED",
      reason: "partial_timeout",
    });
    expect(result.effects).toContainEqual({ type: "NO_CONTINUATION_PERIOD" });
  });

  it("timeout no response → closed_without_content", () => {
    const result = transitionRound("open", { type: "TIMEOUT_NONE_SUBMITTED" });
    expect(result.status).toBe("closed_without_content");
    expect(result.eligibleForContinuation).toBe(false);
    expect(result.effects).toContainEqual({ type: "NO_AB_CONTENT_CARDS" });
  });

  it("published round accepts continuation requests", () => {
    expect(canAcceptContinuationRequests("published")).toBe(true);
    expect(canAcceptContinuationRequests("open")).toBe(false);
    expect(canAcceptContinuationRequests("closed_without_content")).toBe(false);
  });

  it("cannot transition from published", () => {
    expect(() =>
      transitionRound("published", { type: "BOTH_PARTICIPANTS_SUBMITTED" }),
    ).toThrow(/only allowed from open/);
  });
});
