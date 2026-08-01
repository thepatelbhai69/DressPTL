import { describe, expect, it } from "vitest";
import {
  averageHex,
  deltaE,
  describeHarmony,
  hexToRgb,
  hueDistance,
  labToRgb,
  nearestReferenceColor,
  rgbToHex,
  rgbToLab,
  scoreColorForUndertone,
} from "../color";

describe("hex parsing", () => {
  it("parses long and short form", () => {
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("1F305E")).toEqual({ r: 31, g: 48, b: 94 });
  });

  it("rejects malformed input rather than guessing", () => {
    expect(hexToRgb("blue")).toBeNull();
    expect(hexToRgb("#12345")).toBeNull();
    expect(hexToRgb("")).toBeNull();
  });

  it("round-trips through rgbToHex", () => {
    expect(rgbToHex({ r: 31, g: 48, b: 94 })).toBe("#1f305e");
  });
});

describe("LAB conversion", () => {
  it("round-trips sRGB within a perceptually invisible margin", () => {
    for (const hex of ["#1F305E", "#C8102E", "#98FF98", "#808080", "#000000"]) {
      const rgb = hexToRgb(hex)!;
      const back = labToRgb(rgbToLab(rgb));
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(2);
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(2);
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(2);
    }
  });

  it("gives zero distance for identical colours", () => {
    const lab = rgbToLab(hexToRgb("#C19A6B")!);
    expect(deltaE(lab, lab)).toBe(0);
  });

  it("ranks a near-identical colour closer than a different one", () => {
    const navy = rgbToLab(hexToRgb("#1F305E")!);
    const nearNavy = rgbToLab(hexToRgb("#20325F")!);
    const red = rgbToLab(hexToRgb("#C8102E")!);
    expect(deltaE(navy, nearNavy)).toBeLessThan(deltaE(navy, red));
  });
});

describe("nearestReferenceColor", () => {
  it("snaps shades to the wardrobe family a person would name", () => {
    expect(nearestReferenceColor("#20325F")?.name).toBe("Navy");
    expect(nearestReferenceColor("#000000")?.name).toBe("Black");
    expect(nearestReferenceColor("#FDFDF5")?.name).toBe("Ivory");
  });

  it("does not collapse navy into black the way RGB distance would", () => {
    expect(nearestReferenceColor("#1F305E")?.name).not.toBe("Black");
  });

  it("returns null for unparseable input", () => {
    expect(nearestReferenceColor("nope")).toBeNull();
  });
});

describe("harmony classification", () => {
  it("measures hue distance on the shorter arc", () => {
    expect(hueDistance(350, 10)).toBe(20);
    expect(hueDistance(10, 350)).toBe(20);
  });

  it("labels relationships with stylist vocabulary", () => {
    expect(describeHarmony("#C8102E", "#008080")).toBe("complementary");
    expect(describeHarmony("#87CEEB", "#2B4FA2")).toBe("analogous");
    expect(describeHarmony("#1F305E", "#2B4FA2")).toBe("monochrome");
  });

  it("treats greyscale as an anchor, not a hue partner", () => {
    expect(describeHarmony("#111111", "#C8102E")).toBe("neutral-anchored");
    expect(describeHarmony("#FFFFFF", "#1F305E")).toBe("neutral-anchored");
  });
});

describe("scoreColorForUndertone", () => {
  it("favours matching temperature", () => {
    const warmOnWarm = scoreColorForUndertone("#C19A6B", "warm");
    const coolOnWarm = scoreColorForUndertone("#87CEEB", "warm");
    expect(warmOnWarm).toBeGreaterThan(coolOnWarm);
  });

  it("stays permissive for neutral and unknown undertones", () => {
    expect(scoreColorForUndertone("#87CEEB", "neutral")).toBeGreaterThan(0.8);
    expect(scoreColorForUndertone("#87CEEB", null)).toBeGreaterThan(0.8);
  });
});

describe("averageHex", () => {
  it("weights contributions", () => {
    const mostlyBlack = averageHex([
      { hex: "#000000", weight: 9 },
      { hex: "#FFFFFF", weight: 1 },
    ])!;
    const mostlyWhite = averageHex([
      { hex: "#000000", weight: 1 },
      { hex: "#FFFFFF", weight: 9 },
    ])!;
    expect(hexToRgb(mostlyBlack)!.r).toBeLessThan(hexToRgb(mostlyWhite)!.r);
  });

  it("ignores unparseable and zero-weight entries", () => {
    expect(averageHex([{ hex: "bogus", weight: 1 }])).toBeNull();
    expect(averageHex([{ hex: "#FFFFFF", weight: 0 }])).toBeNull();
    expect(averageHex([])).toBeNull();
  });
});
