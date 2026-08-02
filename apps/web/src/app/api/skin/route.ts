import {
  quizToSkinAnalysis,
  type ContrastLevel,
  type Depth,
  type QuizAnswers,
  type SkinAnalysis,
  type Undertone,
} from "@dressptl/shared";
import { requireUser } from "@/lib/auth";
import { analyzeSkinFromImage, saveSkinProfile } from "@/lib/skin";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  fail,
  handleRouteError,
  json,
} from "@/lib/http";

export const dynamic = "force-dynamic";

/** Selfie path: analyse once, store the reading, never store the image. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!user.consentAt) {
      return fail("Consent to photo analysis is required first.", 403);
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("No photo uploaded.", 400);

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      return fail("Upload a JPEG, PNG, or WebP image.", 415);
    }
    if (file.size > MAX_UPLOAD_BYTES) return fail("Image must be under 8MB.", 413);
    if (file.size === 0) return fail("That file is empty.", 400);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const analysis = await analyzeSkinFromImage(user.id, bytes, file.type);

    if (!analysis.undertone) {
      return fail(
        analysis.note ??
          "Could not read your colouring from that photo. Try daylight, no filter — or use the quiz instead.",
        422,
      );
    }

    await saveSkinProfile(user.id, analysis, "photo");
    return json({ analysis });
  } catch (error) {
    return handleRouteError(error);
  }
}

const isOneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value);

/**
 * Quiz and manual-correction path.
 *
 * Correction matters more than it looks: a single uncontrolled photo gets
 * undertone wrong often enough that a result the user cannot overrule would be
 * worse than no result at all.
 */
export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const depth = isOneOf(body.depth, ["light", "medium", "deep"] as const)
      ? (body.depth as Depth)
      : undefined;
    const contrast = isOneOf(body.contrast, ["low", "medium", "high"] as const)
      ? (body.contrast as ContrastLevel)
      : undefined;

    if (body.mode === "quiz") {
      if (
        !isOneOf(body.veins, ["green", "blue", "both"] as const) ||
        !isOneOf(body.metal, ["gold", "silver", "both"] as const) ||
        !isOneOf(body.sun, ["tans", "burns", "both"] as const)
      ) {
        return fail("Answer all three questions.", 400);
      }

      const answers: QuizAnswers = {
        veins: body.veins,
        metal: body.metal,
        sun: body.sun,
        depth,
        contrast,
      };
      const analysis = quizToSkinAnalysis(answers);
      await saveSkinProfile(user.id, analysis, "quiz");
      return json({ analysis });
    }

    // Manual override. Whatever the user says wins, at full confidence.
    if (!isOneOf(body.undertone, ["warm", "cool", "neutral"] as const)) {
      return fail("Choose an undertone.", 400);
    }

    const analysis: SkinAnalysis = {
      undertone: body.undertone as Undertone,
      depth: depth ?? null,
      contrast: contrast ?? null,
      confidence: "high",
      note: "Set by you.",
    };
    await saveSkinProfile(user.id, analysis, "manual");
    return json({ analysis });
  } catch (error) {
    return handleRouteError(error);
  }
}
