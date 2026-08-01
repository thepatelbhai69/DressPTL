import { requireUser } from "@/lib/auth";
import { deletePhoto } from "@/lib/db";
import { analyzeStoredPhoto, recomputeStyleProfile } from "@/lib/analysis";
import { fail, handleRouteError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Retry analysis for a photo that previously failed. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const analysis = await analyzeStoredPhoto(id, user.id);
    return json({ analysis });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const deleted = await deletePhoto(id, user.id);
    if (!deleted) return fail("Not found", 404);

    // The profile was learned from this photo, so it has to be rebuilt.
    await recomputeStyleProfile(user.id);
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
