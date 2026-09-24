import { describe, expect, it } from "vitest";
import {
  isSpacingOnlySpellFix,
} from "@/server/spell-check-conservative";
import { spellCheckHungarian } from "@/server/spell-check-heuristics";

describe("spell-check-heuristics", () => {
  it("nem bontja szét az alapoktatás szót", () => {
    const result = spellCheckHungarian("Az alapoktatás ingyenes.");
    expect(
      result.some((s) => s.original === "alapoktatás" && s.suggestion.includes(" ")),
    ).toBe(false);
  });

  it("összefűzi a tévesen szétválasztott szót", () => {
    const result = spellCheckHungarian("Az alapoktatá s ingyenes.");
    expect(result.some((s) => s.suggestion === "alapoktatás")).toBe(true);
  });

  it("felismeri a hogy + jelentős összeérését", () => {
    const result = spellCheckHungarian("Ez hogyjelentős fejlesztés.");
    expect(result.some((s) => s.suggestion === "hogy jelentős")).toBe(true);
  });

  it("felismeri az alapoktatás + az összeérését", () => {
    const result = spellCheckHungarian("Az alapoktatásaz ingyenes.");
    expect(result.some((s) => s.suggestion === "alapoktatás az")).toBe(true);
  });

  it("minden javaslat csak szóköz — betűk változatlanok", () => {
    const result = spellCheckHungarian(
      "Az alapoktatá s ingyenes, és hogyjelentős fejlesztés.",
    );
    expect(result.length).toBeGreaterThan(0);
    expect(
      result.every((s) => isSpacingOnlySpellFix(s.original, s.suggestion)),
    ).toBe(true);
  });
});
