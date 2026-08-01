/**
 * Workers AI provider — the default.
 *
 * Uses Cloudflare's own inference binding, so there is no API key anywhere in
 * the system. The binding is account-scoped and reachable only from inside a
 * Worker, which removes the entire class of "key leaked into a bundle / repo /
 * log" problems the direct-API path has to defend against.
 *
 * Mistral Small 3.1 24B is vision-capable, so one model covers both photo
 * analysis and outfit generation.
 */

import { ProviderError, stripCodeFence } from "./types";
import type { AiProvider, CompletionRequest } from "./types";

export const DEFAULT_WORKERS_AI_MODEL =
  "@cf/mistralai/mistral-small-3.1-24b-instruct";

export interface WorkersAiOptions {
  ai: Ai;
  model?: string;
}

/**
 * Workers AI returns `{ response: ... }`. With structured output the payload
 * is sometimes already an object and sometimes a JSON string, depending on
 * model and mode — handle both rather than assuming.
 */
function extractPayload(result: unknown): unknown {
  if (result && typeof result === "object" && "response" in result) {
    const response = (result as { response: unknown }).response;
    if (typeof response === "string") {
      try {
        return JSON.parse(stripCodeFence(response));
      } catch {
        throw new ProviderError(
          "Workers AI did not return valid JSON",
          502,
          true,
        );
      }
    }
    return response;
  }
  return result;
}

export function createWorkersAiProvider(
  options: WorkersAiOptions,
): AiProvider {
  const model = options.model ?? DEFAULT_WORKERS_AI_MODEL;

  return {
    name: "workers-ai",
    async complete(request: CompletionRequest): Promise<unknown> {
      const input: Record<string, unknown> = {
        messages: request.messages,
        max_tokens: request.maxTokens ?? 2000,
        temperature: request.temperature ?? 0.2,
      };

      // Constrained decoding when we have a schema — far more reliable than
      // asking the model to please emit JSON.
      if (request.jsonSchema) {
        input.response_format = {
          type: "json_schema",
          json_schema: request.jsonSchema,
        };
      }

      let result: unknown;
      try {
        result = await options.ai.run(model as Parameters<Ai["run"]>[0], input as never);
      } catch (cause) {
        const message = (cause as Error)?.message ?? "Workers AI call failed";
        // Neuron exhaustion on the free tier surfaces as a capacity error;
        // surface it as 429 so the caller can degrade rather than 500.
        const isQuota = /quota|capacity|limit|429/i.test(message);
        throw new ProviderError(
          `Workers AI: ${message}`,
          isQuota ? 429 : 502,
          !isQuota,
        );
      }

      return extractPayload(result);
    },
  };
}
