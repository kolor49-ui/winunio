import type { DebateStatus } from "./types";
import { DomainError } from "./types";

export type DebateEvent =
  | { type: "SELECT_PARTNER" }
  | { type: "CANCEL_DEBATE" }
  | { type: "INVITATION_ACCEPTED" }
  | { type: "INVITATION_REJECTED" }
  | { type: "INVITATION_EXPIRED" }
  | { type: "ROUND_PUBLISHED_BOTH_SIDES" }
  | { type: "ROUND_TIMEOUT_ONE_SIDE" }
  | { type: "ROUND_TIMEOUT_ONE_SIDE_FINAL" }
  | { type: "ROUND_TIMEOUT_NO_RESPONSE" }
  | { type: "CONTINUATION_THRESHOLD_MET" }
  | { type: "CLOSE_WITHOUT_THRESHOLD" }
  | { type: "CLOSING_STATEMENTS_PUBLISHED" }
  | { type: "MODERATION_UNDER_REVIEW" }
  | { type: "MODERATION_RESOLVED" }
  | { type: "ADMIN_CLOSE" };

export type DebateEffect =
  | { type: "CREATE_INVITATION"; expiresInHours: 48 }
  | { type: "APPLICATION_INVITED" }
  | { type: "CLOSE_OTHER_APPLICATIONS" }
  | { type: "CREATE_AND_OPEN_ROUND"; roundNumber: 1 }
  | { type: "START_RESPONSE_DEADLINE"; hours: 72 }
  | { type: "INVITATION_REJECTED" }
  | { type: "INVITATION_EXPIRED" }
  | { type: "OPEN_CONTINUATION_PERIOD" }
  | { type: "CREATE_AND_OPEN_ROUND"; roundNumber: number }
  | { type: "UPDATE_DEBATE_REWARD" }
  | { type: "CLOSE_CONTINUATION_PERIOD" }
  | { type: "SUSPEND_WRITING_AND_CONTINUATION" }
  | { type: "FINALIZE_DEBATE_REWARD" };

export interface DebateState {
  status: DebateStatus;
  /** Restored when leaving under_review */
  statusBeforeReview?: DebateStatus;
}

export interface DebateTransition {
  state: DebateState;
  effects: DebateEffect[];
}

export function transitionDebate(
  state: DebateState,
  event: DebateEvent,
): DebateTransition {
  const { status } = state;

  if (event.type === "ADMIN_CLOSE" && status !== "completed" && status !== "cancelled") {
    return {
      state: { status: "awaiting_closure" },
      effects: [],
    };
  }

  if (
    event.type === "CANCEL_DEBATE" &&
    (status === "waiting_for_partner" || status === "invitation_pending")
  ) {
    return { state: { status: "cancelled" }, effects: [] };
  }

  switch (status) {
    case "waiting_for_partner":
      if (event.type === "SELECT_PARTNER") {
        return {
          state: { status: "invitation_pending" },
          effects: [
            { type: "CREATE_INVITATION", expiresInHours: 48 },
            { type: "APPLICATION_INVITED" },
          ],
        };
      }
      break;

    case "invitation_pending":
      switch (event.type) {
        case "INVITATION_ACCEPTED":
          return {
            state: { status: "active" },
            effects: [
              { type: "CLOSE_OTHER_APPLICATIONS" },
              { type: "CREATE_AND_OPEN_ROUND", roundNumber: 1 },
              { type: "START_RESPONSE_DEADLINE", hours: 72 },
            ],
          };
        case "INVITATION_REJECTED":
          return {
            state: { status: "waiting_for_partner" },
            effects: [{ type: "INVITATION_REJECTED" }],
          };
        case "INVITATION_EXPIRED":
          return {
            state: { status: "waiting_for_partner" },
            effects: [{ type: "INVITATION_EXPIRED" }],
          };
        default:
          break;
      }
      break;

    case "active":
      switch (event.type) {
        case "ROUND_PUBLISHED_BOTH_SIDES":
          return {
            state: { status: "waiting_for_continuation" },
            effects: [{ type: "OPEN_CONTINUATION_PERIOD" }],
          };
        case "ROUND_TIMEOUT_ONE_SIDE":
          return { state: { status: "awaiting_closure" }, effects: [] };
        case "ROUND_TIMEOUT_ONE_SIDE_FINAL":
        case "ROUND_TIMEOUT_NO_RESPONSE":
          return { state: { status: "completed" }, effects: [] };
        case "MODERATION_UNDER_REVIEW":
          return {
            state: {
              status: "under_review",
              statusBeforeReview: "active",
            },
            effects: [{ type: "SUSPEND_WRITING_AND_CONTINUATION" }],
          };
        default:
          break;
      }
      break;

    case "waiting_for_continuation":
      switch (event.type) {
        case "CONTINUATION_THRESHOLD_MET":
          return {
            state: { status: "active" },
            effects: [
              { type: "CLOSE_CONTINUATION_PERIOD" },
              { type: "CREATE_AND_OPEN_ROUND", roundNumber: -1 },
              { type: "UPDATE_DEBATE_REWARD" },
              { type: "START_RESPONSE_DEADLINE", hours: 72 },
            ],
          };
        case "CLOSE_WITHOUT_THRESHOLD":
          return { state: { status: "awaiting_closure" }, effects: [] };
        case "MODERATION_UNDER_REVIEW":
          return {
            state: {
              status: "under_review",
              statusBeforeReview: "waiting_for_continuation",
            },
            effects: [{ type: "SUSPEND_WRITING_AND_CONTINUATION" }],
          };
        default:
          break;
      }
      break;

    case "awaiting_closure":
      switch (event.type) {
        case "CLOSING_STATEMENTS_PUBLISHED":
          return {
            state: { status: "completed" },
            effects: [{ type: "FINALIZE_DEBATE_REWARD" }],
          };
        case "MODERATION_UNDER_REVIEW":
          return {
            state: {
              status: "under_review",
              statusBeforeReview: "awaiting_closure",
            },
            effects: [{ type: "SUSPEND_WRITING_AND_CONTINUATION" }],
          };
        default:
          break;
      }
      break;

    case "under_review":
      if (event.type === "MODERATION_RESOLVED" && state.statusBeforeReview) {
        return {
          state: { status: state.statusBeforeReview },
          effects: [],
        };
      }
      if (event.type === "ADMIN_CLOSE") {
        return { state: { status: "awaiting_closure" }, effects: [] };
      }
      break;

    default:
      break;
  }

  throw new DomainError(
    "INVALID_TRANSITION",
    `Invalid debate transition: ${status} + ${event.type}`,
  );
}
