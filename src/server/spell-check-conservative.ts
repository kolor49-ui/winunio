import type { MissingSpaceSuggestion } from "@/server/missing-space-detection";

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j]! + 1,
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

/**
 * Szóköz-javítás: ugyanazok a betűk, csak szóköz kerül be vagy ki.
 */
export function isSpacingOnlySpellFix(original: string, suggestion: string): boolean {
  const strip = (value: string) =>
    value.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  return strip(original) === strip(suggestion);
}

/**
 * Egy szó konzervatív elütés- vagy ékezet-javítása — nem átfogalmazás.
 */
export function isConservativeTypoFix(original: string, suggestion: string): boolean {
  if (original.includes(" ") || suggestion.includes(" ")) return false;
  if (original === suggestion) return false;

  const o = original.normalize("NFKC");
  const s = suggestion.normalize("NFKC");
  const oNorm = o.toLowerCase();
  const sNorm = s.toLowerCase();

  if (stripAccents(oNorm) === stripAccents(sNorm) && oNorm !== sNorm) {
    return true;
  }

  const maxLen = Math.max(o.length, s.length);
  const minLen = Math.min(o.length, s.length);
  const lenDiff = Math.abs(o.length - s.length);

  if (minLen >= 6 && lenDiff > 2) return false;
  if (maxLen > 12 && lenDiff > 1) return false;

  const dist = levenshtein(oNorm, sNorm);
  if (dist > 2) return false;

  if (maxLen <= 5) return true;
  if (maxLen <= 10) return lenDiff <= 2;
  return lenDiff <= 1;
}

export function isConservativeSpellFix(original: string, suggestion: string): boolean {
  if (isSpacingOnlySpellFix(original, suggestion)) {
    const parts = suggestion.split(/\s+/);
    if (parts.length === 2 && parts[1]!.length === 1) return false;
    return true;
  }
  return isConservativeTypoFix(original, suggestion);
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
    return isConservativeSpellFix(s.original, s.suggestion);
  });
}
