import { cookies } from "next/headers";
import { SESSION_COOKIE, clearSessionCookie, destroySession } from "@/lib/auth";
import { handleRouteError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) await destroySession(token);
    await clearSessionCookie();
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
