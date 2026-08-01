/**
 * D1 access layer. Plain SQL rather than an ORM: at this schema size the
 * indirection would cost more than it saves, and migrations stay readable.
 */

import type {
  AnalysisLike,
  OutfitRecommendation,
  PhotoAnalysis,
  StyleProfile,
  Undertone,
} from "@dressptl/shared";
import { getDb, getPhotoBucket } from "./cf";

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  height_cm: number | null;
  consent_at: string | null;
  created_at: string;
}

export async function findUserByEmail(
  email: string,
): Promise<UserRecord | null> {
  return getDb()
    .prepare("SELECT * FROM users WHERE email = ?")
    .bind(email.toLowerCase())
    .first<UserRecord>();
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  name?: string | null;
}): Promise<string> {
  const id = newId();
  await getDb()
    .prepare(
      "INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(id, input.email.toLowerCase(), input.passwordHash, input.name ?? null, now())
    .run();
  return id;
}

export async function updateUserDetails(
  userId: string,
  input: { heightCm?: number | null; consent?: boolean; name?: string | null },
): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (input.heightCm !== undefined) {
    sets.push("height_cm = ?");
    values.push(input.heightCm);
  }
  if (input.name !== undefined) {
    sets.push("name = ?");
    values.push(input.name);
  }
  if (input.consent === true) {
    sets.push("consent_at = ?");
    values.push(now());
  }
  if (sets.length === 0) return;

  values.push(userId);
  await getDb()
    .prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();
}

export interface PhotoRecord {
  id: string;
  user_id: string;
  r2_key: string;
  mime_type: string;
  status: "pending" | "analyzed" | "failed";
  error: string | null;
  created_at: string;
}

export async function insertPhoto(input: {
  userId: string;
  r2Key: string;
  mimeType: string;
}): Promise<string> {
  const id = newId();
  await getDb()
    .prepare(
      "INSERT INTO photos (id, user_id, r2_key, mime_type, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
    )
    .bind(id, input.userId, input.r2Key, input.mimeType, now())
    .run();
  return id;
}

/** Scoped by user id on purpose — never look a photo up by id alone. */
export async function getPhoto(
  photoId: string,
  userId: string,
): Promise<PhotoRecord | null> {
  return getDb()
    .prepare("SELECT * FROM photos WHERE id = ? AND user_id = ?")
    .bind(photoId, userId)
    .first<PhotoRecord>();
}

export async function setPhotoStatus(
  photoId: string,
  status: PhotoRecord["status"],
  error?: string | null,
): Promise<void> {
  await getDb()
    .prepare("UPDATE photos SET status = ?, error = ? WHERE id = ?")
    .bind(status, error ?? null, photoId)
    .run();
}

export interface AnalysisRecord {
  id: string;
  photo_id: string;
  user_id: string;
  colors_json: string;
  garments_json: string;
  style_tags_json: string;
  skin_undertone: string | null;
  body_silhouette: string | null;
  color_harmony: string | null;
  created_at: string;
}

export async function saveAnalysis(
  photoId: string,
  userId: string,
  analysis: PhotoAnalysis,
): Promise<void> {
  await getDb()
    .prepare(
      `INSERT INTO photo_analyses
         (id, photo_id, user_id, colors_json, garments_json, style_tags_json,
          skin_undertone, body_silhouette, color_harmony, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(photo_id) DO UPDATE SET
         colors_json = excluded.colors_json,
         garments_json = excluded.garments_json,
         style_tags_json = excluded.style_tags_json,
         skin_undertone = excluded.skin_undertone,
         body_silhouette = excluded.body_silhouette,
         color_harmony = excluded.color_harmony`,
    )
    .bind(
      newId(),
      photoId,
      userId,
      JSON.stringify(analysis.colors),
      JSON.stringify(analysis.garments),
      JSON.stringify(analysis.styleTags),
      analysis.skinUndertone,
      analysis.bodySilhouette,
      analysis.colorHarmony ?? null,
      now(),
    )
    .run();
}

export interface PhotoWithAnalysis {
  photo: PhotoRecord;
  analysis: AnalysisRecord | null;
}

export async function listPhotos(userId: string): Promise<PhotoWithAnalysis[]> {
  const { results } = await getDb()
    .prepare(
      `SELECT p.*,
              a.id AS a_id, a.colors_json, a.garments_json, a.style_tags_json,
              a.skin_undertone, a.body_silhouette, a.color_harmony,
              a.created_at AS a_created_at
         FROM photos p
         LEFT JOIN photo_analyses a ON a.photo_id = p.id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC`,
    )
    .bind(userId)
    .all<PhotoRecord & Record<string, unknown>>();

  return (results ?? []).map((row) => ({
    photo: {
      id: row.id,
      user_id: row.user_id,
      r2_key: row.r2_key,
      mime_type: row.mime_type,
      status: row.status,
      error: row.error,
      created_at: row.created_at,
    },
    analysis: row.a_id
      ? ({
          id: row.a_id as string,
          photo_id: row.id,
          user_id: row.user_id,
          colors_json: row.colors_json as string,
          garments_json: row.garments_json as string,
          style_tags_json: row.style_tags_json as string,
          skin_undertone: row.skin_undertone as string | null,
          body_silhouette: row.body_silhouette as string | null,
          color_harmony: row.color_harmony as string | null,
          created_at: row.a_created_at as string,
        } satisfies AnalysisRecord)
      : null,
  }));
}

/** Newest first — `buildStyleProfile` relies on that for recency weighting. */
export async function listAnalysesForProfile(
  userId: string,
): Promise<AnalysisLike[]> {
  const { results } = await getDb()
    .prepare(
      `SELECT colors_json, style_tags_json, skin_undertone, body_silhouette
         FROM photo_analyses
        WHERE user_id = ?
        ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<{
      colors_json: string;
      style_tags_json: string;
      skin_undertone: string | null;
      body_silhouette: string | null;
    }>();

  return (results ?? []).map((row) => ({
    colors: safeParse(row.colors_json, []),
    styleTags: safeParse<string[]>(row.style_tags_json, []),
    skinUndertone: (row.skin_undertone as Undertone | null) ?? null,
    bodySilhouette: row.body_silhouette,
  }));
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function saveStyleProfile(
  userId: string,
  profile: StyleProfile,
): Promise<void> {
  await getDb()
    .prepare(
      `INSERT INTO style_profiles (user_id, profile_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         profile_json = excluded.profile_json,
         updated_at = excluded.updated_at`,
    )
    .bind(userId, JSON.stringify(profile), now())
    .run();
}

export async function getStyleProfile(
  userId: string,
): Promise<StyleProfile | null> {
  const row = await getDb()
    .prepare("SELECT profile_json FROM style_profiles WHERE user_id = ?")
    .bind(userId)
    .first<{ profile_json: string }>();
  return row ? safeParse<StyleProfile | null>(row.profile_json, null) : null;
}

export async function saveRecommendations(
  userId: string,
  outfits: OutfitRecommendation[],
): Promise<void> {
  await getDb()
    .prepare(
      "INSERT INTO recommendations (id, user_id, content_json, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(newId(), userId, JSON.stringify(outfits), now())
    .run();
}

export async function getLatestRecommendations(
  userId: string,
): Promise<{ outfits: OutfitRecommendation[]; createdAt: string } | null> {
  const row = await getDb()
    .prepare(
      "SELECT content_json, created_at FROM recommendations WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .bind(userId)
    .first<{ content_json: string; created_at: string }>();
  if (!row) return null;
  return {
    outfits: safeParse<OutfitRecommendation[]>(row.content_json, []),
    createdAt: row.created_at,
  };
}

export async function deletePhoto(
  photoId: string,
  userId: string,
): Promise<boolean> {
  const photo = await getPhoto(photoId, userId);
  if (!photo) return false;

  await getPhotoBucket().delete(photo.r2_key);
  const db = getDb();
  await db.batch([
    db.prepare("DELETE FROM photo_analyses WHERE photo_id = ?").bind(photoId),
    db.prepare("DELETE FROM photos WHERE id = ? AND user_id = ?").bind(photoId, userId),
  ]);
  return true;
}

/**
 * Full account erasure: R2 objects first, then every row. Deletes are explicit
 * rather than relying on ON DELETE CASCADE, since D1 does not enforce foreign
 * keys by default and silently orphaned rows would defeat the promise.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const { results } = await getDb()
    .prepare("SELECT r2_key FROM photos WHERE user_id = ?")
    .bind(userId)
    .all<{ r2_key: string }>();

  const keys = (results ?? []).map((row) => row.r2_key);
  // R2 delete accepts up to 1000 keys per call.
  for (let i = 0; i < keys.length; i += 1000) {
    await getPhotoBucket().delete(keys.slice(i, i + 1000));
  }

  const db = getDb();
  await db.batch([
    db.prepare("DELETE FROM photo_analyses WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM photos WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM style_profiles WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM recommendations WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM users WHERE id = ?").bind(userId),
  ]);
}
