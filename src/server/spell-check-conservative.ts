import type { MissingSpaceSuggestion } from "@/server/missing-space-detection";

/**
 * Helyesírás-javaslat csak akkor engedélyezett, ha a betűk sorrendje változatlan —
 * legfeljebb szóköz / központozás előtti térköz kerül be. Nincs szócsere, nincs átfogalmazás.
 */
export function isSpacingOnlySpellFix(original: string, suggestion: string): boolean {
  const strip = (value: string) =>
    value.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  return strip(original) === strip(suggestion);
}

export function filterConservativeSpellCheckSuggestions(
  text: string,
  suggestions: MissingSpaceSuggestion[],
): MissingSpaceSuggestion[] {
  return suggestions.filter((s) => {
    if (s.end <= s.start) return false;
    if (s.original === s.suggestion) return false;
    const slice = text.slice(s.start, s.end);
    if (slice !== s.original) return false;
    return isSpacingOnlySpellFix(s.original, s.suggestion);
  });
}
