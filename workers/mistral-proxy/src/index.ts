/**
 * Mistral proxy Worker.
 *
 * This is the only component holding MISTRAL_API_KEY. It is not published on
 * workers.dev and has no route: the web app reaches it exclusively through a
 * service binding, so there is no public URL an attacker could hit even if
 * they learned the worker's name. The shared-secret header is defence in
 * depth for the case where someone gains the ability to invoke the binding.
 */

import {
  analyzePhotoRequestSchema,
  buildAnalysisPrompt,
  buildRecommendationPrompt,
  generateRecommendationsRequestSchema,
  photoAnalysisSchema,
  recommendationsResponseSchema,
  SensitiveFieldError,
  type PhotoAnalysis,
} from "@dressptl/shared";
import {
  completeStructured,
  DEFAULT_TEXT_MODEL,
  DEFAULT_VISION_MODEL,
  MistralError,
  type ContentPart,
} from "./mistral";
import { stubAnalysis, stubRecommendations } from "./stub";

export interface Env {
  MISTRAL_API_KEY: string;
  MISTRAL_BASE_URL?: string;
  MISTRAL_VISION_MODEL?: string;
  MISTRAL_TEXT_MODEL?: string;
  /** Shared secret the web app must present. Set via `wrangler secret put`. */
  PROXY_SHARED_SECRET?: string;
  /** "1" serves deterministic fake results so the app runs without a key. */
  MISTRAL_STUB?: string;
  RATE_LIMIT?: KVNamespace;
  RATE_LIMIT_PER_MINUTE?: string;
}

/** Largest base64 payload we will forward (~8MB of image). */
const MAX_IMAGE_BASE64_BYTES = 11_000_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(message: string, status: number): Response {
  return json({ error: message }, status);
}

/**
 * Fixed-window counter in KV. Coarse by design — it exists to bound spend and
 * abuse, not to be a precise limiter.
 */
async function checkRateLimit(env: Env, userId: string): Promise<boolean> {
  if (!env.RATE_LIMIT) return true;
  const limit = Number(env.RATE_LIMIT_PER_MINUTE ?? "20");
  if (!Number.isFinite(limit) || limit <= 0) return true;

  const window = Math.floor(Date.now() / 60_000);
  const key = `rl:${userId}:${window}`;
  const current = Number((await env.RATE_LIMIT.get(key)) ?? "0");
  if (current >= limit) return false;

  await env.RATE_LIMIT.put(key, String(current + 1), { expirationTtl: 120 });
  return true;
}

function authorize(request: Request, env: Env): Response | null {
  if (!env.PROXY_SHARED_SECRET) return null;
  const presented = request.headers.get("x-proxy-secret");
  if (presented !== env.PROXY_SHARED_SECRET) {
    return errorResponse("Forbidden", 403);
  }
  return null;
}

function mapError(error: unknown): Response {
  if (error instanceof SensitiveFieldError) {
    // The model tried to volunteer a protected attribute. Fail closed.
    return errorResponse(
      "Analysis rejected: model returned a disallowed attribute.",
      422,
    );
  }
  if (error instanceof MistralError) {
    return errorResponse(error.message, error.status);
  }
  return errorResponse(
    error instanceof Error ? error.message : "Unknown error",
    500,
  );
}

async function handleAnalyzePhoto(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await request.json().catch(() => null);
  const parsed = analyzePhotoRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(`Invalid request: ${parsed.error.message}`, 400);
  }

  const { imageBase64, mimeType } = parsed.data;
  if (imageBase64.length > MAX_IMAGE_BASE64_BYTES) {
    return errorResponse("Image too large", 413);
  }

  if (env.MISTRAL_STUB === "1") {
    return json(stubAnalysis(imageBase64) satisfies PhotoAnalysis);
  }

  if (!env.MISTRAL_API_KEY) {
    return errorResponse("MISTRAL_API_KEY is not configured", 500);
  }

  const content: ContentPart[] = [
    { type: "text", text: buildAnalysisPrompt() },
    {
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${imageBase64}` },
    },
  ];

  const analysis = await completeStructured({
    apiKey: env.MISTRAL_API_KEY,
    baseUrl: env.MISTRAL_BASE_URL,
    model: env.MISTRAL_VISION_MODEL ?? DEFAULT_VISION_MODEL,
    messages: [{ role: "user", content }],
    schema: photoAnalysisSchema,
    maxTokens: 2000,
  });

  return json(analysis);
}

async function handleRecommendations(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await request.json().catch(() => null);
  const parsed = generateRecommendationsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(`Invalid request: ${parsed.error.message}`, 400);
  }

  const { profile, heightCm, count, suggestedColors } = parsed.data;

  if (env.MISTRAL_STUB === "1") {
    return json(stubRecommendations(profile, count, suggestedColors));
  }

  if (!env.MISTRAL_API_KEY) {
    return errorResponse("MISTRAL_API_KEY is not configured", 500);
  }

  const result = await completeStructured({
    apiKey: env.MISTRAL_API_KEY,
    baseUrl: env.MISTRAL_BASE_URL,
    model: env.MISTRAL_TEXT_MODEL ?? DEFAULT_TEXT_MODEL,
    messages: [
      {
        role: "user",
        content: buildRecommendationPrompt({
          profile,
          heightCm: heightCm ?? null,
          count,
          suggestedColors,
        }),
      },
    ],
    schema: recommendationsResponseSchema,
    maxTokens: 2500,
    temperature: 0.6,
  });

  return json(result);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({
        ok: true,
        stub: env.MISTRAL_STUB === "1",
        hasKey: Boolean(env.MISTRAL_API_KEY),
      });
    }

    const denied = authorize(request, env);
    if (denied) return denied;

    if (request.method !== "POST") {
      return errorResponse("Method not allowed", 405);
    }

    const userId = request.headers.get("x-user-id");
    if (!userId) return errorResponse("Missing x-user-id", 400);
    if (!(await checkRateLimit(env, userId))) {
      return errorResponse("Rate limit exceeded, try again shortly", 429);
    }

    try {
      switch (url.pathname) {
        case "/analyze-photo":
          return await handleAnalyzePhoto(request, env);
        case "/generate-recommendations":
          return await handleRecommendations(request, env);
        default:
          return errorResponse("Not found", 404);
      }
    } catch (error) {
      return mapError(error);
    }
  },
} satisfies ExportedHandler<Env>;
