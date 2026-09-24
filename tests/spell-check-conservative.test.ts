import { describe, expect, it } from "vitest";
import {
  filterConservativeSpellCheckSuggestions,
  isSpacingOnlySpellFix,
} from "@/server/spell-check-conservative";
import { spellCheckParticipantContent } from "@/server/services/content-review-service";

describe("spell-check-conservative", () => {
  it("engedélyez szóköz-beszúrást, betűk változatlanok", () => {
    expect(isSpacingOnlySpellFix("velermert", "veler mert")).toBe(true);
    expect(isSpacingOnlySpellFix("éErre", "é Erre")).toBe(true);
  });

  it("elutasít szócserét vagy átfogalmazást", () => {
    expect(isSpacingOnlySpellFix("megamrúl", "megamarad")).toBe(false);
    expect(isSpacingOnlySpellFix("jó ötlet", "remek gondolat")).toBe(false);
    expect(isSpacingOnlySpellFix("Szórakoztat", "Szórakoztató")).toBe(false);
  });

  it("filterConservative kiszűri a nem szóköz-javításokat", () => {
    const text = "előtte velermert kellett";
    const filtered = filterConservativeSpellCheckSuggestions(text, [
      {
        original: "velermert",
        suggestion: "veler mert",
        start: 7,
        end: 16,
      },
      {
        original: "kellett",
        suggestion: "kellett volna",
        start: 17,
        end: 24,
      },
    ]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.original).toBe("velermert");
  });

  it("spellCheckParticipantContent nem hív AI-t — csak szóköz", async () => {
    const result = await spellCheckParticipantContent({
      text: "előtte nem fordulhatott volna elő velermert kellett",
    });
    expect(result.suggestions.every((s) => isSpacingOnlySpellFix(s.original, s.suggestion))).toBe(
      true,
    );
    expect(result.suggestions.some((s) => s.original === "velermert")).toBe(true);
  });
});
