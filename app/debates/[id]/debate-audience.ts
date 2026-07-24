type ActiveRoundForAudience = {
  phase: "awaiting_a" | "awaiting_b";
};

/** Whether the sticky audience bar should offer B-response notification. */
export function shouldShowNotifyBar(
  debateStatus: string,
  participantSide: string | null,
  activeRound: ActiveRoundForAudience | null,
): boolean {
  return (
    debateStatus === "active" &&
    participantSide === null &&
    activeRound?.phase === "awaiting_b"
  );
}
