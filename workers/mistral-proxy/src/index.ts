/**
 * AI proxy Worker.
 *
 * Default provider is **Workers AI**, which uses Cloudflare's account-scoped
 * inference binding — there is no API key in the system at all, so the whole
 * "don't leak the key" problem disappears rather than being managed.
 *
 * Setting AI_PROVIDER="mistral-api" switches to the direct Mistral API for
 * larger models; that path needs MISTRAL_API_KEY as a Worker secret, and this
 * Worker remains the only component that ever sees it.
 *
 * Either way the Worker is deployed with workers_dev = false and no route, so
 * it has no public URL; the web app reaches it only via a service binding.
 */

import {
  analyzePhotoRequestSchema,
  buildAnalysisPrompt,
  buildRecommendationPrompt,
  generateRecommendationsRequestSchema,
  photoAnalysisSchema,
  recommendationsResponseSchema,
  SensitiveFieldError,
  PHOTO_ANALYSIS_JSON_SCHEMA,
  RECOMMENDATIONS_JSON_SCHEMA,
  type PhotoAnalysis,
} from "@dressptl/shared";
import { completeStructured } from "./complete";
import { ProviderError, type AiProvider, type ContentPart } from "./providers/types";
import { createWorkersAiProvider } from "./providers/workersAi";
import { createMistralApiProvider } from "./providers/mistralApi";
import { stubAnalysis, stubRecommendations } from "./stub";

export interface Env {
  /** Workers AI binding. Present unless AI_PROVIDER is "mistral-api". */
  AI?: Ai;
  /** "workers-ai" (default) | "mistral-api" */
  AI_PROVIDER?: string;
  WORKERS_AI_MODEL?: string;

  /** Only needed when AI_PROVIDER === "mistral-api". */
  MISTRAL_API_KEY?: string;
  MISTRAL_BASE_URL?: string;
  MISTRAL_VISION_MODEL?: string;
  MISTRAL_TEXT_MODEL?: string;

  /** Shared secret the web app must present. Set via `wrangler secret put`. */
  PROXY_SHARED_SECRET?: string;
  /** "1" serves deterministic fake results so the app runs with no inference. */
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

export function selectProvider(env: Env): AiProvider {
  if (env.AI_PROVIDER === "mistral-api") {
    if (!env.MISTRAL_API_KEY) {
      throw new ProviderError(
        "AI_PROVIDER is mistral-api but MISTRAL_API_KEY is not set",
        500,
        false,
      );
    }
    return createMistralApiProvider({
      apiKey: env.MISTRAL_API_KEY,
      baseUrl: env.MISTRAL_BASE_URL,
      visionModel: env.MISTRAL_VISION_MODEL,
      textModel: env.MISTRAL_TEXT_MODEL,
    });
  }

  if (!env.AI) {
    throw new ProviderError("Workers AI binding `AI` is not configured", 500, false);
  }
  return createWorkersAiProvider({ ai: env.AI, model: env.WORKERS_AI_MODEL });
}

/**
 * Fixed-window counter in KV. Coarse by design — it exists to bound spend and
 * abuse (and to stay inside the Workers AI free allocation), not to be precise.
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
  if (request.headers.get("x-proxy-secret") !== env.PROXY_SHARED_SECRET) {
    return errorResponse("Forbidden", 403);
  }
  return null;
}

function mapError(error: unknown): Response {
  if (error instanceof SensitiveFieldError) {
    // The model tried to volunteer a protected attribute. Fail closed, and do
    // not echo the value back.
    return errorResponse(
      "Analysis rejected: model returned a disallowed attribute.",
      422,
    );
  }
  if (error instanceof ProviderError) {
    return errorResponse(error.message, error.status);
  }
  return errorResponse(
    error instanceof Error ? error.message : "Unknown error",
    500,
  );
}

async function handleAnalyzePhoto(request: Request, env: Env): Promise<Response> {
  const parsed = analyzePhotoRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
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

  const content: ContentPart[] = [
    { type: "text", text: buildAnalysisPrompt() },
    {
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${imageBase64}` },
    },
  ];

  const analysis = await completeStructured(
    selectProvider(env),
    {
      messages: [{ role: "user", content }],
      jsonSchema: PHOTO_ANALYSIS_JSON_SCHEMA,
      maxTokens: 2000,
      vision: true,
    },
    photoAnalysisSchema,
  );

  return json(analysis);
}

async function handleRecommendations(
  request: Request,
  env: Env,
): Promise<Response> {
  const parsed = generateRecommendationsRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return errorResponse(`Invalid request: ${parsed.error.message}`, 400);
  }

  const { profile, heightCm, count, suggestedColors } = parsed.data;

  if (env.MISTRAL_STUB === "1") {
    return json(stubRecommendations(profile, count, suggestedColors));
  }

  const result = await completeStructured(
    selectProvider(env),
    {
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
      jsonSchema: RECOMMENDATIONS_JSON_SCHEMA,
      maxTokens: 2500,
      temperature: 0.6,
    },
    recommendationsResponseSchema,
  );

  return json(result);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({
        ok: true,
        provider: env.AI_PROVIDER ?? "workers-ai",
        stub: env.MISTRAL_STUB === "1",
        aiBinding: Boolean(env.AI),
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
