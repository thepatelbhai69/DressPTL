export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image_url";
  image_url: { url: string };
}

export type ContentPart = TextContent | ImageContent;

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string | ContentPart[];
}

export interface CompletionRequest {
  messages: ChatMessage[];
  /** JSON Schema for providers that support constrained decoding. */
  jsonSchema?: unknown;
  maxTokens?: number;
  temperature?: number;
  /** True when the request carries an image, so the provider picks a vision model. */
  vision?: boolean;
}

/**
 * A backend that returns parsed-but-unvalidated JSON.
 *
 * Providers deliberately do NOT apply the Zod schema: the privacy guardrail
 * has to inspect raw model output first, before anything is coerced into our
 * types. Validation happens in ../complete.
 */
export interface AiProvider {
  readonly name: string;
  complete(request: CompletionRequest): Promise<unknown>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
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
