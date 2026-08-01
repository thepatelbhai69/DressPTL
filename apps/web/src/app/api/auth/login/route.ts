import { createSession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { findUserByEmail } from "@/lib/db";
import { fail, handleRouteError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String((body as { email?: string }).email ?? "").trim();
    const password = String((body as { password?: string }).password ?? "");

    const user = await findUserByEmail(email);

    // Same message and comparable work either way, so the response does not
    // reveal whether an account exists.
    const ok = user
      ? await verifyPassword(password, user.password_hash)
      : await verifyPassword(password, "pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");

    if (!user || !ok) return fail("Incorrect email or password.", 401);

    await setSessionCookie(await createSession(user.id));
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
