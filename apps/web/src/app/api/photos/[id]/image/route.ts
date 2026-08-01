import { requireUser } from "@/lib/auth";
import { getPhotoBucket } from "@/lib/cf";
import { getPhoto } from "@/lib/db";
import { fail, handleRouteError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Authenticated image delivery.
 *
 * The original plan called for R2 presigned URLs, but those need S3 API
 * credentials that a Worker with an R2 binding does not have. Streaming
 * through this route is also stricter: every request is authorised against
 * the session, and there is no URL that keeps working once shared.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const photo = await getPhoto(id, user.id);
    if (!photo) return fail("Not found", 404);

    const object = await getPhotoBucket().get(photo.r2_key);
    if (!object) return fail("Not found", 404);

    return new Response(object.body, {
      headers: {
        "content-type": photo.mime_type,
        "cache-control": "private, max-age=3600",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
