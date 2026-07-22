import type { DebateApplicationStatus } from "./types";
import { DomainError } from "./types";

export type DebateApplicationEvent =
  | { type: "APPLY" }
  | { type: "SELECT_FOR_INVITATION" }
  | { type: "WITHDRAW" }
  | { type: "DEBATE_CANCELLED" }
  | { type: "OTHER_PARTNER_ACCEPTED" }
  | { type: "ACCEPT_INVITATION" }
  | { type: "REJECT_INVITATION" }
  | { type: "INVITATION_EXPIRED" }
  | { type: "REAPPLY" };

export type DebateApplicationEffect =
  | { type: "STANCE_RECORDED" }
  | { type: "INVITATION_SENT"; expiresInHours: 48 }
  | { type: "NEW_APPLICATION_RECORD" };

export interface DebateApplicationTransition {
  status: DebateApplicationStatus;
  effects: DebateApplicationEffect[];
}

const TERMINAL: DebateApplicationStatus[] = [
  "accepted",
  "withdrawn",
  "closed",
];

export function transitionDebateApplication(
  status: DebateApplicationStatus,
  event: DebateApplicationEvent,
): DebateApplicationTransition {
  if (event.type === "REAPPLY") {
    if (status !== "rejected" && status !== "expired") {
      throw new DomainError(
        "INVALID_TRANSITION",
        `Cannot reapply from status ${status}`,
      );
    }
    return {
      status: "pending",
      effects: [{ type: "NEW_APPLICATION_RECORD" }],
    };
  }

  switch (status) {
    case "pending":
      switch (event.type) {
        case "APPLY":
          return { status: "pending", effects: [{ type: "STANCE_RECORDED" }] };
        case "SELECT_FOR_INVITATION":
          return {
            status: "invited",
            effects: [{ type: "INVITATION_SENT", expiresInHours: 48 }],
          };
        case "WITHDRAW":
          return { status: "withdrawn", effects: [] };
        case "DEBATE_CANCELLED":
        case "OTHER_PARTNER_ACCEPTED":
          return { status: "closed", effects: [] };
        default:
          throw invalid(status, event);
      }

    case "invited":
      switch (event.type) {
        case "ACCEPT_INVITATION":
          return { status: "accepted", effects: [] };
        case "REJECT_INVITATION":
          return { status: "rejected", effects: [] };
        case "INVITATION_EXPIRED":
          return { status: "expired", effects: [] };
        case "DEBATE_CANCELLED":
          return { status: "closed", effects: [] };
        default:
          throw invalid(status, event);
      }

    case "rejected":
    case "expired":
    case "accepted":
    case "withdrawn":
    case "closed":
      if (TERMINAL.includes(status)) {
        throw invalid(status, event);
      }
      throw invalid(status, event);

    default:
      throw invalid(status, event);
  }
}

function invalid(
  status: DebateApplicationStatus,
  event: DebateApplicationEvent,
): DomainError {
  return new DomainError(
    "INVALID_TRANSITION",
    `Invalid application transition: ${status} + ${event.type}`,
  );
}
