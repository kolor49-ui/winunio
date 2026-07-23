import { describe, expect, it } from "vitest";
import { transitionDebate, type DebateState } from "../../src/domain/debate.js";

describe("Debate state machine", () => {
  it("waiting_for_partner → invitation_pending on partner select", () => {
    const result = transitionDebate(
      { status: "waiting_for_partner" },
      { type: "SELECT_PARTNER" },
    );
    expect(result.state.status).toBe("invitation_pending");
    expect(result.effects).toContainEqual({
      type: "CREATE_INVITATION",
      expiresInHours: 48,
    });
  });

  it("invitation accepted → active with round 1 and 72h deadline", () => {
    const result = transitionDebate(
      { status: "invitation_pending" },
      { type: "INVITATION_ACCEPTED" },
    );
    expect(result.state.status).toBe("active");
    expect(result.effects).toEqual(
      expect.arrayContaining([
        { type: "CLOSE_OTHER_APPLICATIONS" },
        { type: "CREATE_AND_OPEN_ROUND", roundNumber: 1 },
        { type: "START_RESPONSE_DEADLINE", hours: 72 },
      ]),
    );
  });

  it("invitation rejected → waiting_for_partner", () => {
    const result = transitionDebate(
      { status: "invitation_pending" },
      { type: "INVITATION_REJECTED" },
    );
    expect(result.state.status).toBe("waiting_for_partner");
  });

  it("invitation expired → waiting_for_partner", () => {
    const result = transitionDebate(
      { status: "invitation_pending" },
      { type: "INVITATION_EXPIRED" },
    );
    expect(result.state.status).toBe("waiting_for_partner");
  });

  it("both sides published → waiting_for_continuation", () => {
    const result = transitionDebate(
      { status: "active" },
      { type: "ROUND_PUBLISHED_BOTH_SIDES" },
    );
    expect(result.state.status).toBe("waiting_for_continuation");
    expect(result.effects).toContainEqual({ type: "OPEN_CONTINUATION_PERIOD" });
  });

  it("partial timeout → awaiting_closure when one side responded", () => {
    const one = transitionDebate(
      { status: "active" },
      { type: "ROUND_TIMEOUT_ONE_SIDE" },
    );
    expect(one.state.status).toBe("awaiting_closure");
  });

  it("partial timeout on first round → completed", () => {
    const one = transitionDebate(
      { status: "active" },
      { type: "ROUND_TIMEOUT_ONE_SIDE_FINAL" },
    );
    const none = transitionDebate(
      { status: "active" },
      { type: "ROUND_TIMEOUT_NO_RESPONSE" },
    );
    expect(one.state.status).toBe("completed");
    expect(none.state.status).toBe("completed");
  });

  it("close without threshold → awaiting_closure", () => {
    const result = transitionDebate(
      { status: "waiting_for_continuation" },
      { type: "CLOSE_WITHOUT_THRESHOLD" },
    );
    expect(result.state.status).toBe("awaiting_closure");
  });

  it("closing statements published → completed with reward finalize", () => {
    const result = transitionDebate(
      { status: "awaiting_closure" },
      { type: "CLOSING_STATEMENTS_PUBLISHED" },
    );
    expect(result.state.status).toBe("completed");
    expect(result.effects).toContainEqual({ type: "FINALIZE_DEBATE_REWARD" });
  });

  it("threshold met → active with reward and next round effects", () => {
    const result = transitionDebate(
      { status: "waiting_for_continuation" },
      { type: "CONTINUATION_THRESHOLD_MET" },
    );
    expect(result.state.status).toBe("active");
    expect(result.effects).toContainEqual({ type: "UPDATE_DEBATE_REWARD" });
    expect(result.effects).toContainEqual({ type: "CLOSE_CONTINUATION_PERIOD" });
  });

  it("under_review restores previous status on resolve", () => {
    const state: DebateState = {
      status: "under_review",
      statusBeforeReview: "waiting_for_continuation",
    };
    const result = transitionDebate(state, { type: "MODERATION_RESOLVED" });
    expect(result.state.status).toBe("waiting_for_continuation");
  });

  it("cancel only from waiting_for_partner or invitation_pending", () => {
    expect(
      transitionDebate({ status: "waiting_for_partner" }, { type: "CANCEL_DEBATE" })
        .state.status,
    ).toBe("cancelled");
    expect(
      transitionDebate({ status: "invitation_pending" }, { type: "CANCEL_DEBATE" })
        .state.status,
    ).toBe("cancelled");
  });

  it("rejects invalid transition", () => {
    expect(() =>
      transitionDebate({ status: "completed" }, { type: "SELECT_PARTNER" }),
    ).toThrow(/Invalid debate transition/);
  });
});
