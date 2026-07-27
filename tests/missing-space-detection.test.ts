import { describe, expect, it } from "vitest";
import {
  augmentWithMissingSpaceAdvisory,
  normalizeReviewResult,
} from "@/server/services/content-review-service";
import { detectMissingSpaceSuggestions } from "@/server/missing-space-detection";

describe("missing-space-detection", () => {
  it("felismeri a kisbetű–nagybetű összeérését", () => {
    const text =
      "ami újra értelmet ad az életénekéErre vannak olyan példák";
    const suggestions = detectMissingSpaceSuggestions(text);
    expect(suggestions.some((s) => s.original.includes("éErre"))).toBe(true);
    expect(
      suggestions.find((s) => s.original.includes("éErre"))?.suggestion,
    ).toMatch(/é Erre/);
  });

  it("felismeri az összeérő partikulát a token végén", () => {
    const text = "kellett újraépíteni az életétámeg kellett találnia";
    const suggestions = detectMissingSpaceSuggestions(text);
    expect(suggestions.some((s) => s.original === "életétámeg")).toBe(true);
    expect(suggestions.find((s) => s.original === "életétámeg")?.suggestion).toBe(
      "életétá meg",
    );
  });

  it("felismeri a mert előtti összeérő szavakat", () => {
    const text = "előtte nem fordulhatott volna elő velermert kellett hozzá";
    const suggestions = detectMissingSpaceSuggestions(text);
    expect(suggestions.some((s) => s.original === "velermert")).toBe(true);
    expect(suggestions.find((s) => s.original === "velermert")?.suggestion).toBe(
      "veler mert",
    );
  });

  it("felismeri az idézőjel előtti hiányzó szóközt", () => {
    const text = 'hogy "csak azért is"I ami előtte';
    const suggestions = detectMissingSpaceSuggestions(text);
    expect(suggestions.some((s) => s.original === 'is"I')).toBe(true);
    expect(suggestions.find((s) => s.original === 'is"I')?.suggestion).toBe(
      'is "I',
    );
  });

  it("közzétételi tanács advisory_language státuszt ad approved felett", () => {
    const text = "kellett újraépíteni az életétámeg kellett találnia";
    const result = augmentWithMissingSpaceAdvisory(
      { status: "approved", issues: [] },
      text,
    );
    expect(result.status).toBe("advisory_language");
    expect(result.issues.some((i) => /szóköz/i.test(i.explanation))).toBe(true);
  });

  it("normalizeReviewResult is hozzáadja a hiányzó szóköz jelzést", () => {
    const text = "előtte nem fordulhatott volna elő velermert kellett";
    const result = normalizeReviewResult({ status: "approved", issues: [] }, text);
    expect(result.status).toBe("advisory_language");
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("nem változtat revision_required viselkedési sértésnél", () => {
    const text = "Te idióta vagy velermert kellett";
    const result = normalizeReviewResult(
      {
        status: "revision_required",
        issues: [
          {
            excerpt: "Te idióta",
            start: 0,
            end: 9,
            category: "personal_attack",
            rule_reference: "CONTENT_EDITOR §1",
            explanation: "Személyes támadás.",
          },
        ],
      },
      text,
    );
    expect(result.status).toBe("revision_required");
  });
});
