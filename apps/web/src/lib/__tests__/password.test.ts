import { describe, expect, it } from "vitest";
import {
  fromBase64,
  hashPassword,
  isValidEmail,
  passwordProblem,
  sha256Base64,
  timingSafeEqual,
  toBase64,
  verifyPassword,
} from "../password";

describe("hashPassword / verifyPassword", () => {
  it("accepts the correct password", async () => {
    const stored = await hashPassword("correct horse battery");
    await expect(verifyPassword("correct horse battery", stored)).resolves.toBe(
      true,
    );
  });

  it("rejects the wrong password", async () => {
    const stored = await hashPassword("correct horse battery");
    await expect(verifyPassword("wrong horse battery", stored)).resolves.toBe(
      false,
    );
  });

  it("salts, so identical passwords produce different hashes", async () => {
    const a = await hashPassword("same-password-here");
    const b = await hashPassword("same-password-here");
    expect(a).not.toBe(b);
    // ...and both still verify.
    await expect(verifyPassword("same-password-here", a)).resolves.toBe(true);
    await expect(verifyPassword("same-password-here", b)).resolves.toBe(true);
  });

  it("encodes the parameters it used, so iterations can be raised later", async () => {
    const stored = await hashPassword("some-password");
    const [scheme, iterations] = stored.split("$");
    expect(scheme).toBe("pbkdf2");
    expect(Number(iterations)).toBeGreaterThanOrEqual(100_000);
  });

  it("verifies against a record written with different iterations", async () => {
    // Simulates an older row after the work factor is increased.
    const stored = await hashPassword("legacy-password");
    const parts = stored.split("$");
    expect(parts).toHaveLength(4);
    await expect(verifyPassword("legacy-password", stored)).resolves.toBe(true);
  });

  it("rejects malformed stored values instead of throwing", async () => {
    for (const bad of [
      "",
      "notahash",
      "pbkdf2$abc$salt$hash",
      "bcrypt$1000$a$b",
      "pbkdf2$100000$!!!$!!!",
      "pbkdf2$0$AAAA$AAAA",
    ]) {
      await expect(verifyPassword("whatever", bad)).resolves.toBe(false);
    }
  });

  it("does not treat an empty password as valid against a real hash", async () => {
    const stored = await hashPassword("a-real-password");
    await expect(verifyPassword("", stored)).resolves.toBe(false);
  });
});

describe("timingSafeEqual", () => {
  it("compares by value", () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
  });

  it("rejects differing lengths", () => {
    expect(timingSafeEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });
});

describe("base64 helpers", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255, 42]);
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
  });
});

describe("sha256Base64", () => {
  it("is stable and differs per input", async () => {
    const a = await sha256Base64("token-a");
    expect(await sha256Base64("token-a")).toBe(a);
    expect(await sha256Base64("token-b")).not.toBe(a);
  });

  it("does not contain the original token", async () => {
    expect(await sha256Base64("supersecrettoken")).not.toContain("supersecret");
  });
});

describe("credential validation", () => {
  it("accepts ordinary addresses and rejects malformed ones", () => {
    expect(isValidEmail("someone@example.com")).toBe(true);
    expect(isValidEmail("someone+tag@example.co.uk")).toBe(true);
    expect(isValidEmail("no-at-sign")).toBe(false);
    expect(isValidEmail("two@@example.com")).toBe(false);
    expect(isValidEmail("spaces here@example.com")).toBe(false);
    expect(isValidEmail("trailing@dot.")).toBe(false);
  });

  it("enforces a minimum password length", () => {
    expect(passwordProblem("short")).toMatch(/at least 10/);
    expect(passwordProblem("a".repeat(10))).toBeNull();
    expect(passwordProblem("a".repeat(201))).toMatch(/too long/);
  });
});
