import { describe, expect, it } from "vitest";
import { transitionDebateApplication } from "../../src/domain/debate-application.js";

describe("DebateApplication state machine", () => {
  it("pending → invited with 48h invitation", () => {
    const result = transitionDebateApplication("pending", {
      type: "SELECT_FOR_INVITATION",
    });
    expect(result.status).toBe("invited");
    expect(result.effects).toContainEqual({
      type: "INVITATION_SENT",
      expiresInHours: 48,
    });
  });

  it("invited → accepted on accept", () => {
    const result = transitionDebateApplication("invited", {
      type: "ACCEPT_INVITATION",
    });
    expect(result.status).toBe("accepted");
  });

  it("invited → rejected on reject", () => {
    const result = transitionDebateApplication("invited", {
      type: "REJECT_INVITATION",
    });
    expect(result.status).toBe("rejected");
  });

  it("invited → expired on timeout", () => {
    const result = transitionDebateApplication("invited", {
      type: "INVITATION_EXPIRED",
    });
    expect(result.status).toBe("expired");
  });

  it("rejected can reapply as new pending record", () => {
    const result = transitionDebateApplication("rejected", { type: "REAPPLY" });
    expect(result.status).toBe("pending");
    expect(result.effects).toContainEqual({ type: "NEW_APPLICATION_RECORD" });
  });

  it("pending closed when other partner accepted", () => {
    const result = transitionDebateApplication("pending", {
      type: "OTHER_PARTNER_ACCEPTED",
    });
    expect(result.status).toBe("closed");
  });
});
