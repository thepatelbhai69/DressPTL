/**
 * JSON Schemas for constrained decoding.
 *
 * Workers AI supports structured outputs, which constrains generation to a
 * shape instead of just asking nicely for JSON. That cuts the corrective-retry
 * rate substantially.
 *
 * These mirror the Zod schemas in ./schemas but are deliberately looser —
 * enums and formats are left to Zod. Over-constraining the decoder tends to
 * make small models stall or emit padding rather than fail cleanly, and Zod is
 * still the authority on what gets persisted.
 */

export const PHOTO_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    garments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          colors: { type: "array", items: { type: "string" } },
          pattern: { type: "string" },
          fit: { type: "string" },
        },
        required: ["type", "colors"],
      },
    },
    colors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          hex: { type: "string" },
          name: { type: "string" },
          prominence: { type: "number" },
          role: { type: "string" },
        },
        required: ["hex", "prominence"],
      },
    },
    colorHarmony: { type: "string" },
    skinUndertone: { type: ["string", "null"] },
    bodySilhouette: { type: "string" },
    styleTags: { type: "array", items: { type: "string" } },
  },
  required: ["garments", "colors", "skinUndertone", "bodySilhouette", "styleTags"],
} as const;

export const RECOMMENDATIONS_JSON_SCHEMA = {
  type: "object",
  properties: {
    outfits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          occasion: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                garment: { type: "string" },
                colorName: { type: "string" },
                colorHex: { type: "string" },
              },
              required: ["garment", "colorName", "colorHex"],
            },
          },
          rationale: { type: "string" },
          silhouetteNote: { type: "string" },
        },
        required: ["title", "occasion", "items", "rationale"],
      },
    },
  },
  required: ["outfits"],
} as const;
