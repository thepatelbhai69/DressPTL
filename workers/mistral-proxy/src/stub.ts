/**
 * Deterministic offline responses used when MISTRAL_STUB=1.
 *
 * Without this you cannot run the app at all without a paid API key, which
 * makes local development and CI impossible. Results are derived from the
 * image bytes so different photos yield different palettes — enough to
 * exercise palette learning and blend detection end to end.
 */

import {
  REFERENCE_COLORS,
  type PhotoAnalysis,
  type StyleProfile,
} from "@dressptl/shared";

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 97) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const UNDERTONES = ["warm", "cool", "neutral"] as const;
const SILHOUETTES = ["rectangle", "triangle", "hourglass", "oval"] as const;
const GARMENTS = ["shirt", "jacket", "trousers", "dress", "knit"];
const TAGS = ["smart-casual", "minimalist", "streetwear", "classic", "relaxed"];

export function stubAnalysis(imageBase64: string): PhotoAnalysis {
  const seed = hash(imageBase64);
  const primary = REFERENCE_COLORS[seed % REFERENCE_COLORS.length]!;
  const secondary =
    REFERENCE_COLORS[(seed >> 3) % REFERENCE_COLORS.length] ??
    REFERENCE_COLORS[0]!;
  const accent =
    REFERENCE_COLORS[(seed >> 7) % REFERENCE_COLORS.length] ??
    REFERENCE_COLORS[1]!;

  return {
    garments: [
      {
        type: GARMENTS[seed % GARMENTS.length]!,
        colors: [primary.hex],
        pattern: undefined,
        fit: undefined,
      },
      {
        type: GARMENTS[(seed >> 2) % GARMENTS.length]!,
        colors: [secondary.hex],
        pattern: undefined,
        fit: undefined,
      },
    ],
    colors: [
      { hex: primary.hex, name: primary.name, prominence: 0.5, role: "dominant" },
      { hex: secondary.hex, name: secondary.name, prominence: 0.3, role: "neutral" },
      { hex: accent.hex, name: accent.name, prominence: 0.2, role: "accent" },
    ],
    colorHarmony: `${primary.name} anchors the look with ${secondary.name.toLowerCase()} support.`,
    skinUndertone: UNDERTONES[seed % UNDERTONES.length]!,
    bodySilhouette: SILHOUETTES[seed % SILHOUETTES.length]!,
    styleTags: [TAGS[seed % TAGS.length]!, TAGS[(seed >> 5) % TAGS.length]!],
  };
}

const DEPTHS = ["light", "medium", "deep"] as const;
const CONTRASTS = ["low", "medium", "high"] as const;

/** Deterministic skin reading so the season flow can be exercised offline. */
export function stubSkinAnalysis(imageBase64: string) {
  const seed = hash(imageBase64);
  return {
    undertone: UNDERTONES[seed % UNDERTONES.length]!,
    depth: DEPTHS[(seed >> 3) % DEPTHS.length]!,
    contrast: CONTRASTS[(seed >> 6) % CONTRASTS.length]!,
    confidence: "medium" as const,
    dominantSkinHex: "#C8A07E",
    note: "Stubbed analysis — no model was called.",
  };
}

export function stubRecommendations(
  profile: StyleProfile,
  count: number,
  suggested: ReadonlyArray<{ name: string; hex: string; reason: string }>,
) {
  const base = profile.palette.length > 0 ? profile.palette : [
    { name: "Navy", hex: "#1F305E", weight: 1, share: 1, temperature: "cool" as const },
  ];

  const outfits = Array.from({ length: count }, (_, index) => {
    const anchor = base[index % base.length]!;
    const partner = suggested[index % Math.max(suggested.length, 1)];
    return {
      title: `${anchor.name} everyday look ${index + 1}`,
      occasion: ["weekend", "office", "evening", "travel"][index % 4]!,
      items: [
        { garment: "overshirt", colorName: anchor.name, colorHex: anchor.hex },
        {
          garment: "trousers",
          colorName: partner?.name ?? "Charcoal",
          colorHex: partner?.hex ?? "#36454F",
        },
      ],
      rationale: `Built around ${anchor.name.toLowerCase()}, which is ${(anchor.share * 100).toFixed(0)}% of your wardrobe colour.`,
      silhouetteNote: profile.silhouette
        ? `Cut to suit a ${profile.silhouette} silhouette.`
        : undefined,
    };
  });

  return { outfits };
}
