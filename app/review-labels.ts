const CATEGORY_LABELS: Record<string, string> = {
  personal_attack: "személyeskedés",
  profanity: "trágárság",
  insult: "sértés",
  harassment: "zaklatás",
  threat: "fenyegetés",
  hate: "gyűlöletkeltés",
  revision_required: "viselkedésszabály-sértés",
};

const RULE_DOC_LABELS: Record<string, string> = {
  CONTENT_EDITOR: "Tartalom-ellenőrzési szabályzat",
  BUSINESS_RULES: "Viselkedésszabályzat",
  MODERATION: "Moderációs szabályzat",
  ABUSE_PREVENTION: "Visszaélés-megelőzési szabályzat",
};

export function formatIssueCategory(category: string | null | undefined): string {
  if (!category?.trim()) return "viselkedésszabály-sértés";
  const key = category.toLowerCase().trim();
  return CATEGORY_LABELS[key] ?? category.replaceAll("_", " ");
}

export function formatRuleReference(ruleReference: string | null | undefined): string {
  const trimmed = ruleReference?.trim() ?? "";
  if (!trimmed) return "Platformszabály";

  const match = trimmed.match(/^([A-Za-z_]+)\s*§\s*(\d+)\s*$/);
  if (match) {
    const docKey = match[1].toUpperCase();
    const section = match[2];
    const docLabel = RULE_DOC_LABELS[docKey];
    if (docLabel) {
      return `${docLabel}, ${section}. pont`;
    }
  }

  return trimmed.replaceAll("_", " ");
}

export function formatContentHash(contentHash: string | null | undefined): string {
  if (!contentHash?.trim()) return "—";
  return `${contentHash.slice(0, 12)}…`;
}
