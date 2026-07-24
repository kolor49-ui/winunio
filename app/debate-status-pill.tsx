import { DEBATE_STATUS_LABELS } from "./debate-labels";

export function DebateStatusPill({ status }: { status: string }) {
  const label = DEBATE_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
  const tone =
    status === "active"
      ? "pill-active"
      : status === "waiting_for_continuation"
        ? "pill-continuation"
        : status === "waiting_for_partner"
          ? "pill-open"
          : "pill-neutral";

  return <span className={`status-pill ${tone}`}>{label}</span>;
}
