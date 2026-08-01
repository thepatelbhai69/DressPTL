/**
 * Prompt construction for the Mistral calls.
 *
 * Kept out of the Worker so the exact wording is unit-testable — in particular
 * the guardrails, which are a product requirement rather than a nicety.
 */

import type { StyleProfile } from "./palette";
import { summarizeProfile } from "./palette";

/**
 * Constraints repeated in both prompts. Ethnicity inference is the thing we
 * explicitly promised not to do, so it is stated as a hard rule rather than
 * left to the model's defaults.
 */
export const GUARDRAILS = [
  "Describe only what is visibly worn and the colours present.",
  "Do NOT infer or mention ethnicity, race, nationality, national origin, age, gender, religion, or disability.",
  "Do NOT identify the person or guess who they are.",
  "skinUndertone must describe ONLY colour temperature of visible skin (warm/cool/neutral) for colour-matching purposes. If skin is not clearly visible, use null.",
  "bodySilhouette must be one of: rectangle, triangle, inverted-triangle, hourglass, oval, unknown. Use unknown if unclear.",
].join("\n- ");

export function buildAnalysisPrompt(): string {
  return `You are a wardrobe colour analyst. Analyse the outfit in this photo.

Rules:
- ${GUARDRAILS}

Return ONLY a JSON object with exactly these keys:
{
  "garments": [{ "type": "string", "colors": ["#rrggbb"], "pattern": "string (optional)", "fit": "string (optional)" }],
  "colors": [{ "hex": "#rrggbb", "name": "string (optional)", "prominence": 0.0-1.0, "role": "dominant|accent|neutral|background" }],
  "colorHarmony": "one sentence on how the colours work together",
  "skinUndertone": "warm|cool|neutral|null",
  "bodySilhouette": "rectangle|triangle|inverted-triangle|hourglass|oval|unknown",
  "styleTags": ["lowercase style descriptors, e.g. smart-casual, minimalist"]
}

"prominence" values across "colors" should roughly sum to 1.0.
Include between 1 and 12 colours. Add no keys beyond those listed.`;
}

export function buildRecommendationPrompt(input: {
  profile: StyleProfile;
  heightCm?: number | null;
  count: number;
  suggestedColors: ReadonlyArray<{ name: string; hex: string; reason: string }>;
}): string {
  const { profile, heightCm, count, suggestedColors } = input;

  const palette = profile.palette
    .map(
      (entry) =>
        `- ${entry.name} (${entry.hex}), ${(entry.share * 100).toFixed(0)}% of their wardrobe colour`,
    )
    .join("\n");

  const blends = profile.blends
    .map(
      (blend) =>
        `- ${blend.names[0]} + ${blend.names[1]} (${blend.harmony}), ${(blend.share * 100).toFixed(0)}% of their pairings`,
    )
    .join("\n");

  const candidates = suggestedColors
    .map((color) => `- ${color.name} (${color.hex}) — ${color.reason}`)
    .join("\n");

  const facts = [
    `Summary: ${summarizeProfile(profile)}`,
    profile.undertone
      ? `Skin undertone (colour temperature only): ${profile.undertone}`
      : "Skin undertone: unknown",
    profile.silhouette
      ? `Body silhouette: ${profile.silhouette}`
      : "Body silhouette: unknown",
    heightCm ? `Height: ${heightCm} cm` : "Height: not provided",
    profile.styleTags.length > 0
      ? `Style tags they wear most: ${profile.styleTags.map((t) => t.tag).join(", ")}`
      : "Style tags: none recorded",
  ].join("\n");

  return `You are a personal stylist. Recommend ${count} new outfits for someone with the wardrobe profile below.

${facts}

Their most-worn colours:
${palette || "- (none yet)"}

Their favourite colour pairings:
${blends || "- (none yet)"}

Colours that would extend their palette well:
${candidates || "- (none suggested)"}

Rules:
- ${GUARDRAILS}
- Build on their existing favourite colours and pairings; introduce at most one new colour per outfit.
- Use the height and silhouette only to comment on cut, proportion, and length.
- Every colorHex must be a real hex value matching its colorName.

Return ONLY a JSON object:
{
  "outfits": [
    {
      "title": "short name for the look",
      "occasion": "e.g. weekend, office, evening",
      "items": [{ "garment": "string", "colorName": "string", "colorHex": "#rrggbb" }],
      "rationale": "why this suits their learned preferences",
      "silhouetteNote": "optional note on cut/proportion"
    }
  ]
}

Return exactly ${count} outfits. Add no keys beyond those listed.`;
}
