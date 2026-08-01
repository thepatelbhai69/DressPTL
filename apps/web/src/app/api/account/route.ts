import { clearSessionCookie, requireUser } from "@/lib/auth";
import { deleteAccount } from "@/lib/db";
import { handleRouteError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Erases every trace of the account: R2 objects, all rows, all sessions. */
export async function DELETE() {
  try {
    const user = await requireUser();
    await deleteAccount(user.id);
    await clearSessionCookie();
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
