import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface CloudflareEnv {
  DB: D1Database;
  PHOTOS: R2Bucket;
  RATE_LIMIT?: KVNamespace;
  /** Service binding to dressptl-mistral-proxy. No public route exists. */
  MISTRAL_PROXY: Fetcher;
  PROXY_SHARED_SECRET?: string;
}

/**
 * Bindings are only available while handling a request. Pages that touch the
 * database must therefore opt out of static prerendering (`force-dynamic`),
 * otherwise this throws during `next build`.
 */
export function getEnv(): CloudflareEnv {
  const { env } = getCloudflareContext();
  return env as unknown as CloudflareEnv;
}

export function getDb(): D1Database {
  const db = getEnv().DB;
  if (!db) throw new Error("D1 binding `DB` is not configured");
  return db;
}

export function getPhotoBucket(): R2Bucket {
  const bucket = getEnv().PHOTOS;
  if (!bucket) throw new Error("R2 binding `PHOTOS` is not configured");
  return bucket;
}
