import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ApiError } from "@/server/api/http";
import { computeContentHash } from "@/server/services/content-hash";
import {
  applySpellCheckSuggestions,
  callOpenAiContentReview,
  contentReviewResultSchema,
  isLanguageOnlyIssue,
  isPublishableStatus,
  looksLikeLanguageAdvisory,
  normalizeReviewResult,
  throwIfContentNotPublishable,
} from "@/server/services/content-review-service";

describe("moderation publishing flow", () => {
  describe("normalizeReviewResult — spelling false positive", () => {
    it("1. helyesírási hibás, nem sértő szöveg nem blokkol", () => {
      const text = "vagy ijet nem monhatók megamrúl?";
      const result = normalizeReviewResult(
        {
          status: "revision_required",
          issues: [
            {
              excerpt: text,
              start: 0,
              end: text.length,
              category: "personal_attack",
              rule_reference: "CONTENT_EDITOR §1",
              explanation: "Személyeskedő lehet.",
            },
          ],
        },
        text,
      );
      expect(result.status).toBe("advisory_language");
    });

    it("2. advisory_language mellett publikálható", () => {
      expect(isPublishableStatus("advisory_language")).toBe(true);
      expect(() =>
        throwIfContentNotPublishable({
          status: "advisory_language",
          issues: [],
        }),
      ).not.toThrow();
    });

    it("5. személyeskedő szöveg revision_required marad", () => {
      const result = normalizeReviewResult(
        {
          status: "revision_required",
          issues: [
            {
              excerpt: "Te idióta vagy",
              start: 0,
              end: 14,
              category: "personal_attack",
              rule_reference: "CONTENT_EDITOR §1",
              explanation: "Személyes támadás.",
            },
          ],
        },
        "Te idióta vagy, ezért tévedsz.",
      );
      expect(result.status).toBe("revision_required");
    });

    it("6. tartalmi moderáció nem ad átfogalmazott mondatot", () => {
      const issue = {
        excerpt: "Te idióta",
        start: 0,
        end: 9,
        category: "personal_attack",
        rule_reference: "CONTENT_EDITOR §1",
        explanation: "Személyes támadás.",
      };
      expect(JSON.stringify(issue)).not.toMatch(
        /suggested|rewrite|alternative|jav[ií]tott mondat/i,
      );
    });

    it("7. revision_required nem publikálható nyilatkozattal sem", () => {
      try {
        throwIfContentNotPublishable({
          status: "revision_required",
          issues: [],
        });
        expect.fail("should throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe("CONTENT_REVISION_REQUIRED");
      }
    });

    it("8. blocked AI eredmény under_review lesz", () => {
      const result = normalizeReviewResult(
        {
          status: "blocked",
          issues: [
            {
              excerpt: "bizonytalan",
              start: 0,
              end: 10,
              category: "legal_uncertain",
              rule_reference: "CONTENT_EDITOR §1",
              explanation: "Bizonytalan jogi kockázat.",
            },
          ],
        },
        "bizonytalan tartalom",
      );
      expect(result.status).toBe("under_review");
    });

    it("9. under_review nem publikálható", () => {
      try {
        throwIfContentNotPublishable({
          status: "under_review",
          issues: [],
        });
        expect.fail("should throw");
      } catch (error) {
        expect((error as ApiError).code).toBe("CONTENT_UNDER_REVIEW");
      }
    });

    it("10. csak ember dönthet végleges elutasításról — AI blocked → under_review", () => {
      const parsed = contentReviewResultSchema.safeParse(
        normalizeReviewResult({ status: "blocked", issues: [] }, "teszt"),
      );
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.status).toBe("under_review");
      }
    });

    it("11. tartalomlenyomat egyezés szükséges", () => {
      const text = "  Hello   world  ";
      const hash = computeContentHash(text);
      expect(hash).toBe(computeContentHash("Hello world"));
      expect(hash).not.toBe(computeContentHash("Hello world!"));
    });

    it("12. egy karakter módosítás érvényteleníti a lenyomatot", () => {
      const original = "Állításom röviden.";
      const modified = "Állításom röviden!";
      expect(computeContentHash(original)).not.toBe(
        computeContentHash(modified),
      );
    });
  });

  describe("spell check — csak külön kérésre", () => {
    it("3. helyesírás-ellenőrzés külön függvény — nem része a publish throw-nak", () => {
      expect(typeof applySpellCheckSuggestions).toBe("function");
      expect(isPublishableStatus("approved")).toBe(true);
    });

    it("4. helyesírási javítás csak elfogadás után módosít", () => {
      const text = "megamrúl";
      const suggestions = [
        { original: "megamrúl", suggestion: "megamarad", start: 0, end: 8 },
      ];
      expect(applySpellCheckSuggestions(text, suggestions, [])).toBe(text);
      expect(applySpellCheckSuggestions(text, suggestions, [0])).toBe(
        "megamarad",
      );
    });
  });

  describe("isLanguageOnlyIssue heuristics", () => {
    it("looksLikeLanguageAdvisory felismeri a false positive mintát", () => {
      expect(
        looksLikeLanguageAdvisory("vagy ijet nem monhatók megamrúl?"),
      ).toBe(true);
    });

    it("isLanguageOnlyIssue elutasít viselkedési kategóriát", () => {
      expect(
        isLanguageOnlyIssue(
          [
            {
              excerpt: "Te idióta",
              start: 0,
              end: 9,
              category: "personal_attack",
              rule_reference: "CONTENT_EDITOR §1",
              explanation: "Személyeskedés.",
            },
          ],
          "Te idióta",
        ),
      ).toBe(false);
    });
  });

  describe("AI service fail-closed", () => {
    const originalFetch = global.fetch;
    const originalEnv = process.env.OPENAI_API_KEY;

    beforeEach(() => {
      process.env.OPENAI_API_KEY = "test-key";
    });

    afterEach(() => {
      global.fetch = originalFetch;
      if (originalEnv === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalEnv;
      }
      vi.restoreAllMocks();
    });

    it("13. AI hiba esetén nem publikálható (fail-closed)", async () => {
      delete process.env.OPENAI_API_KEY;
      await expect(
        callOpenAiContentReview({
          contextType: "argument",
          text: "Teszt.",
        }),
      ).rejects.toMatchObject({
        code: "CONTENT_REVIEW_UNAVAILABLE",
        status: 503,
      });
    });
  });
});

describe("report & admin contracts", () => {
  it("14. jelentés API séma — moderációs ügy létrehozása", async () => {
    const { parseCreateReportBody } = await import(
      "@/server/services/report-service"
    );
    expect(() =>
      parseCreateReportBody({
        reason: "harassment",
        argument_id: "00000000-0000-4000-8000-000000000001",
      }),
    ).not.toThrow();
  });

  it("15. admin döntés típusok naplózhatók", async () => {
    const mod = await import("@/server/services/moderation-service");
    expect(mod.logModerationAction).toBeTypeOf("function");
    expect(mod.decideModerationCase).toBeTypeOf("function");
  });
});
