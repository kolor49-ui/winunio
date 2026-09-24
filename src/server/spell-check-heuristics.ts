import type { MissingSpaceSuggestion } from "@/server/missing-space-detection";
import { detectMissingSpaceSuggestions } from "@/server/missing-space-detection";
import { filterConservativeSpellCheckSuggestions } from "@/server/spell-check-conservative";

const HU = "a-záéíóöőúüűA-ZÁÉÍÓÖŐÚÜŰ";

const GLUED_PREFIXES = [
  "hogy",
  "mint",
  "mert",
  "ami",
  "amik",
  "amely",
  "amelyek",
  "amikor",
  "amit",
  "ahol",
  "aki",
  "mivel",
  "ha",
  "nem",
  "csak",
  "de",
  "vagy",
  "vele",
  "erre",
  "meg",
] as const;

const GLUED_SUFFIXES = ["az", "ez", "meg", "mert", "hogy", "mint", "is", "és"] as const;

/** Ne bontsuk szét a tipikus magyar végződésű szavakat (pl. alapoktatás). */
const COMPLETE_WORD_SUFFIX =
  /(ás|és|ís|ós|ős|at|et|ot|ut|án|én|on|un|nak|nek|ban|ben|hoz|hez|höz|val|vel|ból|ből|tól|től|ra|re|ról|ről|ság|ség|ás|ként|ként)$/iu;

function addSuggestion(
  suggestions: MissingSpaceSuggestion[],
  seen: Set<string>,
  original: string,
  suggestion: string,
  start: number,
  end: number,
) {
  if (original === suggestion || end <= start) return;
  const key = `${start}:${end}:${original}:${suggestion}`;
  if (seen.has(key)) return;
  seen.add(key);
  suggestions.push({ original, suggestion, start, end });
}

function overlaps(a: MissingSpaceSuggestion, b: MissingSpaceSuggestion): boolean {
  return a.start < b.end && b.start < a.end;
}

function dedupeSuggestions(
  suggestions: MissingSpaceSuggestion[],
): MissingSpaceSuggestion[] {
  const sorted = [...suggestions].sort((a, b) => a.start - b.start);
  const kept: MissingSpaceSuggestion[] = [];
  for (const suggestion of sorted) {
    if (kept.some((existing) => overlaps(existing, suggestion))) continue;
    kept.push(suggestion);
  }
  return kept;
}

/** „alapoktatá s” / „hogyjelentő s” → összefűzés. */
function detectErroneousLetterSplit(text: string): MissingSpaceSuggestion[] {
  const suggestions: MissingSpaceSuggestion[] = [];
  const seen = new Set<string>();
  const re = new RegExp(
    `([^\\s]{4,}[áéíóöőúüű]) s(?=[\\s.,!?;:)]|$)`,
    "gu",
  );

  for (const match of text.matchAll(re)) {
    const left = match[1] ?? "";
    const original = match[0];
    const joined = `${left}s`;
    const index = match.index ?? 0;
    addSuggestion(suggestions, seen, original, joined, index, index + original.length);
  }

  return suggestions;
}

function detectGluedPrefixes(text: string): MissingSpaceSuggestion[] {
  const suggestions: MissingSpaceSuggestion[] = [];
  const seen = new Set<string>();
  const tokenRe = new RegExp(`[${HU}]+`, "gu");

  for (const match of text.matchAll(tokenRe)) {
    const token = match[0];
    const tokenStart = match.index ?? 0;
    if (token.length < 8) continue;

    for (const prefix of GLUED_PREFIXES) {
      if (token.length <= prefix.length + 4) continue;
      if (!token.toLowerCase().startsWith(prefix)) continue;
      const rest = token.slice(prefix.length);
      if (rest.length < 4) continue;
      addSuggestion(
        suggestions,
        seen,
        token,
        `${token.slice(0, prefix.length)} ${rest}`,
        tokenStart,
        tokenStart + token.length,
      );
      break;
    }
  }

  return suggestions;
}

function detectGluedSuffixes(text: string): MissingSpaceSuggestion[] {
  const suggestions: MissingSpaceSuggestion[] = [];
  const seen = new Set<string>();
  const tokenRe = new RegExp(`[${HU}]+`, "gu");

  for (const match of text.matchAll(tokenRe)) {
    const token = match[0];
    const tokenStart = match.index ?? 0;
    if (token.length < 7) continue;

    for (const suffix of GLUED_SUFFIXES) {
      if (token.length <= suffix.length + 5) continue;
      if (!token.toLowerCase().endsWith(suffix)) continue;
      const before = token.slice(0, -suffix.length);
      if (before.length < 5) continue;
      const canSplit =
        suffix === "az" || suffix === "ez"
          ? before.length >= 6 || COMPLETE_WORD_SUFFIX.test(before)
          : COMPLETE_WORD_SUFFIX.test(before);
      if (!canSplit) continue;
      addSuggestion(
        suggestions,
        seen,
        token,
        `${before} ${suffix}`,
        tokenStart,
        tokenStart + token.length,
      );
      break;
    }
  }

  return suggestions;
}

function filterUnsafeHeuristicSplits(
  suggestions: MissingSpaceSuggestion[],
): MissingSpaceSuggestion[] {
  return suggestions.filter((s) => {
    if (!s.suggestion.includes(" ")) return true;
    const [before, after] = s.suggestion.split(/\s+/);
    if (!before || !after) return false;
    if (after.length === 1) return false;
    if (COMPLETE_WORD_SUFFIX.test(before) && after.length <= 3) return false;
    return true;
  });
}

export function spellCheckHungarian(text: string): MissingSpaceSuggestion[] {
  const seen = new Set<string>();
  const all: MissingSpaceSuggestion[] = [];

  for (const s of detectErroneousLetterSplit(text)) {
    addSuggestion(all, seen, s.original, s.suggestion, s.start, s.end);
  }
  for (const s of detectGluedPrefixes(text)) {
    addSuggestion(all, seen, s.original, s.suggestion, s.start, s.end);
  }
  for (const s of detectGluedSuffixes(text)) {
    addSuggestion(all, seen, s.original, s.suggestion, s.start, s.end);
  }
  for (const s of filterUnsafeHeuristicSplits(detectMissingSpaceSuggestions(text))) {
    addSuggestion(all, seen, s.original, s.suggestion, s.start, s.end);
  }

  const deduped = dedupeSuggestions(all);
  return filterConservativeSpellCheckSuggestions(text, deduped);
}
