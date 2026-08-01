import { afterEach, describe, expect, it, vi } from "vitest";
import { photoAnalysisSchema, SensitiveFieldError } from "@dressptl/shared";
import { z } from "zod";
import worker, { selectProvider, type Env } from "../index";
import { completeStructured } from "../complete";
import { ProviderError, stripCodeFence, type AiProvider } from "../providers/types";
import { createWorkersAiProvider } from "../providers/workersAi";
import { createMistralApiProvider } from "../providers/mistralApi";

function makeEnv(overrides: Partial<Env> = {}): Env {
  return { MISTRAL_STUB: "1", ...overrides } as Env;
}

/** Minimal in-memory KV good enough for the fixed-window counter. */
function makeKv() {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
  } as unknown as KVNamespace;
}

/** Fake Workers AI binding. */
function makeAi(impl: (model: string, input: unknown) => unknown) {
  return { run: vi.fn(async (model: string, input: unknown) => impl(model, input)) } as unknown as Ai;
}

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://proxy.internal${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-id": "user-1", ...headers },
    body: JSON.stringify(body),
  });
}

const IMAGE = { imageBase64: "aGVsbG8td29ybGQ=", mimeType: "image/jpeg" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("routing and access control", () => {
  it("reports the active provider on /health", async () => {
    const res = await worker.fetch(
      new Request("https://proxy.internal/health"),
      makeEnv({ PROXY_SHARED_SECRET: "s3cret", AI: makeAi(() => ({})) }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      provider: "workers-ai",
      aiBinding: true,
    });
  });

  it("rejects callers without the shared secret", async () => {
    const res = await worker.fetch(
      post("/analyze-photo", IMAGE),
      makeEnv({ PROXY_SHARED_SECRET: "s3cret" }),
    );
    expect(res.status).toBe(403);
  });

  it("accepts callers presenting the shared secret", async () => {
    const res = await worker.fetch(
      post("/analyze-photo", IMAGE, { "x-proxy-secret": "s3cret" }),
      makeEnv({ PROXY_SHARED_SECRET: "s3cret" }),
    );
    expect(res.status).toBe(200);
  });

  it("requires a user id so requests can be rate limited", async () => {
    const res = await worker.fetch(
      new Request("https://proxy.internal/analyze-photo", {
        method: "POST",
        body: JSON.stringify(IMAGE),
      }),
      makeEnv(),
    );
    expect(res.status).toBe(400);
  });

  it("refuses non-POST verbs and unknown paths", async () => {
    expect(
      (
        await worker.fetch(
          new Request("https://proxy.internal/analyze-photo", {
            headers: { "x-user-id": "user-1" },
          }),
          makeEnv(),
        )
      ).status,
    ).toBe(405);
    expect((await worker.fetch(post("/nope", {}), makeEnv())).status).toBe(404);
  });
});

describe("validation", () => {
  it("rejects a malformed body", async () => {
    const res = await worker.fetch(
      post("/analyze-photo", { imageBase64: "x", mimeType: "image/gif" }),
      makeEnv(),
    );
    expect(res.status).toBe(400);
  });

  it("rejects oversized images before spending inference", async () => {
    const res = await worker.fetch(
      post("/analyze-photo", {
        imageBase64: "a".repeat(11_000_001),
        mimeType: "image/jpeg",
      }),
      makeEnv(),
    );
    expect(res.status).toBe(413);
  });
});

describe("provider selection", () => {
  it("defaults to Workers AI, needing no API key", () => {
    const provider = selectProvider(makeEnv({ AI: makeAi(() => ({})) }));
    expect(provider.name).toBe("workers-ai");
  });

  it("switches to the direct API when asked", () => {
    const provider = selectProvider(
      makeEnv({ AI_PROVIDER: "mistral-api", MISTRAL_API_KEY: "k" }),
    );
    expect(provider.name).toBe("mistral-api");
  });

  it("fails clearly when mistral-api is selected without a key", () => {
    expect(() => selectProvider(makeEnv({ AI_PROVIDER: "mistral-api" }))).toThrow(
      /MISTRAL_API_KEY is not set/,
    );
  });

  it("fails clearly when the AI binding is missing", () => {
    expect(() => selectProvider(makeEnv({}))).toThrow(/binding `AI` is not configured/);
  });
});

describe("stub mode", () => {
  it("returns schema-valid analysis with no inference configured", async () => {
    const res = await worker.fetch(post("/analyze-photo", IMAGE), makeEnv());
    expect(res.status).toBe(200);
    expect(photoAnalysisSchema.safeParse(await res.json()).success).toBe(true);
  });

  it("varies output by image so palette learning can be exercised", async () => {
    const a = await (await worker.fetch(post("/analyze-photo", IMAGE), makeEnv())).json();
    const b = await (
      await worker.fetch(
        post("/analyze-photo", { ...IMAGE, imageBase64: "ZGlmZmVyZW50" }),
        makeEnv(),
      )
    ).json();
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });
});

describe("rate limiting", () => {
  it("blocks once the per-minute budget is spent", async () => {
    const env = makeEnv({ RATE_LIMIT: makeKv(), RATE_LIMIT_PER_MINUTE: "2" });
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) {
      statuses.push((await worker.fetch(post("/analyze-photo", IMAGE), env)).status);
    }
    expect(statuses).toEqual([200, 200, 429]);
  });

  it("limits each user separately", async () => {
    const env = makeEnv({ RATE_LIMIT: makeKv(), RATE_LIMIT_PER_MINUTE: "1" });
    await worker.fetch(post("/analyze-photo", IMAGE), env);
    const other = await worker.fetch(
      post("/analyze-photo", IMAGE, { "x-user-id": "user-2" }),
      env,
    );
    expect(other.status).toBe(200);
  });
});

describe("stripCodeFence", () => {
  it("unwraps fenced JSON that models emit despite JSON mode", () => {
    expect(stripCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripCodeFence('```\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripCodeFence('{"a":1}')).toBe('{"a":1}');
  });
});

describe("Workers AI provider", () => {
  const schema = z.object({ value: z.number() }).strict();

  it("passes the configured model and a JSON schema for constrained decoding", async () => {
    const ai = makeAi(() => ({ response: { value: 1 } }));
    const provider = createWorkersAiProvider({ ai, model: "@cf/test/model" });
    await provider.complete({
      messages: [{ role: "user", content: "hi" }],
      jsonSchema: { type: "object" },
    });

    const run = (ai as unknown as { run: ReturnType<typeof vi.fn> }).run;
    expect(run.mock.calls[0]![0]).toBe("@cf/test/model");
    expect(run.mock.calls[0]![1]).toMatchObject({
      response_format: { type: "json_schema" },
    });
  });

  it("accepts a response returned as an object", async () => {
    const provider = createWorkersAiProvider({ ai: makeAi(() => ({ response: { value: 5 } })) });
    await expect(
      completeStructured(provider, { messages: [] }, schema),
    ).resolves.toEqual({ value: 5 });
  });

  it("accepts a response returned as a JSON string", async () => {
    const provider = createWorkersAiProvider({
      ai: makeAi(() => ({ response: '{"value":6}' })),
    });
    await expect(
      completeStructured(provider, { messages: [] }, schema),
    ).resolves.toEqual({ value: 6 });
  });

  it("tolerates a fenced JSON string", async () => {
    const provider = createWorkersAiProvider({
      ai: makeAi(() => ({ response: '```json\n{"value":7}\n```' })),
    });
    await expect(
      completeStructured(provider, { messages: [] }, schema),
    ).resolves.toEqual({ value: 7 });
  });

  it("maps free-tier exhaustion to 429 rather than a generic failure", async () => {
    const provider = createWorkersAiProvider({
      ai: makeAi(() => {
        throw new Error("Account is over its capacity limit");
      }),
    });
    await expect(provider.complete({ messages: [] })).rejects.toMatchObject({
      status: 429,
      retryable: false,
    });
  });
});

describe("Mistral API provider", () => {
  it("sends the vision model when the request carries an image", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(JSON.stringify({ choices: [{ message: { content: '{"a":1}' } }] })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createMistralApiProvider({
      apiKey: "k",
      visionModel: "vision-x",
      textModel: "text-x",
    });

    const modelOfCall = (index: number) =>
      JSON.parse(String(fetchMock.mock.calls[index]![1].body)).model;

    await provider.complete({ messages: [], vision: true });
    expect(modelOfCall(0)).toBe("vision-x");

    await provider.complete({ messages: [], vision: false });
    expect(modelOfCall(1)).toBe("text-x");
  });

  it("marks auth failures non-retryable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad key", { status: 401 })));
    const provider = createMistralApiProvider({ apiKey: "k" });
    await expect(provider.complete({ messages: [] })).rejects.toMatchObject({
      retryable: false,
    });
  });
});

describe("completeStructured", () => {
  const schema = z.object({ value: z.number() }).strict();

  /** Provider that returns a scripted sequence of payloads. */
  function scripted(...payloads: unknown[]): AiProvider {
    let call = 0;
    return {
      name: "scripted",
      complete: vi.fn(async () => {
        const payload = payloads[Math.min(call, payloads.length - 1)];
        call += 1;
        if (payload instanceof Error) throw payload;
        return payload;
      }),
    };
  }

  it("returns validated output", async () => {
    await expect(
      completeStructured(scripted({ value: 7 }), { messages: [] }, schema),
    ).resolves.toEqual({ value: 7 });
  });

  it("retries once when the first reply fails schema validation", async () => {
    const provider = scripted({ value: "seven" }, { value: 7 });
    await expect(
      completeStructured(provider, { messages: [] }, schema),
    ).resolves.toEqual({ value: 7 });
    expect(provider.complete).toHaveBeenCalledTimes(2);
  });

  it("appends a corrective turn on retry rather than repeating blindly", async () => {
    const provider = scripted({ value: "bad" }, { value: 1 });
    await completeStructured(
      provider,
      { messages: [{ role: "user", content: "original" }] },
      schema,
    );
    const secondCall = (provider.complete as ReturnType<typeof vi.fn>).mock.calls[1]![0];
    expect(secondCall.messages).toHaveLength(2);
    expect(JSON.stringify(secondCall.messages[1])).toMatch(/rejected/i);
  });

  it("gives up after the corrective retry", async () => {
    await expect(
      completeStructured(scripted({ value: "bad" }), { messages: [] }, schema),
    ).rejects.toThrow(/failed validation/);
  });

  it("does not retry a non-retryable provider error", async () => {
    const provider = scripted(new ProviderError("nope", 500, false));
    await expect(
      completeStructured(provider, { messages: [] }, schema),
    ).rejects.toThrow(/nope/);
    expect(provider.complete).toHaveBeenCalledTimes(1);
  });

  it("fails closed on a protected attribute, without retrying", async () => {
    const provider = scripted({ value: 1, ethnicity: "redacted" }, { value: 1 });
    await expect(
      completeStructured(provider, { messages: [] }, schema),
    ).rejects.toThrow(SensitiveFieldError);
    // Retrying would just invite the same violation.
    expect(provider.complete).toHaveBeenCalledTimes(1);
  });
});

describe("sensitive output handling at the HTTP layer", () => {
  it("maps a disallowed attribute to 422 without echoing it", async () => {
    const env = makeEnv({
      MISTRAL_STUB: "0",
      AI: makeAi(() => ({
        response: {
          colors: [{ hex: "#1F305E", prominence: 0.9 }],
          ethnicity: "redacted",
        },
      })),
    });
    const res = await worker.fetch(post("/analyze-photo", IMAGE), env);
    expect(res.status).toBe(422);
    expect(JSON.stringify(await res.json())).not.toContain("redacted");
  });
});
