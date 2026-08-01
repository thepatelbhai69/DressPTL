import { NextResponse } from "next/server";
import { UnauthorizedError } from "./auth";
import { AnalysisError } from "./analysis";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Maps known error types to responses; anything else becomes an opaque 500. */
export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) return fail("Not signed in", 401);
  if (error instanceof AnalysisError) return fail(error.message, error.status);
  console.error("Unhandled route error:", error);
  return fail("Something went wrong", 500);
}

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** 8MB: comfortably under the proxy's base64 ceiling once encoded. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
