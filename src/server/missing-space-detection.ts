export type MissingSpaceSuggestion = {
  original: string;
  suggestion: string;
  start: number;
  end: number;
};

const HU_LOWER = "a-záéíóöőúüű";
const HU_UPPER = "A-ZÁÉÍÓÖŐÚÜŰ";
const HU = `${HU_LOWER}${HU_UPPER}`;

/** Gyakori összeérő szótagok / kötőszavak (kisbetűs összehasonlítás). */
const GLUED_FOLLOWERS = [
  "meg",
  "mert",
  "hogy",
  "ami",
  "amik",
  "amely",
  "amelyek",
  "amikor",
  "amit",
  "is",
  "és",
  "de",
  "vagy",
  "vele",
  "erre",
  "nem",
  "csak",
  "mint",
  "ahol",
  "aki",
  "az",
  "ez",
  "mivel",
  "ha",
  "s",
] as const;

/** Ismert összeolvadt szópárok — teljes token cseréje. */
const COMPOUND_GLUE_PATTERNS: Array<{
  pattern: RegExp;
  replace: (match: RegExpMatchArray) => string;
}> = [
  {
    pattern: /^(.*?)(vele)(mert)$/iu,
    replace: (m) => `${m[1] ?? ""}${m[2]} ${m[3]}`,
  },
];

function addSuggestion(
  suggestions: MissingSpaceSuggestion[],
  seen: Set<string>,
  original: string,
  suggestion: string,
  start: number,
  end: number,
) {
  if (original === suggestion || end <= start) return;
  const key = `${start}:${end}:${original}`;
  if (seen.has(key)) return;
  seen.add(key);
  suggestions.push({ original, suggestion, start, end });
}

/**
 * Heurisztikus hiányzó szóköz felismerés — elütés-szerű javaslatokkal.
 * Nem helyettesíti az AI helyesírás-ellenőrzést, de gyorsan jelzi az összeérő szavakat.
 */
export function detectMissingSpaceSuggestions(text: string): MissingSpaceSuggestion[] {
  const suggestions: MissingSpaceSuggestion[] = [];
  const seen = new Set<string>();

  const capitalSplit = new RegExp(`([${HU_LOWER}])([${HU_UPPER}])`, "gu");
  for (const match of text.matchAll(capitalSplit)) {
    const index = match.index ?? 0;
    addSuggestion(
      suggestions,
      seen,
      match[0],
      `${match[1]} ${match[2]}`,
      index,
      index + match[0].length,
    );
  }

  for (const match of text.matchAll(new RegExp(`([.!?])([${HU}])`, "gu"))) {
    const index = match.index ?? 0;
    addSuggestion(
      suggestions,
      seen,
      match[0],
      `${match[1]} ${match[2]}`,
      index,
      index + match[0].length,
    );
  }

  for (const match of text.matchAll(new RegExp(`([""])([${HU}])`, "gu"))) {
    const index = match.index ?? 0;
    addSuggestion(
      suggestions,
      seen,
      match[0],
      `${match[1]} ${match[2]}`,
      index,
      index + match[0].length,
    );
  }

  for (const match of text.matchAll(
    new RegExp(`([${HU_LOWER}]+)([""])([${HU}])`, "gu"),
  )) {
    const index = match.index ?? 0;
    addSuggestion(
      suggestions,
      seen,
      match[0],
      `${match[1]} ${match[2]}${match[3]}`,
      index,
      index + match[0].length,
    );
  }

  const tokenRe = new RegExp(`[^\\s]+`, "gu");
  for (const match of text.matchAll(tokenRe)) {
    const token = match[0];
    const tokenStart = match.index ?? 0;
    if (token.length < 4) continue;

    for (const { pattern, replace } of COMPOUND_GLUE_PATTERNS) {
      const compound = token.match(pattern);
      if (!compound) continue;
      const suggestion = replace(compound);
      if (suggestion !== token) {
        addSuggestion(
          suggestions,
          seen,
          token,
          suggestion,
          tokenStart,
          tokenStart + token.length,
        );
      }
    }

    for (const follower of GLUED_FOLLOWERS) {
      const lowerToken = token.toLowerCase();
      const lowerFollower = follower.toLowerCase();
      const idx = lowerToken.indexOf(lowerFollower);
      if (idx <= 1 || idx + lowerFollower.length !== lowerToken.length) continue;

      const before = token.slice(0, idx);
      if (before.length < 2 || !new RegExp(`^[${HU}]+$`, "u").test(before)) continue;

      const after = token.slice(idx);
      addSuggestion(
        suggestions,
        seen,
        token,
        `${before} ${after}`,
        tokenStart,
        tokenStart + token.length,
      );
      break;
    }
  }

  return suggestions.sort((a, b) => a.start - b.start);
}

export function missingSpaceSuggestionsToReviewIssues(
  suggestions: MissingSpaceSuggestion[],
): Array<{
  excerpt: string;
  start: number;
  end: number;
  category: string;
  rule_reference: string;
  explanation: string;
}> {
  return suggestions.map((s) => ({
    excerpt: s.original,
    start: s.start,
    end: s.end,
    category: "spelling",
    rule_reference: "CONTENT_EDITOR §3",
    explanation: "Hiányzó szóköz — a szavak összeérnek.",
  }));
}

export function mergeSpellCheckSuggestions<T extends MissingSpaceSuggestion>(
  local: T[],
  remote: T[],
): T[] {
  const merged = [...local];
  for (const suggestion of remote) {
    const overlaps = merged.some(
      (existing) =>
        suggestion.start < existing.end && suggestion.end > existing.start,
    );
    if (!overlaps) {
      merged.push(suggestion);
    }
  }
  return merged.sort((a, b) => a.start - b.start);
}
