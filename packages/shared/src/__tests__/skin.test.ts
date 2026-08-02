import { describe, expect, it } from "vitest";
import {
  describeSkin,
  detectColorCast,
  determineSeason,
  quizToSkinAnalysis,
  recommendColorsForSkin,
  seasonConfidence,
  SEASONS,
  type SkinAnalysis,
} from "../skin";

const skin = (over: Partial<SkinAnalysis> = {}): SkinAnalysis => ({
  undertone: "warm",
  depth: "medium",
  contrast: "medium",
  confidence: "high",
  ...over,
});

describe("determineSeason", () => {
  it("splits warm colouring into Spring and Autumn by depth", () => {
    expect(determineSeason(skin({ undertone: "warm", depth: "light" }))).toBe("Spring");
    expect(determineSeason(skin({ undertone: "warm", depth: "deep" }))).toBe("Autumn");
  });

  it("splits cool colouring into Summer and Winter by contrast", () => {
    expect(
      determineSeason(skin({ undertone: "cool", depth: "light", contrast: "low" })),
    ).toBe("Summer");
    expect(
      determineSeason(skin({ undertone: "cool", depth: "light", contrast: "high" })),
    ).toBe("Winter");
  });

  it("sends low-contrast warm colouring to Autumn rather than Spring", () => {
    expect(
      determineSeason(skin({ undertone: "warm", depth: "light", contrast: "low" })),
    ).toBe("Autumn");
  });

  it("resolves neutral undertones without crashing", () => {
    expect(determineSeason(skin({ undertone: "neutral", depth: "deep" }))).toBe("Autumn");
    expect(
      determineSeason(skin({ undertone: "neutral", depth: "light", contrast: "high" })),
    ).toBe("Winter");
    expect(
      determineSeason(skin({ undertone: "neutral", depth: "light", contrast: "low" })),
    ).toBe("Summer");
  });

  it("still returns a season when readings are missing", () => {
    expect(
      determineSeason({ undertone: null, depth: null, contrast: null, confidence: "low" }),
    ).toBe("Summer");
  });

  it("always names a season that exists in SEASONS", () => {
    for (const undertone of ["warm", "cool", "neutral", null] as const) {
      for (const depth of ["light", "medium", "deep", null] as const) {
        for (const contrast of ["low", "medium", "high", null] as const) {
          const season = determineSeason({ undertone, depth, contrast, confidence: "medium" });
          expect(SEASONS[season]).toBeDefined();
        }
      }
    }
  });
});

describe("seasonConfidence", () => {
  it("never claims high confidence on a neutral undertone", () => {
    expect(seasonConfidence(skin({ undertone: "neutral" }))).toBe("low");
  });

  it("drops to low with no undertone at all", () => {
    expect(seasonConfidence(skin({ undertone: null }))).toBe("low");
  });

  it("caps at medium when depth or contrast is missing", () => {
    expect(seasonConfidence(skin({ depth: null }))).toBe("medium");
  });

  it("passes through the reading's own confidence when complete", () => {
    expect(seasonConfidence(skin({ confidence: "high" }))).toBe("high");
    expect(seasonConfidence(skin({ confidence: "medium" }))).toBe("medium");
  });
});

describe("season profiles", () => {
  it("gives every season a usable palette, avoid list, and metal", () => {
    for (const profile of Object.values(SEASONS)) {
      expect(profile.palette.length).toBeGreaterThanOrEqual(8);
      expect(profile.avoid.length).toBeGreaterThanOrEqual(3);
      expect(profile.metals).toBeTruthy();
      for (const entry of [...profile.palette, ...profile.avoid]) {
        expect(entry.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it("explains why each avoided colour is avoided", () => {
    for (const profile of Object.values(SEASONS)) {
      for (const entry of profile.avoid) {
        expect(entry.why.length).toBeGreaterThan(10);
      }
    }
  });

  it("does not tell Winters to avoid black, which is their best colour", () => {
    const avoided = SEASONS.Winter.avoid.map((a) => a.name);
    expect(avoided).not.toContain("Black");
    expect(SEASONS.Winter.palette.map((p) => p.name)).toContain("Black");
  });
});

describe("recommendColorsForSkin", () => {
  it("ranks warm colours highest for warm undertones", () => {
    const { best } = recommendColorsForSkin(skin({ undertone: "warm" }), 6);
    const warmish = best.filter((c) =>
      ["Camel", "Rust", "Mustard", "Gold", "Coral", "Orange", "Brown", "Olive", "Chocolate", "Beige", "Ivory"].includes(c.name),
    );
    expect(warmish.length).toBeGreaterThanOrEqual(3);
  });

  it("produces different rankings for warm and cool skin", () => {
    const warm = recommendColorsForSkin(skin({ undertone: "warm" }), 5).best.map((c) => c.name);
    const cool = recommendColorsForSkin(skin({ undertone: "cool" }), 5).best.map((c) => c.name);
    expect(warm).not.toEqual(cool);
  });

  it("shifts recommendations when only depth changes", () => {
    const light = recommendColorsForSkin(skin({ depth: "light" }), 5).best.map((c) => c.name);
    const deep = recommendColorsForSkin(skin({ depth: "deep" }), 5).best.map((c) => c.name);
    expect(light).not.toEqual(deep);
  });

  it("returns an avoid list distinct from the best list", () => {
    const { best, avoid } = recommendColorsForSkin(skin(), 8);
    const bestNames = new Set(best.map((c) => c.name));
    for (const entry of avoid) expect(bestNames.has(entry.name)).toBe(false);
  });

  it("gives every recommendation a human reason", () => {
    const { best } = recommendColorsForSkin(skin(), 4);
    for (const entry of best) {
      expect(entry.reason.length).toBeGreaterThan(10);
      expect(entry.score).toBeGreaterThan(0);
      expect(entry.score).toBeLessThanOrEqual(1);
    }
  });

  it("works with no readings at all", () => {
    const { best } = recommendColorsForSkin(
      { undertone: null, depth: null, contrast: null, confidence: "low" },
      5,
    );
    expect(best).toHaveLength(5);
  });
});

describe("quizToSkinAnalysis", () => {
  it("reads three warm signals as a confident warm undertone", () => {
    const result = quizToSkinAnalysis({ veins: "green", metal: "gold", sun: "tans" });
    expect(result.undertone).toBe("warm");
    expect(result.confidence).toBe("high");
  });

  it("reads three cool signals as a confident cool undertone", () => {
    const result = quizToSkinAnalysis({ veins: "blue", metal: "silver", sun: "burns" });
    expect(result.undertone).toBe("cool");
    expect(result.confidence).toBe("high");
  });

  it("calls a split verdict neutral, with low confidence", () => {
    const result = quizToSkinAnalysis({ veins: "green", metal: "silver", sun: "both" });
    expect(result.undertone).toBe("neutral");
    expect(result.confidence).toBe("low");
  });

  it("lowers confidence when only two of three agree", () => {
    const result = quizToSkinAnalysis({ veins: "green", metal: "gold", sun: "both" });
    expect(result.undertone).toBe("warm");
    expect(result.confidence).toBe("medium");
  });

  it("carries through self-reported depth and contrast", () => {
    const result = quizToSkinAnalysis({
      veins: "blue",
      metal: "silver",
      sun: "burns",
      depth: "deep",
      contrast: "high",
    });
    expect(result.depth).toBe("deep");
    expect(result.contrast).toBe("high");
    expect(determineSeason(result)).toBe("Winter");
  });
});

describe("detectColorCast", () => {
  it("flags warm indoor lighting, which fakes a warm undertone", () => {
    expect(detectColorCast("#E0A040")).toMatch(/warmly lit/i);
  });

  it("flags a strong cool cast", () => {
    expect(detectColorCast("#4060D0")).toMatch(/coolly lit/i);
  });

  it("stays quiet on neutral lighting", () => {
    expect(detectColorCast("#B0B0B0")).toBeNull();
    expect(detectColorCast("#FFFFFF")).toBeNull();
  });

  it("returns null rather than throwing on bad input", () => {
    expect(detectColorCast("not-a-colour")).toBeNull();
  });
});

describe("describeSkin", () => {
  it("leads with the season", () => {
    expect(describeSkin(skin({ undertone: "warm", depth: "deep" }))).toMatch(/^Autumn/);
  });

  it("says so when the undertone is unknown", () => {
    expect(describeSkin(skin({ undertone: null }))).toMatch(/not yet determined/i);
  });
});
