/**
 * Server-side skin profile: read once, stored on the user, correctable by hand.
 */

import {
  detectColorCast,
  skinAnalysisSchema,
  type Confidence,
  type ContrastLevel,
  type Depth,
  type SkinAnalysis,
  type Undertone,
} from "@dressptl/shared";
import { getDb } from "./cf";
import { AnalysisError, callProxy } from "./analysis";
import { bytesToBase64 } from "./encoding";

export type SkinSource = "photo" | "quiz" | "manual";

export interface StoredSkinProfile extends SkinAnalysis {
  source: SkinSource | null;
  updatedAt: string | null;
}

interface SkinRow {
  skin_undertone: string | null;
  skin_depth: string | null;
  skin_contrast: string | null;
  skin_confidence: string | null;
  skin_source: string | null;
  skin_note: string | null;
  skin_updated_at: string | null;
}

export async function getSkinProfile(
  userId: string,
): Promise<StoredSkinProfile | null> {
  const row = await getDb()
    .prepare(
      `SELECT skin_undertone, skin_depth, skin_contrast, skin_confidence,
              skin_source, skin_note, skin_updated_at
         FROM users WHERE id = ?`,
    )
    .bind(userId)
    .first<SkinRow>();

  if (!row || !row.skin_updated_at) return null;

  return {
    undertone: (row.skin_undertone as Undertone | null) ?? null,
    depth: (row.skin_depth as Depth | null) ?? null,
    contrast: (row.skin_contrast as ContrastLevel | null) ?? null,
    confidence: (row.skin_confidence as Confidence | null) ?? "low",
    note: row.skin_note ?? undefined,
    source: (row.skin_source as SkinSource | null) ?? null,
    updatedAt: row.skin_updated_at,
  };
}

export async function saveSkinProfile(
  userId: string,
  analysis: SkinAnalysis,
  source: SkinSource,
): Promise<void> {
  await getDb()
    .prepare(
      `UPDATE users SET
         skin_undertone = ?, skin_depth = ?, skin_contrast = ?,
         skin_confidence = ?, skin_source = ?, skin_note = ?,
         skin_updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      analysis.undertone,
      analysis.depth,
      analysis.contrast,
      analysis.confidence,
      source,
      analysis.note ?? null,
      new Date().toISOString(),
      userId,
    )
    .run();
}

/**
 * Analyse a selfie for colouring.
 *
 * The image is never stored: it is read into memory, sent to the proxy, and
 * dropped. A one-off measurement does not justify keeping a photo of someone's
 * face around, and not storing it removes the question of who can reach it.
 */
export async function analyzeSkinFromImage(
  userId: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<SkinAnalysis> {
  const raw = await callProxy<unknown>(
    "/analyze-skin",
    { imageBase64: bytesToBase64(bytes), mimeType },
    userId,
  );

  const parsed = skinAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AnalysisError("Colour analysis returned unexpected data");
  }

  const result: SkinAnalysis = {
    undertone: parsed.data.undertone,
    depth: parsed.data.depth,
    contrast: parsed.data.contrast,
    confidence: parsed.data.confidence,
    note: parsed.data.note,
  };

  // A warm-lit photo fakes a warm undertone for almost anyone, so say so
  // rather than presenting a confident wrong answer.
  if (parsed.data.dominantSkinHex) {
    const cast = detectColorCast(parsed.data.dominantSkinHex);
    if (cast) {
      result.note = result.note ? `${result.note} ${cast}` : cast;
      if (result.confidence === "high") result.confidence = "medium";
    }
  }

  return result;
}
