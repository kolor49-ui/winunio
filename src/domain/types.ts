export type DebateStatus =
  | "waiting_for_partner"
  | "invitation_pending"
  | "active"
  | "waiting_for_continuation"
  | "awaiting_closure"
  | "completed"
  | "cancelled"
  | "under_review";

export type RoundStatus = "open" | "published" | "closed_without_content";

export type DebateApplicationStatus =
  | "pending"
  | "invited"
  | "accepted"
  | "rejected"
  | "expired"
  | "withdrawn"
  | "closed";

export type ContinuationChallengeStatus =
  | "issued"
  | "consumed"
  | "invalidated"
  | "expired";

export type DebateRewardStatus = "pending" | "simulated";

export interface RoundUnlockRule {
  completedRoundNumber: number;
  requiredContinuationRequests: number;
  rewardAmountPerParticipant: number;
}

export interface DebateReward {
  unlockedByCompletedRoundNumber: number;
  amountPerParticipant: number;
  status: DebateRewardStatus;
}

export interface ContinuationRequestRecord {
  userId: string;
  completedRoundId: string;
}

export type DomainErrorCode =
  | "INVALID_TRANSITION"
  | "DUPLICATE_REQUEST"
  | "ROUND_NOT_PUBLISHED"
  | "DEBATE_NOT_WAITING_FOR_CONTINUATION"
  | "CHALLENGE_NOT_USABLE";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
