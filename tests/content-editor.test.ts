import { describe, expect, it } from "vitest";
import {
  formatParticipantContent,
  normalizeEditorFields,
  parseLegacyOrEditorBody,
} from "@/server/content-editor";

describe("content-editor", () => {
  it("formats reasoning with optional quote and source", () => {
    expect(
      formatParticipantContent({
        reasoning: "Saját érvelés.",
        quote: "Idézett szöveg.",
        source: "https://example.com",
      }),
    ).toContain("— Idézet —");
    expect(
      formatParticipantContent({
        reasoning: "Csak érvelés.",
        quote: null,
        source: null,
      }),
    ).toBe("Csak érvelés.");
  });

  it("requires source when quote is present", () => {
    expect(() =>
      normalizeEditorFields({
        reasoning: "Érvelés",
        quote: "Idézet",
        source: null,
      }),
    ).toThrow();
  });

  it("accepts legacy content-only publish body", () => {
    const parsed = parseLegacyOrEditorBody({ content: "Régi mező" });
    expect(parsed.fields.reasoning).toBe("Régi mező");
    expect(parsed.content).toBe("Régi mező");
  });

  it("accepts editor fields in publish body", () => {
    const parsed = parseLegacyOrEditorBody({
      reasoning: "Érvelés",
      quote: "Idézet",
      source: "Forrás",
    });
    expect(parsed.content).toContain("— Idézet —");
    expect(parsed.fields.quote).toBe("Idézet");
  });
});
