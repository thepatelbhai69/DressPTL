import { requireUser } from "@/lib/auth";
import { updateUserDetails } from "@/lib/db";
import { fail, handleRouteError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json().catch(() => ({}))) as {
      heightCm?: unknown;
      consent?: unknown;
      name?: unknown;
    };

    let heightCm: number | null | undefined;
    if (body.heightCm !== undefined && body.heightCm !== null && body.heightCm !== "") {
      const value = Number(body.heightCm);
      if (!Number.isInteger(value) || value < 100 || value > 250) {
        return fail("Height must be a whole number between 100 and 250 cm.", 400);
      }
      heightCm = value;
    }

    await updateUserDetails(user.id, {
      heightCm,
      consent: body.consent === true,
      name: typeof body.name === "string" ? body.name.trim() || null : undefined,
    });

    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
