/**
 * Orchestration between R2, the Mistral proxy, and D1.
 *
 * Note the division of responsibility: this module reads the image from R2 and
 * hands bytes to the proxy. The proxy never touches storage or the database,
 * so a compromise there exposes the Mistral key's blast radius only — no user
 * data.
 */

import {
  buildStyleProfile,
  photoAnalysisSchema,
  recommendationsResponseSchema,
  suggestPaletteAdditions,
  type OutfitRecommendation,
  type PhotoAnalysis,
  type StyleProfile,
} from "@dressptl/shared";
import { getEnv, getPhotoBucket } from "./cf";
import {
  getPhoto,
  listAnalysesForProfile,
  saveAnalysis,
  saveRecommendations,
  saveStyleProfile,
  setPhotoStatus,
} from "./db";

export class AnalysisError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
  ) {
    super(message);
    this.name = "AnalysisError";
  }
}

import { bytesToBase64 } from "./encoding";

export { bytesToBase64 };

export async function callProxy<T>(
  path: string,
  body: unknown,
  userId: string,
): Promise<T> {
  const env = getEnv();
  if (!env.MISTRAL_PROXY) {
    throw new AnalysisError("MISTRAL_PROXY service binding is not configured", 500);
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-user-id": userId,
  };
  if (env.PROXY_SHARED_SECRET) headers["x-proxy-secret"] = env.PROXY_SHARED_SECRET;

  // Hostname is arbitrary: service bindings route by binding, not DNS.
  const response = await env.MISTRAL_PROXY.fetch(
    new Request(`https://proxy.internal${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );

  if (!response.ok) {
    const detail = await response
      .json<{ error?: string }>()
      .catch(() => ({ error: undefined }));
    throw new AnalysisError(
      detail.error ?? `Analysis service returned ${response.status}`,
      response.status === 429 ? 429 : 502,
    );
  }

  return response.json<T>();
}

/**
 * Analyse one stored photo and fold the result into the user's style profile.
 * Marks the photo `failed` (with the reason) rather than throwing away the
 * upload if the model call fails, so the user can retry.
 */
export async function analyzeStoredPhoto(
  photoId: string,
  userId: string,
): Promise<PhotoAnalysis> {
  const photo = await getPhoto(photoId, userId);
  if (!photo) throw new AnalysisError("Photo not found", 404);

  try {
    const object = await getPhotoBucket().get(photo.r2_key);
    if (!object) throw new AnalysisError("Stored image is missing", 404);

    const bytes = new Uint8Array(await object.arrayBuffer());
    const raw = await callProxy<unknown>(
      "/analyze-photo",
      {
        imageBase64: bytesToBase64(bytes),
        mimeType: photo.mime_type,
      },
      userId,
    );

    const parsed = photoAnalysisSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AnalysisError("Analysis service returned unexpected data");
    }

    await saveAnalysis(photoId, userId, parsed.data);
    await setPhotoStatus(photoId, "analyzed", null);
    await recomputeStyleProfile(userId);
    return parsed.data;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analysis failed";
    await setPhotoStatus(photoId, "failed", message.slice(0, 300));
    throw error;
  }
}

export async function recomputeStyleProfile(
  userId: string,
): Promise<StyleProfile> {
  const analyses = await listAnalysesForProfile(userId);
  const profile = buildStyleProfile(analyses);
  await saveStyleProfile(userId, profile);
  return profile;
}

/**
 * Ask the model for outfits, seeded with deterministic palette suggestions.
 *
 * If the model is unavailable we fall back to those deterministic suggestions
 * rather than showing an error page — a thinner result is better than none.
 */
export async function generateRecommendations(
  userId: string,
  profile: StyleProfile,
  heightCm: number | null,
  count = 4,
): Promise<{ outfits: OutfitRecommendation[]; degraded: boolean }> {
  const suggestedColors = suggestPaletteAdditions(profile, 4).map((color) => ({
    name: color.name,
    hex: color.hex,
    reason: color.reason,
  }));

  try {
    const raw = await callProxy<unknown>(
      "/generate-recommendations",
      { profile, heightCm, count, suggestedColors },
      userId,
    );
    const parsed = recommendationsResponseSchema.safeParse(raw);
    if (!parsed.success) throw new AnalysisError("Malformed recommendations");

    await saveRecommendations(userId, parsed.data.outfits);
    return { outfits: parsed.data.outfits, degraded: false };
  } catch (error) {
    if (error instanceof AnalysisError && error.status === 429) throw error;

    const fallback = buildFallbackOutfits(profile, suggestedColors);
    if (fallback.length === 0) throw error;
    return { outfits: fallback, degraded: true };
  }
}

/** Deterministic outfits built purely from the learned palette. */
function buildFallbackOutfits(
  profile: StyleProfile,
  suggested: ReadonlyArray<{ name: string; hex: string; reason: string }>,
): OutfitRecommendation[] {
  if (profile.palette.length === 0) return [];

  return profile.blends.slice(0, 3).map((blend, index) => ({
    title: `${blend.names[0]} with ${blend.names[1]}`,
    occasion: ["weekend", "office", "evening"][index % 3]!,
    items: [
      { garment: "top", colorName: blend.names[0], colorHex: blend.hexes[0] },
      { garment: "bottom", colorName: blend.names[1], colorHex: blend.hexes[1] },
      ...(suggested[index]
        ? [
            {
              garment: "outer layer",
              colorName: suggested[index]!.name,
              colorHex: suggested[index]!.hex,
            },
          ]
        : []),
    ],
    rationale: `A ${blend.harmony} pairing you already wear often (${(
      blend.share * 100
    ).toFixed(0)}% of your combinations).`,
    silhouetteNote: profile.silhouette
      ? `Suited to a ${profile.silhouette} silhouette.`
      : undefined,
  }));
}
