/**
 * Skin-tone colour analysis — the core of the app.
 *
 * One photo (or a short quiz) yields three coarse readings, and those pick a
 * colour season. The season is the point: "you're a Deep Autumn" is vocabulary
 * people can actually shop with, where "cool undertone, medium depth" is not.
 *
 * What is deliberately NOT here: any inference of ethnicity, race, or
 * nationality. `depth` is how light or dark skin appears in the photo — a
 * measurement colour matching genuinely needs — kept to three coarse buckets
 * rather than a precise value, and always user-correctable.
 */

import {
  hexToHsl,
  hexToLab,
  REFERENCE_COLORS,
  scoreColorForUndertone,
  type Temperature,
} from "./color";

export type Depth = "light" | "medium" | "deep";
export type ContrastLevel = "low" | "medium" | "high";
export type Confidence = "low" | "medium" | "high";

export interface SkinAnalysis {
  /** Colour temperature of the skin. The single most useful reading. */
  undertone: Temperature | null;
  /** How light or dark the skin appears. */
  depth: Depth | null;
  /** Contrast between hair, skin, and eyes. */
  contrast: ContrastLevel | null;
  confidence: Confidence;
  /** Free-text caveat, e.g. strong colour cast in the photo. */
  note?: string;
}

export type SeasonName = "Spring" | "Summer" | "Autumn" | "Winter";

export interface SeasonProfile {
  season: SeasonName;
  tagline: string;
  description: string;
  /** Metal that flatters — the cheapest, most actionable takeaway there is. */
  metals: string;
  neutrals: string[];
  palette: { name: string; hex: string }[];
  avoid: { name: string; hex: string; why: string }[];
}

export const SEASONS: Readonly<Record<SeasonName, SeasonProfile>> = Object.freeze({
  Spring: {
    season: "Spring",
    tagline: "Warm and clear",
    description:
      "Warm undertones with enough lightness to carry fresh, clear colour. Your palette is sunlit rather than earthy — think coral over rust, and ivory over stark white.",
    metals: "Gold, and warm rose gold",
    neutrals: ["Ivory", "Camel", "Warm grey"],
    palette: [
      { name: "Coral", hex: "#FF6F61" },
      { name: "Butter Yellow", hex: "#F3E5AB" },
      { name: "Warm Turquoise", hex: "#3FBFB0" },
      { name: "Peach", hex: "#FFB59E" },
      { name: "Fresh Green", hex: "#7CB342" },
      { name: "Camel", hex: "#C19A6B" },
      { name: "Ivory", hex: "#FFFFF0" },
      { name: "Golden Apricot", hex: "#E8A33D" },
      { name: "Periwinkle", hex: "#8A9BEA" },
      { name: "Salmon Pink", hex: "#F49B87" },
    ],
    avoid: [
      { name: "Black", hex: "#111111", why: "overpowers a light, warm colouring — try chocolate or navy instead" },
      { name: "Charcoal", hex: "#36454F", why: "its coolness dulls the warmth in your skin" },
      { name: "Icy Grey", hex: "#C8CDD2", why: "reads flat and cold next to warm undertones" },
    ],
  },
  Summer: {
    season: "Summer",
    tagline: "Cool and soft",
    description:
      "Cool undertones with gentle contrast. Muted, slightly dusty colours flatter you most — the softness matters as much as the coolness, so blue-greys and powder tones beat anything neon.",
    metals: "Silver, white gold, platinum",
    neutrals: ["Soft white", "Taupe", "Cool grey"],
    palette: [
      { name: "Powder Blue", hex: "#A8C0D6" },
      { name: "Dusty Rose", hex: "#C48793" },
      { name: "Sage", hex: "#9CAF88" },
      { name: "Lavender", hex: "#B57EDC" },
      { name: "Soft Navy", hex: "#3D5068" },
      { name: "Cool Grey", hex: "#9AA1A9" },
      { name: "Mauve", hex: "#9C7A99" },
      { name: "Seafoam", hex: "#93C5B5" },
      { name: "Soft White", hex: "#F3F1EC" },
      { name: "Plum", hex: "#6A2C48" },
    ],
    avoid: [
      { name: "Orange", hex: "#E8703A", why: "its warmth fights your cool undertone" },
      { name: "Mustard", hex: "#D4A017", why: "tends to make cool skin look sallow" },
      { name: "Pure Black", hex: "#111111", why: "harsher than your natural contrast — soft navy does the same job" },
    ],
  },
  Autumn: {
    season: "Autumn",
    tagline: "Warm and rich",
    description:
      "Warm undertones with depth. Earthy, spiced colours suit you — the ones that look drab on other people come alive on you. Richness beats brightness every time.",
    metals: "Gold, bronze, copper",
    neutrals: ["Cream", "Chocolate", "Olive"],
    palette: [
      { name: "Rust", hex: "#B7410E" },
      { name: "Olive", hex: "#708238" },
      { name: "Mustard", hex: "#D4A017" },
      { name: "Terracotta", hex: "#C86B4A" },
      { name: "Forest Green", hex: "#1B4D3E" },
      { name: "Chocolate", hex: "#3D2B1F" },
      { name: "Burnt Orange", hex: "#CC5500" },
      { name: "Teal", hex: "#008080" },
      { name: "Cream", hex: "#F5EBDC" },
      { name: "Deep Gold", hex: "#B8860B" },
    ],
    avoid: [
      { name: "Icy Pink", hex: "#F7D5E0", why: "too cool and too pale to hold its own beside rich colouring" },
      { name: "Pure White", hex: "#FFFFFF", why: "stark against warm skin — cream is the same idea, done right" },
      { name: "Fuchsia", hex: "#E3327E", why: "its blue base clashes with golden undertones" },
    ],
  },
  Winter: {
    season: "Winter",
    tagline: "Cool and striking",
    description:
      "Cool undertones with high contrast. You are one of the few who genuinely suits pure black and true white — and saturated jewel colours rather than anything dusty or muted.",
    metals: "Silver, platinum, white gold",
    neutrals: ["Pure white", "Black", "Charcoal"],
    palette: [
      { name: "True Red", hex: "#C8102E" },
      { name: "Emerald", hex: "#046307" },
      { name: "Royal Blue", hex: "#2B4FA2" },
      { name: "Fuchsia", hex: "#E3327E" },
      { name: "Pure White", hex: "#FFFFFF" },
      { name: "Black", hex: "#111111" },
      { name: "Sapphire", hex: "#0F52BA" },
      { name: "Icy Pink", hex: "#F7D5E0" },
      { name: "Deep Purple", hex: "#6A0DAD" },
      { name: "Charcoal", hex: "#36454F" },
    ],
    avoid: [
      { name: "Beige", hex: "#E8DCC4", why: "muted warm neutrals wash out high-contrast colouring" },
      { name: "Rust", hex: "#B7410E", why: "earthy warmth dulls a cool, clear palette" },
      { name: "Olive", hex: "#708238", why: "its muddiness works against you rather than with you" },
    ],
  },
});

/**
 * Map the three readings onto a season.
 *
 * Undertone decides the warm/cool half. Depth and contrast decide which of the
 * two within it. Neutral undertones genuinely sit between seasons, so they
 * resolve toward the softer option and are reported with lower confidence
 * rather than pretending to a precision the input does not support.
 */
export function determineSeason(skin: SkinAnalysis): SeasonName {
  const { undertone, depth, contrast } = skin;

  if (undertone === "warm") {
    return depth === "deep" || contrast === "low" ? "Autumn" : "Spring";
  }
  if (undertone === "cool") {
    return depth === "deep" || contrast === "high" ? "Winter" : "Summer";
  }

  // Neutral or unknown: lean on depth, favouring the muted seasons.
  if (depth === "deep") return "Autumn";
  if (contrast === "high") return "Winter";
  return "Summer";
}

/** Season assignment is weaker when the inputs are partial or neutral. */
export function seasonConfidence(skin: SkinAnalysis): Confidence {
  if (!skin.undertone) return "low";
  if (skin.undertone === "neutral") return "low";
  if (!skin.depth || !skin.contrast) return "medium";
  return skin.confidence;
}

export interface ColorRecommendation {
  name: string;
  hex: string;
  score: number;
  reason: string;
}

/** Approximate CIELAB lightness of skin at each depth bucket. */
const SKIN_LIGHTNESS: Record<Depth, number> = {
  light: 75,
  medium: 55,
  deep: 32,
};

/** How much lightness separation flatters at each contrast level. */
const IDEAL_SEPARATION: Record<ContrastLevel, number> = {
  low: 18,
  medium: 30,
  high: 45,
};

/**
 * Score every wardrobe colour against a skin reading.
 *
 * Two factors: temperature match with the undertone, and how much lightness
 * separation the colour creates against the skin. Separation is why the same
 * beige that flatters one person disappears on another — it is doing no work
 * against their skin's lightness.
 */
export function recommendColorsForSkin(
  skin: SkinAnalysis,
  count = 8,
): { best: ColorRecommendation[]; avoid: ColorRecommendation[] } {
  const skinL = SKIN_LIGHTNESS[skin.depth ?? "medium"];
  const ideal = IDEAL_SEPARATION[skin.contrast ?? "medium"];

  const scored = REFERENCE_COLORS.map((ref) => {
    const undertoneScore = scoreColorForUndertone(ref.hex, skin.undertone);

    const lab = hexToLab(ref.hex);
    const separation = lab ? Math.abs(lab.l - skinL) : 0;
    // Peaks at the ideal separation and falls away in both directions, so a
    // colour that is too close to skin lightness scores as poorly as one that
    // is jarringly far from it.
    const separationScore = Math.max(
      0,
      1 - Math.abs(separation - ideal) / 55,
    );

    const score = undertoneScore * 0.6 + separationScore * 0.4;

    return {
      name: ref.name,
      hex: ref.hex,
      score,
      reason: buildReason(ref.temperature, skin.undertone, separation, ideal),
    };
  }).sort((a, b) => b.score - a.score);

  return {
    best: scored.slice(0, count),
    avoid: scored.slice(-3).reverse(),
  };
}

function buildReason(
  colorTemp: Temperature,
  undertone: Temperature | null,
  separation: number,
  ideal: number,
): string {
  const parts: string[] = [];

  if (undertone && colorTemp === undertone) {
    parts.push(`${colorTemp} like your undertone`);
  } else if (colorTemp === "neutral") {
    parts.push("temperature-neutral, so it works either way");
  } else if (undertone) {
    parts.push(`runs ${colorTemp} against your ${undertone} undertone`);
  }

  const drift = separation - ideal;
  if (Math.abs(drift) <= 12) parts.push("sits at a flattering distance from your skin's depth");
  else if (drift < 0) parts.push("close to your skin's depth, so it can read flat");
  else parts.push("a strong jump from your skin's depth");

  return parts.join("; ");
}

/** One-line summary for the dashboard and the recommendation prompt. */
export function describeSkin(skin: SkinAnalysis): string {
  if (!skin.undertone) return "Undertone not yet determined.";
  const season = determineSeason(skin);
  const bits = [`${skin.undertone} undertone`];
  if (skin.depth) bits.push(`${skin.depth} depth`);
  if (skin.contrast) bits.push(`${skin.contrast} contrast`);
  return `${season} — ${bits.join(", ")}.`;
}

// ---------------------------------------------------------------------------
// No-photo path
// ---------------------------------------------------------------------------

/**
 * The standard low-tech undertone test. Worth offering because a single
 * uncontrolled selfie is genuinely unreliable — indoor lighting pushes almost
 * everyone toward "warm", and phone cameras white-balance aggressively — while
 * these three questions are stable regardless of lighting.
 */
export interface QuizAnswers {
  /** Vein colour at the inner wrist in daylight. */
  veins: "green" | "blue" | "both";
  /** Which metal looks better against the skin. */
  metal: "gold" | "silver" | "both";
  /** What the sun usually does. */
  sun: "tans" | "burns" | "both";
  /** Self-reported depth and contrast, since the user can see these. */
  depth?: Depth;
  contrast?: ContrastLevel;
}

export function quizToSkinAnalysis(answers: QuizAnswers): SkinAnalysis {
  let warm = 0;
  let cool = 0;

  if (answers.veins === "green") warm += 1;
  else if (answers.veins === "blue") cool += 1;

  if (answers.metal === "gold") warm += 1;
  else if (answers.metal === "silver") cool += 1;

  if (answers.sun === "tans") warm += 1;
  else if (answers.sun === "burns") cool += 1;

  let undertone: Temperature;
  if (warm > cool) undertone = "warm";
  else if (cool > warm) undertone = "cool";
  else undertone = "neutral";

  // All three agreeing is a much stronger signal than two out of three.
  const decisive = Math.max(warm, cool);
  const confidence: Confidence =
    decisive >= 3 ? "high" : decisive === 2 ? "medium" : "low";

  return {
    undertone,
    depth: answers.depth ?? null,
    contrast: answers.contrast ?? null,
    confidence,
  };
}

/**
 * Rough check for a photo too colour-cast to trust. Warm indoor bulbs are the
 * usual culprit and will fake a warm undertone for anyone.
 */
export function detectColorCast(dominantHex: string): string | null {
  const hsl = hexToHsl(dominantHex);
  if (!hsl) return null;
  if (hsl.s < 0.15) return null;
  if (hsl.h >= 20 && hsl.h <= 60 && hsl.s > 0.35) {
    return "This photo looks warmly lit, which can fake a warm undertone. Daylight gives a truer reading.";
  }
  if (hsl.h >= 180 && hsl.h <= 260 && hsl.s > 0.35) {
    return "This photo looks coolly lit, which can fake a cool undertone. Daylight gives a truer reading.";
  }
  return null;
}
