import type { DebateStatus } from "./types";

/** Viták, ahol már van vagy lesz vitázó páros — olvasás / folytatáskérés. */
export const DEBATE_LIVE_STATUSES = [
  "active",
  "waiting_for_continuation",
  "awaiting_closure",
  "invitation_pending",
  "under_review",
] as const satisfies readonly DebateStatus[];

/** Viták, ahol még lehet jelentkezni B oldalra. */
export const DEBATE_OPEN_STATUSES = [
  "waiting_for_partner",
] as const satisfies readonly DebateStatus[];

export type DebateListBucket = "live" | "open";

export const HOME_DEBATE_PREVIEW_LIMIT = 3;

export function isLiveDebateStatus(status: string): boolean {
  return (DEBATE_LIVE_STATUSES as readonly string[]).includes(status);
}

export function isOpenDebateStatus(status: string): boolean {
  return (DEBATE_OPEN_STATUSES as readonly string[]).includes(status);
}
