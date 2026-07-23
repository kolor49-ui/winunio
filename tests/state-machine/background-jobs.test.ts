import { describe, expect, it } from "vitest";
import { transitionDebate } from "../../src/domain/debate.js";
import { transitionRound } from "../../src/domain/round.js";

describe("Background job domain effects", () => {
  it("invitation expiry returns debate to waiting_for_partner", () => {
    const result = transitionDebate(
      { status: "invitation_pending" },
      { type: "INVITATION_EXPIRED" },
    );
    expect(result.state.status).toBe("waiting_for_partner");
  });

  it("round timeout branches match BUSINESS_RULES §6", () => {
    const both = transitionRound("open", { type: "TIMEOUT_BOTH_SUBMITTED" });
    const one = transitionRound("open", { type: "TIMEOUT_ONE_SUBMITTED" });
    const none = transitionRound("open", { type: "TIMEOUT_NONE_SUBMITTED" });

    expect(both.eligibleForContinuation).toBe(true);
    expect(one.eligibleForContinuation).toBe(false);
    expect(none.status).toBe("closed_without_content");

    expect(
      transitionDebate({ status: "active" }, { type: "ROUND_PUBLISHED_BOTH_SIDES" })
        .state.status,
    ).toBe("waiting_for_continuation");
    expect(
      transitionDebate({ status: "active" }, { type: "ROUND_TIMEOUT_ONE_SIDE" })
        .state.status,
    ).toBe("completed");
    expect(
      transitionDebate({ status: "active" }, { type: "ROUND_TIMEOUT_NO_RESPONSE" })
        .state.status,
    ).toBe("completed");
  });
});
