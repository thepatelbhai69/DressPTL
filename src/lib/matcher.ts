import type { Depth, Undertone } from "./color";
import { CATALOG, type Category, type CatalogItem, type Intensity } from "./catalog";

// Which contrast/intensity levels flatter each depth, ordered by preference.
// Very light or very deep skin reads best with either soft or bold accents
// (avoiding "washed out" mid-tones); medium depths carry more range.
const DEPTH_INTENSITY_PREFERENCE: Record<Depth, Intensity[]> = {
  fair: ["soft", "medium", "bold"],
  light: ["soft", "medium", "bold"],
  medium: ["medium", "soft", "bold"],
  tan: ["bold", "medium", "soft"],
  deep: ["bold", "medium", "soft"],
};

export interface OutfitPick {
  item: CatalogItem;
  score: number;
}

export interface OutfitRecommendation {
  category: Category;
  best: OutfitPick;
  alternates: OutfitPick[];
}

function scoreItem(
  item: CatalogItem,
  undertone: Undertone,
  depth: Depth
): number {
  let score = 0;

  if (item.undertones.includes(undertone)) {
    score += 3;
  } else if (item.undertones.includes("neutral")) {
    score += 1;
  }

  const preference = DEPTH_INTENSITY_PREFERENCE[depth];
  for (const intensity of item.intensities) {
    const rank = preference.indexOf(intensity);
    if (rank !== -1) {
      score += preference.length - rank;
      break;
    }
  }

  return score;
}

export function recommendOutfit(
  undertone: Undertone,
  depth: Depth
): OutfitRecommendation[] {
  const byCategory = new Map<Category, CatalogItem[]>();
  for (const item of CATALOG) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  const results: OutfitRecommendation[] = [];
  for (const [category, items] of byCategory) {
    const scored = items
      .map((item) => ({ item, score: scoreItem(item, undertone, depth) }))
      .sort((a, b) => b.score - a.score);

    results.push({
      category,
      best: scored[0],
      alternates: scored.slice(1, 3),
    });
  }

  const order: Category[] = [
    "top",
    "bottom",
    "outerwear",
    "shoes",
    "socks",
    "jewelry",
    "watch",
    "hair",
  ];
  results.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));

  return results;
}
