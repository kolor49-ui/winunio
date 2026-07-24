const MODERATION_SOURCE_LABELS: Record<string, string> = {
  ai_review: "AI-ellenőrzés",
  user_report: "Felhasználói jelentés",
  user_appeal: "Felhasználói fellebbezés",
  admin: "Admin kezdeményezés",
};

const MODERATION_CASE_STATUS_LABELS: Record<string, string> = {
  open: "Nyitott",
  approved: "Jóváhagyva",
  revision_required: "Javítás szükséges",
  rejected: "Elutasítva",
  resolved: "Lezárva",
};

const MODERATION_ACTION_LABELS: Record<string, string> = {
  approve_content: "Tartalom jóváhagyva",
  reject_content: "Tartalom elutasítva",
  return_for_revision: "Visszaküldés javításra",
  hide_content: "Tartalom elrejtve",
  under_review: "Felülvizsgálatra helyezve",
  dismiss_report: "Jelentés elutasítva",
};

const REPORT_REASON_LABELS: Record<string, string> = {
  illegal: "Jogellenes tartalom",
  threat: "Fenyegetés",
  pii: "Személyes adat",
  harassment: "Zaklatás",
  spam: "Spam",
  abuse: "Visszaélés",
};

export function formatModerationSource(source: string): string {
  return MODERATION_SOURCE_LABELS[source] ?? source.replaceAll("_", " ");
}

export function formatModerationCaseStatus(status: string): string {
  return MODERATION_CASE_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

export function formatModerationAction(action: string): string {
  return MODERATION_ACTION_LABELS[action] ?? action.replaceAll("_", " ");
}

export function formatReportReason(reason: string): string {
  return REPORT_REASON_LABELS[reason] ?? reason.replaceAll("_", " ");
}

export function formatAdminDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 16);
  return date.toLocaleString("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
