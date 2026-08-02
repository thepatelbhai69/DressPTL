/**
 * Wire contracts shared by the web app and the Mistral proxy Worker.
 *
 * These schemas are the enforcement point for the privacy rule: the model is
 * told not to report ethnicity/race/age/gender, and `.strict()` plus
 * `assertNoSensitiveFields` make that a hard failure rather than a hope.
 */

import { z } from "zod";
import { HARMONY_KINDS } from "./color";

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const undertoneSchema = z.enum(["warm", "cool", "neutral"]);
export type Undertone = z.infer<typeof undertoneSchema>;

export const silhouetteSchema = z.enum([
  "rectangle",
  "triangle",
  "inverted-triangle",
  "hourglass",
  "oval",
  "unknown",
]);
export type Silhouette = z.infer<typeof silhouetteSchema>;

export const analyzedColorSchema = z
  .object({
    hex: z.string().regex(HEX_COLOR, "expected #rrggbb"),
    name: z.string().max(40).optional(),
    prominence: z.number().min(0).max(1),
    role: z.enum(["dominant", "accent", "neutral", "background"]).optional(),
  })
  .strict();

export const garmentSchema = z
  .object({
    type: z.string().min(1).max(60),
    colors: z.array(z.string().regex(HEX_COLOR)).max(6).default([]),
    pattern: z.string().max(40).optional(),
    fit: z.string().max(40).optional(),
  })
  .strict();

/** What the vision model must return for a single photo. */
export const photoAnalysisSchema = z
  .object({
    garments: z.array(garmentSchema).max(20).default([]),
    colors: z.array(analyzedColorSchema).min(1).max(12),
    colorHarmony: z.string().max(400).optional(),
    skinUndertone: undertoneSchema.nullable().default(null),
    bodySilhouette: silhouetteSchema.default("unknown"),
    styleTags: z.array(z.string().min(1).max(30)).max(12).default([]),
  })
  .strict();
export type PhotoAnalysis = z.infer<typeof photoAnalysisSchema>;

export const analyzePhotoRequestSchema = z
  .object({
    imageBase64: z.string().min(1),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  })
  .strict();
export type AnalyzePhotoRequest = z.infer<typeof analyzePhotoRequestSchema>;

export const depthSchema = z.enum(["light", "medium", "deep"]);
export const contrastSchema = z.enum(["low", "medium", "high"]);
export const confidenceSchema = z.enum(["low", "medium", "high"]);

/**
 * What the vision model may report about a person's colouring.
 *
 * Note what is absent and enforced absent: this is a colour measurement, not a
 * description of who someone is. `.strict()` rejects anything the model tries
 * to add, and `assertNoSensitiveFields` runs over the raw output first.
 */
export const skinAnalysisSchema = z
  .object({
    undertone: undertoneSchema.nullable().default(null),
    depth: depthSchema.nullable().default(null),
    contrast: contrastSchema.nullable().default(null),
    confidence: confidenceSchema.default("low"),
    /** Average skin colour, used only to detect a lighting cast. */
    dominantSkinHex: z.string().regex(HEX_COLOR).optional(),
    note: z.string().max(300).optional(),
  })
  .strict();
export type SkinAnalysisResult = z.infer<typeof skinAnalysisSchema>;

export const paletteEntrySchema = z
  .object({
    name: z.string(),
    hex: z.string().regex(HEX_COLOR),
    weight: z.number(),
    share: z.number(),
    temperature: undertoneSchema,
  })
  .strict();

export const colorBlendSchema = z
  .object({
    names: z.tuple([z.string(), z.string()]),
    hexes: z.tuple([
      z.string().regex(HEX_COLOR),
      z.string().regex(HEX_COLOR),
    ]),
    weight: z.number(),
    share: z.number(),
    harmony: z.enum(HARMONY_KINDS),
  })
  .strict();

export const styleProfileSchema = z
  .object({
    palette: z.array(paletteEntrySchema),
    blends: z.array(colorBlendSchema),
    styleTags: z.array(
      z.object({ tag: z.string(), count: z.number() }).strict(),
    ),
    undertone: undertoneSchema.nullable(),
    silhouette: z.string().nullable(),
    photoCount: z.number(),
  })
  .strict();

export const recommendationItemSchema = z
  .object({
    garment: z.string().min(1).max(80),
    colorName: z.string().min(1).max(40),
    colorHex: z.string().regex(HEX_COLOR),
  })
  .strict();

export const outfitRecommendationSchema = z
  .object({
    title: z.string().min(1).max(80),
    occasion: z.string().min(1).max(60),
    items: z.array(recommendationItemSchema).min(1).max(8),
    rationale: z.string().min(1).max(400),
    silhouetteNote: z.string().max(300).optional(),
  })
  .strict();
export type OutfitRecommendation = z.infer<typeof outfitRecommendationSchema>;

export const recommendationsResponseSchema = z
  .object({
    outfits: z.array(outfitRecommendationSchema).min(1).max(8),
  })
  .strict();

export const generateRecommendationsRequestSchema = z
  .object({
    profile: styleProfileSchema,
    heightCm: z.number().int().min(100).max(250).nullable().optional(),
    count: z.number().int().min(1).max(6).default(4),
    suggestedColors: z
      .array(
        z
          .object({
            name: z.string(),
            hex: z.string().regex(HEX_COLOR),
            reason: z.string(),
          })
          .strict(),
      )
      .max(6)
      .default([]),
  })
  .strict();
export type GenerateRecommendationsRequest = z.infer<
  typeof generateRecommendationsRequestSchema
>;

/**
 * Field names that must never appear in model output or be persisted.
 * `.strict()` already rejects unknown top-level keys; this catches them if they
 * turn up nested inside a free-text blob or a future loosened schema.
 */
export const SENSITIVE_KEYS = Object.freeze([
  "ethnicity",
  "race",
  "nationality",
  "nativity",
  "national_origin",
  "nationalorigin",
  "skincolor",
  "skin_color",
  "age",
  "gender",
  "sex",
  "religion",
  "disability",
]);

export class SensitiveFieldError extends Error {
  constructor(public readonly key: string) {
    super(`Model output contained a disallowed field: ${key}`);
    this.name = "SensitiveFieldError";
  }
}

/** Deep-scan a parsed JSON value for disallowed keys. Throws on the first hit. */
export function assertNoSensitiveFields(value: unknown, depth = 0): void {
  if (depth > 8 || value === null || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const item of value) assertNoSensitiveFields(item, depth + 1);
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[\s-]/g, "_");
    if (SENSITIVE_KEYS.includes(normalized)) throw new SensitiveFieldError(key);
    assertNoSensitiveFields(nested, depth + 1);
  }
}
