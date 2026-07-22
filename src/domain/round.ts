import type { RoundStatus } from "./types";
import { DomainError } from "./types";

export type RoundEvent =
  | { type: "BOTH_PARTICIPANTS_SUBMITTED" }
  | { type: "TIMEOUT_BOTH_SUBMITTED" }
  | { type: "TIMEOUT_ONE_SUBMITTED" }
  | { type: "TIMEOUT_NONE_SUBMITTED" };

export type RoundEffect =
  | { type: "PUBLISH_ALL_CONTENT_SIMULTANEOUSLY" }
  | { type: "PUBLISH_ONE_PLUS_NEUTRAL_MESSAGE" }
  | { type: "DEBATE_COMPLETED"; reason: "partial_timeout" | "empty_timeout" }
  | { type: "NO_CONTINUATION_PERIOD" }
  | { type: "NO_AB_CONTENT_CARDS" };

export interface RoundTransition {
  status: RoundStatus;
  effects: RoundEffect[];
  /** Whether this round counts as published for continuation requests */
  eligibleForContinuation: boolean;
}

export function transitionRound(
  status: RoundStatus,
  event: RoundEvent,
): RoundTransition {
  if (status !== "open") {
    throw new DomainError(
      "INVALID_TRANSITION",
      `Round transition only allowed from open, got ${status}`,
    );
  }

  switch (event.type) {
    case "BOTH_PARTICIPANTS_SUBMITTED":
    case "TIMEOUT_BOTH_SUBMITTED":
      return {
        status: "published",
        effects: [{ type: "PUBLISH_ALL_CONTENT_SIMULTANEOUSLY" }],
        eligibleForContinuation: true,
      };

    case "TIMEOUT_ONE_SUBMITTED":
      return {
        status: "published",
        effects: [
          { type: "PUBLISH_ONE_PLUS_NEUTRAL_MESSAGE" },
          { type: "DEBATE_COMPLETED", reason: "partial_timeout" },
          { type: "NO_CONTINUATION_PERIOD" },
        ],
        eligibleForContinuation: false,
      };

    case "TIMEOUT_NONE_SUBMITTED":
      return {
        status: "closed_without_content",
        effects: [
          { type: "NO_AB_CONTENT_CARDS" },
          { type: "DEBATE_COMPLETED", reason: "empty_timeout" },
          { type: "NO_CONTINUATION_PERIOD" },
        ],
        eligibleForContinuation: false,
      };

    default:
      throw new DomainError("INVALID_TRANSITION", "Unknown round event");
  }
}

export function canAcceptContinuationRequests(roundStatus: RoundStatus): boolean {
  return roundStatus === "published";
}
