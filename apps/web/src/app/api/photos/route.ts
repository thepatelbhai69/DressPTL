import { requireUser } from "@/lib/auth";
import { getPhotoBucket } from "@/lib/cf";
import { insertPhoto } from "@/lib/db";
import { analyzeStoredPhoto } from "@/lib/analysis";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  fail,
  handleRouteError,
  json,
} from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    if (!user.consentAt) {
      return fail("Consent to photo analysis is required first.", 403);
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("No file uploaded.", 400);

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      return fail("Upload a JPEG, PNG, or WebP image.", 415);
    }
    if (file.size > MAX_UPLOAD_BYTES) return fail("Image must be under 8MB.", 413);
    if (file.size === 0) return fail("That file is empty.", 400);

    // Key is namespaced by user so a bug in one query cannot cross accounts.
    const r2Key = `users/${user.id}/${crypto.randomUUID()}`;
    await getPhotoBucket().put(r2Key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });

    const photoId = await insertPhoto({
      userId: user.id,
      r2Key,
      mimeType: file.type,
    });

    // Analysed inline so the user sees the result immediately. The photo row
    // is already persisted, so a model failure leaves a retryable record
    // rather than losing the upload.
    try {
      const analysis = await analyzeStoredPhoto(photoId, user.id);
      return json({ photoId, analysis }, 201);
    } catch (error) {
      return json(
        {
          photoId,
          analysis: null,
          warning:
            error instanceof Error ? error.message : "Analysis failed; retry later.",
        },
        201,
      );
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
