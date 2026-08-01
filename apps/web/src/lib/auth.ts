/**
 * Authentication.
 *
 * Hand-rolled rather than NextAuth: the Credentials provider pins you to JWT
 * sessions, which conflicts with revocable server-side sessions, and running
 * the beta on workerd adds risk for no gain here. This is ~100 lines of Web
 * Crypto that works natively on the Workers runtime.
 */

import { cookies } from "next/headers";
import { getDb } from "./cf";
import { sha256Base64, toBase64 } from "./password";

export const SESSION_COOKIE = "dressptl_session";
const SESSION_TTL_DAYS = 30;

// Password primitives live in ./password so they stay unit-testable without a
// Workers runtime. Re-exported here so callers have one auth entry point.
export {
  hashPassword,
  verifyPassword,
  isValidEmail,
  passwordProblem,
} from "./password";

/** Sessions are stored as a digest so a database leak yields no live tokens. */
async function tokenDigest(token: string): Promise<string> {
  return sha256Base64(token);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  heightCm: number | null;
  consentAt: string | null;
}

export async function createSession(userId: string): Promise<string> {
  const token = toBase64(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  await getDb()
    .prepare(
      "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(await tokenDigest(token), userId, expiresAt, new Date().toISOString())
    .run();

  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function destroySession(token: string): Promise<void> {
  await getDb()
    .prepare("DELETE FROM sessions WHERE id = ?")
    .bind(await tokenDigest(token))
    .run();
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  height_cm: number | null;
  consent_at: string | null;
}

/** Returns the signed-in user, or null. Expired sessions are cleaned up. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const digest = await tokenDigest(token);
  const row = await getDb()
    .prepare(
      `SELECT u.id, u.email, u.name, u.height_cm, u.consent_at, s.expires_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ?`,
    )
    .bind(digest)
    .first<UserRow & { expires_at: string }>();

  if (!row) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await getDb().prepare("DELETE FROM sessions WHERE id = ?").bind(digest).run();
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    heightCm: row.height_cm,
    consentAt: row.consent_at,
  };
}

/** For route handlers: throws a 401-shaped error when unauthenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthorizedError";
  }
}
