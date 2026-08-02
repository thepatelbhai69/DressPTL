import {
  determineSeason,
  SEASONS,
  type StyleProfile,
} from "@dressptl/shared";
import { requireUser } from "@/lib/auth";
import { getStyleProfile } from "@/lib/db";
import { generateRecommendations, recomputeStyleProfile } from "@/lib/analysis";
import { getSkinProfile } from "@/lib/skin";
import { fail, handleRouteError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Turn a colour season into a StyleProfile so the existing recommendation
 * machinery works with no wardrobe at all. The season palette stands in for
 * "colours this person wears" — which is the point of the app now: your
 * colours come from your colouring, not from re-photographing your clothes.
 */
function profileFromSeason(season: keyof typeof SEASONS): StyleProfile {
  const palette = SEASONS[season].palette.slice(0, 6);
  return {
    palette: palette.map((colour, index) => ({
      name: colour.name,
      hex: colour.hex,
      weight: palette.length - index,
      share: (palette.length - index) / ((palette.length * (palette.length + 1)) / 2),
      temperature: season === "Spring" || season === "Autumn" ? "warm" : "cool",
    })),
    blends: [],
    styleTags: [],
    undertone: season === "Spring" || season === "Autumn" ? "warm" : "cool",
    silhouette: null,
    photoCount: 0,
  };
}

export async function POST() {
  try {
    const user = await requireUser();

    const skin = await getSkinProfile(user.id);
    const wardrobe =
      (await getStyleProfile(user.id)) ?? (await recomputeStyleProfile(user.id));

    // Prefer the learned wardrobe when there is one, since it carries the
    // user's actual taste. Otherwise the season palette alone is enough.
    let profile: StyleProfile;
    if (wardrobe.photoCount > 0) {
      profile = skin?.undertone
        ? { ...wardrobe, undertone: skin.undertone }
        : wardrobe;
    } else if (skin?.undertone) {
      profile = profileFromSeason(determineSeason(skin));
    } else {
      return fail("Find your colours first.", 400);
    }

    const { outfits, degraded } = await generateRecommendations(
      user.id,
      profile,
      user.heightCm,
    );

    return json({ outfits, degraded });
  } catch (error) {
    return handleRouteError(error);
  }
}
