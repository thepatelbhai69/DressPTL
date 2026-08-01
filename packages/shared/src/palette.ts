/**
 * Style-profile aggregation: turns a pile of per-photo analyses into "this is
 * what you actually like to wear".
 *
 * The interesting product claim is learning favourite colour *blends*, not just
 * favourite colours, so co-occurrence within a single outfit is tracked
 * separately from overall frequency.
 */

import {
  averageHex,
  describeHarmony,
  nearestReferenceColor,
  scoreColorForUndertone,
  REFERENCE_COLORS,
  type HarmonyKind,
  type Temperature,
} from "./color";

export interface AnalyzedColor {
  hex: string;
  prominence: number; // 0-1, share of the outfit this colour occupies
  role?: string;
}

export interface AnalysisLike {
  colors: AnalyzedColor[];
  styleTags?: string[];
  skinUndertone?: Temperature | null;
  bodySilhouette?: string | null;
}

export interface PaletteEntry {
  name: string;
  hex: string;
  weight: number;
  share: number;
  temperature: Temperature;
}

export interface ColorBlend {
  names: [string, string];
  hexes: [string, string];
  weight: number;
  share: number;
  harmony: HarmonyKind;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface StyleProfile {
  palette: PaletteEntry[];
  blends: ColorBlend[];
  styleTags: TagCount[];
  undertone: Temperature | null;
  silhouette: string | null;
  photoCount: number;
}

export interface BuildProfileOptions {
  /** How many colours to keep in the headline palette. */
  paletteSize?: number;
  /** How many blends to keep. */
  blendCount?: number;
  /** Colours per outfit considered when forming blends. */
  colorsPerBlend?: number;
  /**
   * Photos after which an outfit's influence halves. Recent uploads should
   * steer recommendations more than a shirt worn a year ago.
   * Set to 0 to disable recency weighting.
   */
  recencyHalfLife?: number;
}

const DEFAULTS = {
  paletteSize: 6,
  blendCount: 5,
  colorsPerBlend: 3,
  recencyHalfLife: 12,
} as const;

function mode<T extends string>(values: T[]): T | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: T | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * @param analyses Newest first. Order matters for recency weighting.
 */
export function buildStyleProfile(
  analyses: readonly AnalysisLike[],
  options: BuildProfileOptions = {},
): StyleProfile {
  const opts = { ...DEFAULTS, ...options };

  const colorWeights = new Map<string, number>();
  const colorSamples = new Map<string, { hex: string; weight: number }[]>();
  const blendWeights = new Map<string, number>();
  const blendHexes = new Map<string, [string, string]>();
  const tagCounts = new Map<string, number>();
  const undertones: Temperature[] = [];
  const silhouettes: string[] = [];

  analyses.forEach((analysis, index) => {
    const recency =
      opts.recencyHalfLife > 0
        ? Math.pow(0.5, index / opts.recencyHalfLife)
        : 1;

    // --- per-colour frequency ---
    const named: { name: string; hex: string; prominence: number }[] = [];
    for (const color of analysis.colors) {
      const ref = nearestReferenceColor(color.hex);
      if (!ref) continue;
      const prominence = Number.isFinite(color.prominence)
        ? Math.max(0, Math.min(1, color.prominence))
        : 0;
      if (prominence <= 0) continue;

      const weight = prominence * recency;
      colorWeights.set(ref.name, (colorWeights.get(ref.name) ?? 0) + weight);
      const samples = colorSamples.get(ref.name) ?? [];
      samples.push({ hex: color.hex, weight });
      colorSamples.set(ref.name, samples);
      named.push({ name: ref.name, hex: color.hex, prominence });
    }

    // --- blends: unordered pairs among this outfit's leading colours ---
    const leading = [...named]
      .sort((a, b) => b.prominence - a.prominence)
      .filter(
        (entry, i, arr) => arr.findIndex((e) => e.name === entry.name) === i,
      )
      .slice(0, opts.colorsPerBlend);

    for (let i = 0; i < leading.length; i++) {
      for (let j = i + 1; j < leading.length; j++) {
        const a = leading[i]!;
        const b = leading[j]!;
        const key = [a.name, b.name].sort().join(" + ");
        const weight = ((a.prominence + b.prominence) / 2) * recency;
        blendWeights.set(key, (blendWeights.get(key) ?? 0) + weight);
        if (!blendHexes.has(key)) {
          const ordered = a.name < b.name ? [a.hex, b.hex] : [b.hex, a.hex];
          blendHexes.set(key, ordered as [string, string]);
        }
      }
    }

    for (const tag of analysis.styleTags ?? []) {
      const clean = tag.trim().toLowerCase();
      if (clean) tagCounts.set(clean, (tagCounts.get(clean) ?? 0) + 1);
    }
    if (analysis.skinUndertone) undertones.push(analysis.skinUndertone);
    if (analysis.bodySilhouette && analysis.bodySilhouette !== "unknown") {
      silhouettes.push(analysis.bodySilhouette);
    }
  });

  const totalColorWeight = [...colorWeights.values()].reduce((a, b) => a + b, 0);
  const palette: PaletteEntry[] = [...colorWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, opts.paletteSize)
    .map(([name, weight]) => {
      const ref = REFERENCE_COLORS.find((c) => c.name === name)!;
      const representative =
        averageHex(colorSamples.get(name) ?? []) ?? ref.hex;
      return {
        name,
        hex: representative,
        weight,
        share: totalColorWeight > 0 ? weight / totalColorWeight : 0,
        temperature: ref.temperature,
      };
    });

  const totalBlendWeight = [...blendWeights.values()].reduce((a, b) => a + b, 0);
  const blends: ColorBlend[] = [...blendWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, opts.blendCount)
    .map(([key, weight]) => {
      const [nameA, nameB] = key.split(" + ") as [string, string];
      const hexes = blendHexes.get(key)!;
      return {
        names: [nameA, nameB],
        hexes,
        weight,
        share: totalBlendWeight > 0 ? weight / totalBlendWeight : 0,
        harmony: describeHarmony(hexes[0], hexes[1]),
      };
    });

  return {
    palette,
    blends,
    styleTags: [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count })),
    undertone: mode(undertones),
    silhouette: mode(silhouettes),
    photoCount: analyses.length,
  };
}

export interface SuggestedColor {
  name: string;
  hex: string;
  score: number;
  reason: string;
}

/**
 * Deterministic palette expansion: colours the user does not already lean on,
 * ranked by how well they harmonise with their existing favourites and suit
 * their undertone.
 *
 * This runs without the LLM. It gives the recommendation prompt concrete
 * candidates to work with, and doubles as a fallback when the model is
 * unavailable, so the feature degrades instead of breaking.
 */
export function suggestPaletteAdditions(
  profile: StyleProfile,
  count = 3,
): SuggestedColor[] {
  const existing = new Set(profile.palette.map((entry) => entry.name));
  const anchors = profile.palette.slice(0, 3);

  const scored = REFERENCE_COLORS.filter((ref) => !existing.has(ref.name)).map(
    (ref) => {
      const undertoneScore = scoreColorForUndertone(ref.hex, profile.undertone);

      let harmonyScore = 0.5;
      let bestPartner: string | null = null;
      if (anchors.length > 0) {
        let total = 0;
        let best = -1;
        for (const anchor of anchors) {
          const harmony = describeHarmony(ref.hex, anchor.hex);
          const value =
            harmony === "complementary"
              ? 1
              : harmony === "analogous"
                ? 0.85
                : harmony === "triadic"
                  ? 0.75
                  : harmony === "neutral-anchored"
                    ? 0.7
                    : harmony === "monochrome"
                      ? 0.5
                      : 0.4;
          const weighted = value * (0.5 + anchor.share);
          total += weighted;
          if (weighted > best) {
            best = weighted;
            bestPartner = anchor.name;
          }
        }
        harmonyScore = total / anchors.length;
      }

      const score = undertoneScore * 0.5 + harmonyScore * 0.5;
      const reason = bestPartner
        ? `${describeHarmony(
            ref.hex,
            anchors.find((a) => a.name === bestPartner)!.hex,
          )} with your ${bestPartner.toLowerCase()}`
        : "balanced starting point";

      return { name: ref.name, hex: ref.hex, score, reason };
    },
  );

  return scored.sort((a, b) => b.score - a.score).slice(0, count);
}

/** Short human summary used in the dashboard and in the LLM prompt. */
export function summarizeProfile(profile: StyleProfile): string {
  if (profile.photoCount === 0) return "No outfits analysed yet.";

  const colors = profile.palette
    .slice(0, 3)
    .map((entry) => entry.name.toLowerCase())
    .join(", ");
  const blend = profile.blends[0];
  const parts = [`Leans on ${colors}`];
  if (blend) {
    parts.push(
      `most often pairing ${blend.names[0].toLowerCase()} with ${blend.names[1].toLowerCase()}`,
    );
  }
  if (profile.undertone) parts.push(`${profile.undertone} undertone`);
  return parts.join(", ") + ".";
}
