/**
 * Provider-agnostic structured completion.
 *
 * Order matters here and is the whole point of this module:
 *   1. provider returns raw JSON
 *   2. privacy guardrail scans it        <- before anything is typed or stored
 *   3. Zod validates it
 *   4. on failure, one corrective retry
 */

import type { z } from "zod";
import { assertNoSensitiveFields } from "@dressptl/shared";
import { ProviderError } from "./providers/types";
import type { AiProvider, ChatMessage, CompletionRequest } from "./providers/types";

export async function completeStructured<T>(
  provider: AiProvider,
  request: CompletionRequest,
  schema: z.ZodType<T>,
): Promise<T> {
  const attempt = async (messages: ChatMessage[]): Promise<T> => {
    const json = await provider.complete({ ...request, messages });

    // Reject protected-attribute output before it is parsed into our types
    // or written anywhere. Throws SensitiveFieldError, which the router maps
    // to a 422 without echoing the offending value.
    assertNoSensitiveFields(json);

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ProviderError(
        `Model output failed validation: ${parsed.error.issues
          .slice(0, 3)
          .map((issue) => `${issue.path.join(".")} ${issue.message}`)
          .join("; ")}`,
        502,
        true,
      );
    }
    return parsed.data;
  };

  try {
    return await attempt(request.messages);
  } catch (error) {
    // SensitiveFieldError is not a ProviderError and deliberately falls
    // through un-retried: asking again invites the same violation.
    if (error instanceof ProviderError && !error.retryable) throw error;
    if (!(error instanceof ProviderError)) throw error;

    const correction: ChatMessage = {
      role: "user",
      content: `Your previous reply was rejected: ${error.message}. Reply again with ONLY the valid JSON object described earlier, no prose and no markdown fence.`,
    };
    return attempt([...request.messages, correction]);
  }
}
