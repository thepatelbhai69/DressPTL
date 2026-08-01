import { requireUser } from "@/lib/auth";
import { getStyleProfile } from "@/lib/db";
import { generateRecommendations, recomputeStyleProfile } from "@/lib/analysis";
import { fail, handleRouteError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireUser();

    const profile =
      (await getStyleProfile(user.id)) ?? (await recomputeStyleProfile(user.id));

    if (profile.photoCount === 0) {
      return fail("Upload an outfit photo first.", 400);
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
