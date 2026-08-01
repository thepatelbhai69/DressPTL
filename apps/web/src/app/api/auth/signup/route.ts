import {
  createSession,
  hashPassword,
  isValidEmail,
  passwordProblem,
  setSessionCookie,
} from "@/lib/auth";
import { createUser, findUserByEmail } from "@/lib/db";
import { fail, handleRouteError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String((body as { email?: string }).email ?? "").trim();
    const password = String((body as { password?: string }).password ?? "");
    const name = (body as { name?: string }).name?.trim() || null;

    if (!isValidEmail(email)) return fail("Enter a valid email address.", 400);
    const problem = passwordProblem(password);
    if (problem) return fail(problem, 400);

    if (await findUserByEmail(email)) {
      return fail("An account with that email already exists.", 409);
    }

    const userId = await createUser({
      email,
      passwordHash: await hashPassword(password),
      name,
    });

    await setSessionCookie(await createSession(userId));
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
