import { describe, expect, it } from "vitest";
import {
  canAcceptContinuationRequests,
  transitionRound,
} from "../../src/domain/round.js";

describe("Round state machine", () => {
  it("A published → stays open, not eligible for continuation", () => {
    const result = transitionRound("open", { type: "A_PUBLISHED" });
    expect(result.status).toBe("open");
    expect(result.eligibleForContinuation).toBe(false);
    expect(result.effects).toContainEqual({ type: "PUBLISH_A_IMMEDIATELY" });
  });

  it("B published → published, eligible for continuation", () => {
    const result = transitionRound("open", { type: "B_PUBLISHED" });
    expect(result.status).toBe("published");
    expect(result.eligibleForContinuation).toBe(true);
    expect(result.effects).toContainEqual({
      type: "PUBLISH_B_AND_COMPLETE_ROUND",
    });
  });

  it("timeout with both answers → published", () => {
    const result = transitionRound("open", { type: "TIMEOUT_BOTH_SUBMITTED" });
    expect(result.status).toBe("published");
    expect(result.eligibleForContinuation).toBe(true);
  });

  it("timeout one side → published but not eligible, needs closure", () => {
    const result = transitionRound("open", { type: "TIMEOUT_ONE_SUBMITTED" });
    expect(result.status).toBe("published");
    expect(result.eligibleForContinuation).toBe(false);
    expect(result.effects).toContainEqual({
      type: "DEBATE_NEEDS_CLOSURE",
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
      transitionRound("published", { type: "B_PUBLISHED" }),
    ).toThrow(/only allowed from open/);
  });
});
