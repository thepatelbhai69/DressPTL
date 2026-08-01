/**
 * Thin Mistral client.
 *
 * The only place in the system that sees MISTRAL_API_KEY. Everything it
 * returns has been schema-validated before it leaves this module, so callers
 * never handle raw model output.
 */

import { z } from "zod";
import { assertNoSensitiveFields } from "@dressptl/shared";

export const DEFAULT_BASE_URL = "https://api.mistral.ai/v1";

/**
 * Model IDs are configurable because Mistral's lineup moves faster than this
 * app will. These defaults are known-good vision/text models; override with
 * vars in wrangler.toml when newer ones ship.
 */
export const DEFAULT_VISION_MODEL = "pixtral-large-latest";
export const DEFAULT_TEXT_MODEL = "mistral-large-latest";

export class MistralError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "MistralError";
  }
}

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image_url";
  image_url: { url: string };
}

export type ContentPart = TextContent | ImageContent;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string | ContentPart[];
}

interface CallOptions {
  apiKey: string;
  baseUrl?: string;
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

const chatCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable() }),
        finish_reason: z.string().nullish(),
      }),
    )
    .min(1),
});

async function chatCompletion(options: CallOptions): Promise<string> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

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
        model: options.model,
        messages: options.messages,
        response_format: { type: "json_object" },
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 2000,
      }),
      signal: options.signal,
    });
  } catch (cause) {
    throw new MistralError(
      `Could not reach Mistral: ${(cause as Error).message}`,
      502,
      true,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // 429 and 5xx are worth another attempt; 4xx generally is not.
    const retryable = response.status === 429 || response.status >= 500;
    throw new MistralError(
      `Mistral returned ${response.status}: ${body.slice(0, 300)}`,
      response.status === 429 ? 429 : 502,
      retryable,
    );
  }

  const json = await response.json().catch(() => null);
  const parsed = chatCompletionSchema.safeParse(json);
  if (!parsed.success) {
    throw new MistralError("Unexpected response shape from Mistral", 502, true);
  }

  const content = parsed.data.choices[0]!.message.content;
  if (!content) {
    throw new MistralError("Mistral returned an empty completion", 502, true);
  }
  return content;
}

/**
 * Models occasionally wrap JSON in a markdown fence even in JSON mode.
 * Tolerate it rather than failing the user's upload over formatting.
 */
export function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/i.exec(trimmed);
  return fenced ? fenced[1]!.trim() : trimmed;
}

export interface StructuredCallOptions<T> extends CallOptions {
  schema: z.ZodType<T>;
}

/**
 * Runs a completion and validates it against `schema`, retrying once with a
 * corrective turn if the model returns something off-contract.
 */
export async function completeStructured<T>(
  options: StructuredCallOptions<T>,
): Promise<T> {
  const attempt = async (messages: ChatMessage[]): Promise<T> => {
    const raw = await chatCompletion({ ...options, messages });
    let json: unknown;
    try {
      json = JSON.parse(stripCodeFence(raw));
    } catch {
      throw new MistralError("Model did not return valid JSON", 502, true);
    }

    // Guardrail first: reject protected-attribute output before it is parsed
    // into our types or written anywhere.
    assertNoSensitiveFields(json);

    const parsed = options.schema.safeParse(json);
    if (!parsed.success) {
      throw new MistralError(
        `Model output failed validation: ${parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")} ${i.message}`)
          .join("; ")}`,
        502,
        true,
      );
    }
    return parsed.data;
  };

  try {
    return await attempt(options.messages);
  } catch (error) {
    if (error instanceof MistralError && !error.retryable) throw error;

    // One corrective retry at temperature 0, telling the model what broke.
    const correction: ChatMessage = {
      role: "user",
      content: `Your previous reply was rejected: ${
        error instanceof Error ? error.message : "invalid output"
      }. Reply again with ONLY the valid JSON object described earlier, no prose and no markdown fence.`,
    };
    return attempt([...options.messages, correction]);
  }
}
