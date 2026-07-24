import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ApiError } from "@/server/api/http";
import {
  callOpenAiContentReview,
  contentReviewResultSchema,
  throwIfContentNotPublishable,
} from "@/server/services/content-review-service";

describe("content-review-service", () => {
  describe("throwIfContentNotPublishable", () => {
    it("passes when approved", () => {
      expect(() =>
        throwIfContentNotPublishable({ status: "approved", issues: [] }),
      ).not.toThrow();
    });

    it("passes when advisory_language", () => {
      expect(() =>
        throwIfContentNotPublishable({
          status: "advisory_language",
          issues: [],
        }),
      ).not.toThrow();
    });

    it("throws revision_required with issues and no suggested rewrite field", () => {
      const issue = {
        excerpt: "Te idióta",
        start: 0,
        end: 9,
        category: "personal_attack",
        rule_reference: "CONTENT_EDITOR §1",
        explanation: "Személyes támadás érv helyett.",
      };

      try {
        throwIfContentNotPublishable({
          status: "revision_required",
          issues: [issue],
        });
        expect.fail("should throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.code).toBe("CONTENT_REVISION_REQUIRED");
        expect(apiError.details).toEqual({
          status: "revision_required",
          issues: [issue],
        });
        expect(JSON.stringify(apiError.details)).not.toMatch(
          /suggested|rewrite|alternative|jav[ií]tott mondat/i,
        );
      }
    });

    it("throws under_review for uncertain or severe cases", () => {
      try {
        throwIfContentNotPublishable({
          status: "under_review",
          issues: [
            {
              excerpt: "Megöllek",
              start: 0,
              end: 8,
              category: "threat",
              rule_reference: "CONTENT_EDITOR §1",
              explanation: "Fenyegetés.",
            },
          ],
        });
        expect.fail("should throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe("CONTENT_UNDER_REVIEW");
      }
    });
  });

  describe("callOpenAiContentReview", () => {
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

    it("returns approved result from OpenAI JSON", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: "approved",
                  issues: [],
                }),
              },
            },
          ],
        }),
      });

      const { result } = await callOpenAiContentReview({
        contextType: "argument",
        text: "Sok érv szól amellett, hogy a döntés helytelen volt.",
      });

      expect(contentReviewResultSchema.parse(result).status).toBe("approved");
    });

    it("fail-closed when OPENAI_API_KEY is missing", async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(
        callOpenAiContentReview({
          contextType: "argument",
          text: "Teszt szöveg.",
        }),
      ).rejects.toMatchObject({
        code: "CONTENT_REVIEW_UNAVAILABLE",
        status: 503,
      });
    });

    it("fail-closed when OpenAI returns HTTP error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => "rate limit",
      });

      await expect(
        callOpenAiContentReview({
          contextType: "argument",
          text: "Teszt szöveg.",
        }),
      ).rejects.toMatchObject({
        code: "CONTENT_REVIEW_UNAVAILABLE",
        status: 503,
      });
    });
  });
});
