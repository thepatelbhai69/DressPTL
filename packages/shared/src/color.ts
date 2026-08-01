/**
 * Colour science utilities.
 *
 * Everything here is pure and dependency-free so it can run identically in the
 * Workers runtime, in Next.js server components, and under vitest.
 *
 * Conversions go sRGB -> linear RGB -> CIEXYZ (D65) -> CIELAB, because
 * perceptual distance in LAB is what makes "which colour family is this?"
 * behave the way a human would answer it. Naive RGB distance clusters navy
 * with black and coral with red, which wrecks the palette learning.
 */

export interface Rgb {
  r: number; // 0-255
  g: number;
  b: number;
}

export interface Lab {
  l: number;
  a: number;
  b: number;
}

export interface Hsl {
  h: number; // 0-360
  s: number; // 0-1
  l: number; // 0-1
}

export type Temperature = "warm" | "cool" | "neutral";

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function hexToRgb(hex: string): Rgb | null {
  const match = HEX_RE.exec(hex.trim());
  if (!match) return null;
  let body = match[1]!;
  if (body.length === 3) {
    body = body
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return {
    r: parseInt(body.slice(0, 2), 16),
    g: parseInt(body.slice(2, 4), 16),
    b: parseInt(body.slice(4, 6), 16),
  };
}

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

export function rgbToHex({ r, g, b }: Rgb): string {
  return (
    "#" +
    [r, g, b]
      .map((c) => clamp255(c).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** sRGB channel (0-1) -> linear-light value. */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// D65 reference white.
const WHITE_X = 95.047;
const WHITE_Y = 100.0;
const WHITE_Z = 108.883;

export function rgbToLab({ r, g, b }: Rgb): Lab {
  const lr = srgbToLinear(r / 255) * 100;
  const lg = srgbToLinear(g / 255) * 100;
  const lb = srgbToLinear(b / 255) * 100;

  const x = lr * 0.4124 + lg * 0.3576 + lb * 0.1805;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = lr * 0.0193 + lg * 0.1192 + lb * 0.9505;

  const f = (t: number) =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;

  const fx = f(x / WHITE_X);
  const fy = f(y / WHITE_Y);
  const fz = f(z / WHITE_Z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function labToRgb({ l, a, b }: Lab): Rgb {
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;

  const finv = (t: number) => {
    const cube = t * t * t;
    return cube > 0.008856 ? cube : (t - 16 / 116) / 7.787;
  };

  const x = finv(fx) * WHITE_X;
  const y = finv(fy) * WHITE_Y;
  const z = finv(fz) * WHITE_Z;

  const lr = (x * 3.2406 + y * -1.5372 + z * -0.4986) / 100;
  const lg = (x * -0.9689 + y * 1.8758 + z * 0.0415) / 100;
  const lb = (x * 0.0557 + y * -0.204 + z * 1.057) / 100;

  return {
    r: clamp255(linearToSrgb(Math.max(0, lr)) * 255),
    g: clamp255(linearToSrgb(Math.max(0, lg)) * 255),
    b: clamp255(linearToSrgb(Math.max(0, lb)) * 255),
  };
}

export function hexToLab(hex: string): Lab | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToLab(rgb) : null;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return { h, s, l };
}

export function hexToHsl(hex: string): Hsl | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsl(rgb) : null;
}

/**
 * CIE76 colour difference. Less accurate than CIEDE2000 near saturated blues,
 * but monotonic and cheap, and we only need it to pick a nearest neighbour out
 * of ~35 well-separated reference colours.
 */
export function deltaE(a: Lab, b: Lab): number {
  const dl = a.l - b.l;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dl * dl + da * da + db * db);
}

export interface ReferenceColor {
  name: string;
  hex: string;
  temperature: Temperature;
}

/**
 * A curated wardrobe palette. These are the buckets user colours get named
 * into, so they are deliberately the words a person would actually use for
 * clothes ("camel", "burgundy") rather than raw CSS colour names.
 */
export const REFERENCE_COLORS: readonly ReferenceColor[] = Object.freeze([
  // Neutrals
  { name: "Black", hex: "#111111", temperature: "neutral" },
  { name: "Charcoal", hex: "#36454F", temperature: "cool" },
  { name: "Grey", hex: "#808080", temperature: "neutral" },
  { name: "Silver", hex: "#C0C0C0", temperature: "cool" },
  { name: "White", hex: "#FFFFFF", temperature: "neutral" },
  { name: "Ivory", hex: "#FFFFF0", temperature: "warm" },
  { name: "Beige", hex: "#E8DCC4", temperature: "warm" },
  { name: "Camel", hex: "#C19A6B", temperature: "warm" },
  { name: "Taupe", hex: "#8B7D6B", temperature: "neutral" },
  { name: "Brown", hex: "#6F4E37", temperature: "warm" },
  { name: "Chocolate", hex: "#3D2B1F", temperature: "warm" },
  // Blues
  { name: "Navy", hex: "#1F305E", temperature: "cool" },
  { name: "Royal Blue", hex: "#2B4FA2", temperature: "cool" },
  { name: "Denim", hex: "#4A6FA5", temperature: "cool" },
  { name: "Sky Blue", hex: "#87CEEB", temperature: "cool" },
  { name: "Teal", hex: "#008080", temperature: "cool" },
  // Greens
  { name: "Forest Green", hex: "#1B4D3E", temperature: "cool" },
  { name: "Emerald", hex: "#046307", temperature: "cool" },
  { name: "Olive", hex: "#708238", temperature: "warm" },
  { name: "Sage", hex: "#9CAF88", temperature: "neutral" },
  { name: "Mint", hex: "#98FF98", temperature: "cool" },
  // Reds / pinks
  { name: "Red", hex: "#C8102E", temperature: "warm" },
  { name: "Crimson", hex: "#9B1B30", temperature: "cool" },
  { name: "Burgundy", hex: "#6E1220", temperature: "cool" },
  { name: "Coral", hex: "#FF6F61", temperature: "warm" },
  { name: "Blush Pink", hex: "#F4C2C2", temperature: "warm" },
  { name: "Hot Pink", hex: "#E3327E", temperature: "cool" },
  { name: "Rose", hex: "#C21E56", temperature: "cool" },
  // Oranges / yellows
  { name: "Orange", hex: "#E8703A", temperature: "warm" },
  { name: "Rust", hex: "#B7410E", temperature: "warm" },
  { name: "Mustard", hex: "#D4A017", temperature: "warm" },
  { name: "Gold", hex: "#D4AF37", temperature: "warm" },
  { name: "Butter Yellow", hex: "#F3E5AB", temperature: "warm" },
  // Purples
  { name: "Purple", hex: "#6A0DAD", temperature: "cool" },
  { name: "Lavender", hex: "#B57EDC", temperature: "cool" },
  { name: "Plum", hex: "#6A2C48", temperature: "cool" },
]);

const REFERENCE_LABS: ReadonlyArray<{ ref: ReferenceColor; lab: Lab }> =
  REFERENCE_COLORS.map((ref) => ({ ref, lab: rgbToLab(hexToRgb(ref.hex)!) }));

/** Snap an arbitrary hex to the closest wardrobe colour family. */
export function nearestReferenceColor(hex: string): ReferenceColor | null {
  const lab = hexToLab(hex);
  if (!lab) return null;

  let best = REFERENCE_LABS[0]!;
  let bestDistance = Infinity;
  for (const candidate of REFERENCE_LABS) {
    const distance = deltaE(lab, candidate.lab);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best.ref;
}

/**
 * Weighted average of colours in LAB space. Averaging in raw sRGB muddies
 * blends toward grey; LAB keeps the result close to what the eye expects.
 */
export function averageHex(
  entries: ReadonlyArray<{ hex: string; weight: number }>,
): string | null {
  let totalWeight = 0;
  let l = 0;
  let a = 0;
  let b = 0;

  for (const entry of entries) {
    const lab = hexToLab(entry.hex);
    if (!lab || entry.weight <= 0) continue;
    l += lab.l * entry.weight;
    a += lab.a * entry.weight;
    b += lab.b * entry.weight;
    totalWeight += entry.weight;
  }

  if (totalWeight === 0) return null;
  return rgbToHex(
    labToRgb({ l: l / totalWeight, a: a / totalWeight, b: b / totalWeight }),
  );
}

/**
 * Single source of truth for harmony names: the Zod wire schema builds its
 * enum from this array, so the runtime contract and the compile-time type
 * cannot drift apart.
 */
export const HARMONY_KINDS = [
  "monochrome",
  "analogous",
  "complementary",
  "triadic",
  "contrast",
  "neutral-anchored",
] as const;

export type HarmonyKind = (typeof HARMONY_KINDS)[number];

/** Smallest angular distance between two hues, in degrees (0-180). */
export function hueDistance(h1: number, h2: number): number {
  const raw = Math.abs(h1 - h2) % 360;
  return raw > 180 ? 360 - raw : raw;
}

/** Classify how two colours relate, using the same vocabulary a stylist would. */
export function describeHarmony(hexA: string, hexB: string): HarmonyKind {
  const a = hexToHsl(hexA);
  const b = hexToHsl(hexB);
  if (!a || !b) return "contrast";

  // A near-greyscale colour acts as an anchor rather than forming a hue
  // relationship — "black with anything" is not a complementary pairing.
  const LOW_SAT = 0.12;
  if (a.s < LOW_SAT || b.s < LOW_SAT) return "neutral-anchored";

  const distance = hueDistance(a.h, b.h);
  if (distance <= 20) return "monochrome";
  if (distance <= 55) return "analogous";
  if (distance >= 150) return "complementary";
  if (distance >= 100) return "triadic";
  return "contrast";
}

/**
 * How well a colour flatters a given skin undertone, 0-1.
 *
 * This is the ONLY place skin information influences colour choice, and it
 * operates purely on warm/cool/neutral undertone — never on ethnicity, which
 * the app neither infers nor stores.
 */
export function scoreColorForUndertone(
  hex: string,
  undertone: Temperature | null,
): number {
  const ref = nearestReferenceColor(hex);
  if (!ref) return 0.5;
  if (!undertone || undertone === "neutral") {
    // Neutral undertones carry nearly everything; mild preference for
    // colours that aren't at a temperature extreme.
    return ref.temperature === "neutral" ? 1 : 0.85;
  }
  if (ref.temperature === undertone) return 1;
  if (ref.temperature === "neutral") return 0.8;
  return 0.45;
}
