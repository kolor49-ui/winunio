import type { MissingSpaceSuggestion } from "@/server/missing-space-detection";

/**
 * Szóköz-javítás: ugyanazok a betűk, csak szóköz kerül be vagy ki.
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
