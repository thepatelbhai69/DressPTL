import type { Depth, Undertone } from "./color";

export interface ManualSwatch {
  id: string;
  hex: string;
  depth: Depth;
  undertone: Undertone;
}

// A hand-picked reference swatch for each depth x undertone combination,
// used as a fallback/override to photo-based detection.
export const MANUAL_SWATCHES: ManualSwatch[] = [
  { id: "fair-warm", hex: "#F3D5B5", depth: "fair", undertone: "warm" },
  { id: "fair-neutral", hex: "#F1D9C9", depth: "fair", undertone: "neutral" },
  { id: "fair-cool", hex: "#F0D6D6", depth: "fair", undertone: "cool" },

  { id: "light-warm", hex: "#E8BE94", depth: "light", undertone: "warm" },
  { id: "light-neutral", hex: "#E3C0A8", depth: "light", undertone: "neutral" },
  { id: "light-cool", hex: "#E0BFC2", depth: "light", undertone: "cool" },

  { id: "medium-warm", hex: "#C98F5D", depth: "medium", undertone: "warm" },
  { id: "medium-neutral", hex: "#C79172", depth: "medium", undertone: "neutral" },
  { id: "medium-cool", hex: "#C08E93", depth: "medium", undertone: "cool" },

  { id: "tan-warm", hex: "#A56A3B", depth: "tan", undertone: "warm" },
  { id: "tan-neutral", hex: "#9C6A4E", depth: "tan", undertone: "neutral" },
  { id: "tan-cool", hex: "#996468", depth: "tan", undertone: "cool" },

  { id: "deep-warm", hex: "#6B4226", depth: "deep", undertone: "warm" },
  { id: "deep-neutral", hex: "#5C3A2E", depth: "deep", undertone: "neutral" },
  { id: "deep-cool", hex: "#553235", depth: "deep", undertone: "cool" },
];
