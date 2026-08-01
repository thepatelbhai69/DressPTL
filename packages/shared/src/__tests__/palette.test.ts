import { describe, expect, it } from "vitest";
import {
  buildStyleProfile,
  suggestPaletteAdditions,
  summarizeProfile,
  type AnalysisLike,
} from "../palette";

const navyAndWhite: AnalysisLike[] = [
  {
    colors: [
      { hex: "#1F305E", prominence: 0.6 },
      { hex: "#FFFFFF", prominence: 0.4 },
    ],
    styleTags: ["minimalist"],
    skinUndertone: "cool",
    bodySilhouette: "rectangle",
  },
  {
    colors: [
      { hex: "#20325F", prominence: 0.7 },
      { hex: "#F5F5F5", prominence: 0.3 },
    ],
    styleTags: ["minimalist", "smart-casual"],
    skinUndertone: "cool",
    bodySilhouette: "rectangle",
  },
];

describe("buildStyleProfile", () => {
  it("ranks colour families by accumulated prominence", () => {
    const profile = buildStyleProfile(navyAndWhite, { recencyHalfLife: 0 });
    expect(profile.palette[0]!.name).toBe("Navy");
    expect(profile.palette[0]!.weight).toBeCloseTo(1.3, 5);
    expect(profile.palette[1]!.name).toBe("White");
    expect(profile.palette[1]!.weight).toBeCloseTo(0.7, 5);
  });

  it("normalises shares to sum to one", () => {
    const profile = buildStyleProfile(navyAndWhite, { recencyHalfLife: 0 });
    const total = profile.palette.reduce((sum, e) => sum + e.share, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it("learns pairings, which is the actual product claim", () => {
    const profile = buildStyleProfile(navyAndWhite, { recencyHalfLife: 0 });
    expect(profile.blends).toHaveLength(1);
    expect(profile.blends[0]!.names).toEqual(["Navy", "White"]);
    expect(profile.blends[0]!.weight).toBeCloseTo(1.0, 5);
    expect(profile.blends[0]!.harmony).toBe("neutral-anchored");
  });

  it("weights recent outfits more heavily", () => {
    const recentRed: AnalysisLike[] = [
      { colors: [{ hex: "#C8102E", prominence: 1 }] },
      { colors: [{ hex: "#1F305E", prominence: 1 }] },
    ];
    const weighted = buildStyleProfile(recentRed, { recencyHalfLife: 1 });
    const unweighted = buildStyleProfile(recentRed, { recencyHalfLife: 0 });

    expect(weighted.palette[0]!.name).toBe("Red");
    expect(weighted.palette[0]!.weight).toBeGreaterThan(
      weighted.palette[1]!.weight,
    );
    // Without recency weighting the two are tied.
    expect(unweighted.palette[0]!.weight).toBeCloseTo(
      unweighted.palette[1]!.weight,
      5,
    );
  });

  it("takes the majority undertone and silhouette", () => {
    const profile = buildStyleProfile(navyAndWhite);
    expect(profile.undertone).toBe("cool");
    expect(profile.silhouette).toBe("rectangle");
    expect(profile.photoCount).toBe(2);
  });

  it("ignores 'unknown' silhouettes instead of letting them win", () => {
    const profile = buildStyleProfile([
      { colors: [{ hex: "#1F305E", prominence: 1 }], bodySilhouette: "unknown" },
      { colors: [{ hex: "#1F305E", prominence: 1 }], bodySilhouette: "unknown" },
      {
        colors: [{ hex: "#1F305E", prominence: 1 }],
        bodySilhouette: "hourglass",
      },
    ]);
    expect(profile.silhouette).toBe("hourglass");
  });

  it("counts style tags case-insensitively", () => {
    const profile = buildStyleProfile([
      { colors: [{ hex: "#1F305E", prominence: 1 }], styleTags: ["Minimalist"] },
      { colors: [{ hex: "#1F305E", prominence: 1 }], styleTags: ["minimalist"] },
    ]);
    expect(profile.styleTags[0]).toEqual({ tag: "minimalist", count: 2 });
  });

  it("survives empty and malformed input", () => {
    const empty = buildStyleProfile([]);
    expect(empty.palette).toEqual([]);
    expect(empty.blends).toEqual([]);
    expect(empty.undertone).toBeNull();

    const junk = buildStyleProfile([
      {
        colors: [
          { hex: "not-a-colour", prominence: 0.5 },
          { hex: "#1F305E", prominence: Number.NaN },
          { hex: "#C8102E", prominence: 0.5 },
        ],
      },
    ]);
    expect(junk.palette).toHaveLength(1);
    expect(junk.palette[0]!.name).toBe("Red");
  });

  it("clamps out-of-range prominence from the model", () => {
    const profile = buildStyleProfile(
      [{ colors: [{ hex: "#C8102E", prominence: 42 }] }],
      { recencyHalfLife: 0 },
    );
    expect(profile.palette[0]!.weight).toBe(1);
  });
});

describe("suggestPaletteAdditions", () => {
  it("never suggests a colour the user already wears", () => {
    const profile = buildStyleProfile(navyAndWhite);
    const suggestions = suggestPaletteAdditions(profile, 5);
    const existing = new Set(profile.palette.map((e) => e.name));
    for (const suggestion of suggestions) {
      expect(existing.has(suggestion.name)).toBe(false);
    }
    expect(suggestions).toHaveLength(5);
  });

  it("prefers undertone-appropriate colours", () => {
    const coolProfile = buildStyleProfile([
      {
        colors: [{ hex: "#1F305E", prominence: 1 }],
        skinUndertone: "cool",
      },
    ]);
    const top = suggestPaletteAdditions(coolProfile, 3);
    expect(top.every((s) => s.score > 0.5)).toBe(true);
  });
});

describe("summarizeProfile", () => {
  it("describes an empty profile without crashing", () => {
    expect(summarizeProfile(buildStyleProfile([]))).toMatch(/no outfits/i);
  });

  it("mentions leading colours and the top pairing", () => {
    const summary = summarizeProfile(buildStyleProfile(navyAndWhite));
    expect(summary).toContain("navy");
    expect(summary).toContain("cool undertone");
  });
});
