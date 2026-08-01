/**
 * Direct Mistral API provider — optional upgrade path.
 *
 * Selected with AI_PROVIDER="mistral-api". Needs MISTRAL_API_KEY as a Worker
 * secret. Worth it when you want a larger model (Pixtral Large / Mistral
 * Large) than Workers AI hosts; otherwise prefer the keyless Workers AI path.
 */

import { z } from "zod";
import { ProviderError, stripCodeFence } from "./types";
import type { AiProvider, ChatMessage, CompletionRequest } from "./types";

export const DEFAULT_BASE_URL = "https://api.mistral.ai/v1";
export const DEFAULT_VISION_MODEL = "pixtral-large-latest";
export const DEFAULT_TEXT_MODEL = "mistral-large-latest";

const chatCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable() }),
      }),
    )
    .min(1),
});

export interface MistralApiOptions {
  apiKey: string;
  baseUrl?: string;
  visionModel?: string;
  textModel?: string;
}

export function createMistralApiProvider(
  options: MistralApiOptions,
): AiProvider {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

  async function call(
    messages: ChatMessage[],
    model: string,
    maxTokens: number,
    temperature: number,
  ): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          response_format: { type: "json_object" },
          temperature,
          max_tokens: maxTokens,
        }),
      });
    } catch (cause) {
      throw new ProviderError(
        `Could not reach Mistral: ${(cause as Error).message}`,
        502,
        true,
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const retryable = response.status === 429 || response.status >= 500;
      throw new ProviderError(
        `Mistral returned ${response.status}: ${body.slice(0, 300)}`,
        response.status === 429 ? 429 : 502,
        retryable,
      );
    }

    const parsed = chatCompletionSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      throw new ProviderError("Unexpected response shape from Mistral", 502, true);
    }

    const content = parsed.data.choices[0]!.message.content;
    if (!content) {
      throw new ProviderError("Mistral returned an empty completion", 502, true);
    }
    return content;
  }

  return {
    name: "mistral-api",
    async complete(request: CompletionRequest): Promise<unknown> {
      const model = request.vision
        ? (options.visionModel ?? DEFAULT_VISION_MODEL)
        : (options.textModel ?? DEFAULT_TEXT_MODEL);

      const raw = await call(
        request.messages,
        model,
        request.maxTokens ?? 2000,
        request.temperature ?? 0.2,
      );

      try {
        return JSON.parse(stripCodeFence(raw));
      } catch {
        throw new ProviderError("Model did not return valid JSON", 502, true);
      }
    },
  };
}
