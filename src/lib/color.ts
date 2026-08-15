export type Undertone = "warm" | "cool" | "neutral";
export type Depth = "fair" | "light" | "medium" | "tan" | "deep";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface SkinToneResult {
  rgb: Rgb;
  hex: string;
  depth: Depth;
  undertone: Undertone;
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// sRGB (D65) -> CIE XYZ
function rgbToXyz({ r, g, b }: Rgb) {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  return {
    x: rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375,
    y: rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175,
    z: rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041,
  };
}

// CIE XYZ -> CIE L*a*b* (D65 reference white)
function xyzToLab({ x, y, z }: { x: number; y: number; z: number }) {
  const xn = 0.95047;
  const yn = 1.0;
  const zn = 1.08883;
  const delta = 6 / 29;
  const f = (t: number) =>
    t > delta ** 3 ? Math.cbrt(t) : t / (3 * delta ** 2) + 4 / 29;

  const fx = f(x / xn);
  const fy = f(y / yn);
  const fz = f(z / zn);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function rgbToLab(rgb: Rgb) {
  return xyzToLab(rgbToXyz(rgb));
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
  );
}

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

// Individual Typology Angle - a dermatology-derived measure of skin depth
// from CIE Lab values. Higher ITA = lighter skin.
function individualTypologyAngle(l: number, b: number): number {
  return (Math.atan2(l - 50, b) * 180) / Math.PI;
}

function classifyDepth(ita: number): Depth {
  if (ita > 50) return "fair";
  if (ita > 35) return "light";
  if (ita > 20) return "medium";
  if (ita > 5) return "tan";
  return "deep";
}

// Skin undertone is approximated from the ratio of yellow (b*) to red (a*)
// in Lab space: yellow-dominant reads warm, red/pink-dominant reads cool.
function classifyUndertone(a: number, b: number): Undertone {
  if (a <= 0) return "neutral";
  const ratio = b / a;
  if (ratio > 1.15) return "warm";
  if (ratio < 0.85) return "cool";
  return "neutral";
}

export function classifySkinTone(rgb: Rgb): SkinToneResult {
  const lab = rgbToLab(rgb);
  const ita = individualTypologyAngle(lab.l, lab.b);
  return {
    rgb,
    hex: rgbToHex(rgb),
    depth: classifyDepth(ita),
    undertone: classifyUndertone(lab.a, lab.b),
  };
}

export const DEPTH_LABELS: Record<Depth, string> = {
  fair: "Fair",
  light: "Light",
  medium: "Medium",
  tan: "Tan",
  deep: "Deep",
};

export const UNDERTONE_LABELS: Record<Undertone, string> = {
  warm: "Warm",
  cool: "Cool",
  neutral: "Neutral",
};
