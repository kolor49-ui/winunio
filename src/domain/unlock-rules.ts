import type { RoundUnlockRule } from "./types.js";

/** MVP seed values — mirrors db/migrations/000002_seed_round_unlock_rules.up.sql */
export const MVP_UNLOCK_RULES: RoundUnlockRule[] = [
  { completedRoundNumber: 1, requiredContinuationRequests: 25, rewardAmountPerParticipant: 1000 },
  { completedRoundNumber: 2, requiredContinuationRequests: 50, rewardAmountPerParticipant: 2000 },
  { completedRoundNumber: 3, requiredContinuationRequests: 100, rewardAmountPerParticipant: 4000 },
  { completedRoundNumber: 4, requiredContinuationRequests: 250, rewardAmountPerParticipant: 8000 },
  { completedRoundNumber: 5, requiredContinuationRequests: 500, rewardAmountPerParticipant: 12000 },
];

export function getUnlockRuleForCompletedRound(
  completedRoundNumber: number,
  rules: RoundUnlockRule[] = MVP_UNLOCK_RULES,
): RoundUnlockRule | undefined {
  const explicit = rules.find((r) => r.completedRoundNumber === completedRoundNumber);
  if (explicit) return explicit;

  if (completedRoundNumber < 6) return undefined;

  const rule5 = rules.find((r) => r.completedRoundNumber === 5);
  if (!rule5) return undefined;

  const roundsPastFive = completedRoundNumber - 5;
  const multiplier = 2 ** roundsPastFive;
  return {
    completedRoundNumber,
    requiredContinuationRequests: rule5.requiredContinuationRequests * multiplier,
    rewardAmountPerParticipant: rule5.rewardAmountPerParticipant,
  };
}

export function isThresholdMet(
  validRequestCount: number,
  rule: RoundUnlockRule,
): boolean {
  return validRequestCount >= rule.requiredContinuationRequests;
}
