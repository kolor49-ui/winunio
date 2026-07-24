import type { UserDebateListItem } from "@/server/services/debate-service";

export const DEBATE_STATUS_LABELS: Record<string, string> = {
  waiting_for_partner: "Partnerre vár",
  invitation_pending: "Meghívás folyamatban",
  active: "Aktív vita",
  waiting_for_continuation: "Folytatásra vár",
  awaiting_closure: "Zárásra vár",
  completed: "Lezárva",
  cancelled: "Visszavonva",
  under_review: "Felülvizsgálat alatt",
};

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  pending: "Jelentkezés várakozik",
  invited: "Meghívás — válasz szükséges",
  accepted: "Jelentkezés elfogadva",
  rejected: "Jelentkezés elutasítva",
  expired: "Meghívás lejárt",
  withdrawn: "Jelentkezés visszavonva",
  closed: "Jelentkezés lezárva",
};

export const INVOLVEMENT_LABELS: Record<UserDebateListItem["involvement"], string> = {
  initiator: "Indító",
  participant: "Vitázó",
  applicant: "Jelentkező",
};

export function formatUserDebateStatus(item: UserDebateListItem): string {
  if (item.involvement === "initiator" || item.involvement === "participant") {
    return DEBATE_STATUS_LABELS[item.status] ?? item.status.replaceAll("_", " ");
  }

  if (item.application_status) {
    return (
      APPLICATION_STATUS_LABELS[item.application_status] ??
      item.application_status.replaceAll("_", " ")
    );
  }

  return DEBATE_STATUS_LABELS[item.status] ?? item.status.replaceAll("_", " ");
}

export function formatUserDebateRole(item: UserDebateListItem): string {
  const role = INVOLVEMENT_LABELS[item.involvement];
  if (item.involvement === "participant" && item.side) {
    return `${role} (${item.side})`;
  }
  return role;
}

export function sortUserDebates(debates: UserDebateListItem[]): UserDebateListItem[] {
  const priority = (item: UserDebateListItem): number => {
    if (item.application_status === "invited") return 0;
    if (item.involvement === "participant" && item.status === "active") return 1;
    if (item.involvement === "initiator" && item.status === "invitation_pending") {
      return 2;
    }
    if (item.involvement === "participant") return 3;
    if (item.involvement === "initiator") return 4;
    return 5;
  };

  return [...debates].sort((a, b) => {
    const byPriority = priority(a) - priority(b);
    if (byPriority !== 0) return byPriority;
    return b.created_at.localeCompare(a.created_at);
  });
}
