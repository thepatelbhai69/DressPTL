import { afterEach, describe, expect, it, vi } from "vitest";
import { photoAnalysisSchema } from "@dressptl/shared";
import worker, { type Env } from "../index";
import { completeStructured, stripCodeFence } from "../mistral";
import { z } from "zod";

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    MISTRAL_API_KEY: "test-key",
    MISTRAL_STUB: "1",
    ...overrides,
  } as Env;
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
  it("serves health without the shared secret", async () => {
    const res = await worker.fetch(
      new Request("https://proxy.internal/health"),
      makeEnv({ PROXY_SHARED_SECRET: "s3cret" }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, stub: true });
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
    const request = new Request("https://proxy.internal/analyze-photo", {
      method: "POST",
      body: JSON.stringify(IMAGE),
    });
    const res = await worker.fetch(request, makeEnv());
    expect(res.status).toBe(400);
  });

  it("refuses non-POST verbs", async () => {
    const res = await worker.fetch(
      new Request("https://proxy.internal/analyze-photo", {
        headers: { "x-user-id": "user-1" },
      }),
      makeEnv(),
    );
    expect(res.status).toBe(405);
  });

  it("404s unknown paths", async () => {
    const res = await worker.fetch(post("/nope", {}), makeEnv());
    expect(res.status).toBe(404);
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

  it("rejects oversized images before spending an API call", async () => {
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

describe("stub mode", () => {
  it("returns schema-valid analysis without an API key", async () => {
    const res = await worker.fetch(
      post("/analyze-photo", IMAGE),
      makeEnv({ MISTRAL_API_KEY: "" }),
    );
    expect(res.status).toBe(200);
    expect(photoAnalysisSchema.safeParse(await res.json()).success).toBe(true);
  });

  it("varies output by image so palette learning can be exercised", async () => {
    const a = await (
      await worker.fetch(post("/analyze-photo", IMAGE), makeEnv())
    ).json();
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

describe("completeStructured", () => {
  const schema = z.object({ value: z.number() }).strict();

  function mockMistral(...contents: string[]) {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      const content = contents[Math.min(call, contents.length - 1)]!;
      call += 1;
      return new Response(
        JSON.stringify({ choices: [{ message: { content } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const base = {
    apiKey: "k",
    model: "m",
    messages: [{ role: "user" as const, content: "go" }],
    schema,
  };

  it("returns validated output", async () => {
    mockMistral('{"value":7}');
    await expect(completeStructured(base)).resolves.toEqual({ value: 7 });
  });

  it("retries once when the first reply is not valid JSON", async () => {
    const fetchMock = mockMistral("not json at all", '{"value":3}');
    await expect(completeStructured(base)).resolves.toEqual({ value: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries when the first reply fails schema validation", async () => {
    const fetchMock = mockMistral('{"value":"seven"}', '{"value":7}');
    await expect(completeStructured(base)).resolves.toEqual({ value: 7 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after the corrective retry", async () => {
    mockMistral("still not json");
    await expect(completeStructured(base)).rejects.toThrow();
  });

  it("fails closed when the model volunteers a protected attribute", async () => {
    mockMistral('{"value":1,"ethnicity":"redacted"}');
    await expect(completeStructured(base)).rejects.toThrow(
      /disallowed field: ethnicity/i,
    );
  });

  it("does not retry a non-retryable auth failure", async () => {
    const fetchMock = vi.fn(async () => new Response("bad key", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(completeStructured(base)).rejects.toThrow(/401/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("sensitive output handling at the HTTP layer", () => {
  it("maps a disallowed attribute to 422 rather than leaking it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      colors: [{ hex: "#1F305E", prominence: 0.9 }],
                      ethnicity: "redacted",
                    }),
                  },
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );
    const res = await worker.fetch(
      post("/analyze-photo", IMAGE),
      makeEnv({ MISTRAL_STUB: "0" }),
    );
    expect(res.status).toBe(422);
    expect(JSON.stringify(await res.json())).not.toContain("redacted");
  });
});
