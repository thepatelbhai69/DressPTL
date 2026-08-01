import { describe, expect, it } from "vitest";
import {
  assertNoSensitiveFields,
  photoAnalysisSchema,
  SensitiveFieldError,
  outfitRecommendationSchema,
} from "../schemas";

const validAnalysis = {
  garments: [{ type: "blazer", colors: ["#1F305E"] }],
  colors: [{ hex: "#1F305E", prominence: 0.7, role: "dominant" }],
  skinUndertone: "cool",
  bodySilhouette: "rectangle",
  styleTags: ["smart-casual"],
};

describe("photoAnalysisSchema", () => {
  it("accepts a well-formed analysis and applies defaults", () => {
    const parsed = photoAnalysisSchema.parse({
      colors: [{ hex: "#1F305E", prominence: 0.7 }],
    });
    expect(parsed.garments).toEqual([]);
    expect(parsed.styleTags).toEqual([]);
    expect(parsed.skinUndertone).toBeNull();
    expect(parsed.bodySilhouette).toBe("unknown");
  });

  it("rejects a protected-attribute field if the model volunteers one", () => {
    const result = photoAnalysisSchema.safeParse({
      ...validAnalysis,
      ethnicity: "South Asian",
    });
    expect(result.success).toBe(false);
  });

  it("rejects malformed hex so bad colours never reach the palette maths", () => {
    expect(
      photoAnalysisSchema.safeParse({
        colors: [{ hex: "navy", prominence: 0.5 }],
      }).success,
    ).toBe(false);
  });

  it("rejects prominence outside 0-1", () => {
    expect(
      photoAnalysisSchema.safeParse({
        colors: [{ hex: "#1F305E", prominence: 4 }],
      }).success,
    ).toBe(false);
  });

  it("requires at least one colour", () => {
    expect(photoAnalysisSchema.safeParse({ colors: [] }).success).toBe(false);
  });

  it("constrains undertone to colour temperature words only", () => {
    expect(
      photoAnalysisSchema.safeParse({
        ...validAnalysis,
        skinUndertone: "olive-mediterranean",
      }).success,
    ).toBe(false);
  });
});

describe("assertNoSensitiveFields", () => {
  it("passes clean output", () => {
    expect(() => assertNoSensitiveFields(validAnalysis)).not.toThrow();
  });

  it("catches a disallowed key nested deep in the response", () => {
    expect(() =>
      assertNoSensitiveFields({ a: { b: [{ ethnicity: "x" }] } }),
    ).toThrow(SensitiveFieldError);
  });

  it("normalises key spelling before matching", () => {
    expect(() => assertNoSensitiveFields({ "National-Origin": "x" })).toThrow(
      SensitiveFieldError,
    );
    expect(() => assertNoSensitiveFields({ skin_color: "x" })).toThrow(
      SensitiveFieldError,
    );
  });

  it("does not false-positive on ordinary wardrobe words", () => {
    expect(() =>
      assertNoSensitiveFields({ garment: "coat", colorName: "Sage" }),
    ).not.toThrow();
  });
});

describe("outfitRecommendationSchema", () => {
  it("requires each item to carry a real hex", () => {
    expect(
      outfitRecommendationSchema.safeParse({
        title: "Weekend layers",
        occasion: "weekend",
        items: [{ garment: "jacket", colorName: "Camel", colorHex: "camel" }],
        rationale: "Builds on the warm neutrals already in rotation.",
      }).success,
    ).toBe(false);
  });

  it("accepts a complete recommendation", () => {
    expect(
      outfitRecommendationSchema.safeParse({
        title: "Weekend layers",
        occasion: "weekend",
        items: [{ garment: "jacket", colorName: "Camel", colorHex: "#C19A6B" }],
        rationale: "Builds on the warm neutrals already in rotation.",
        silhouetteNote: "Hits at the hip to lengthen the leg line.",
      }).success,
    ).toBe(true);
  });
});
