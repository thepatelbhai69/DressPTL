import { describe, expect, it } from "vitest";
import { bytesToBase64 } from "../encoding";

describe("bytesToBase64", () => {
  it("matches the platform encoder for small inputs", () => {
    const bytes = new TextEncoder().encode("hello world");
    expect(bytesToBase64(bytes)).toBe(btoa("hello world"));
  });

  it("handles bytes above 0x7f", () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x00, 0x80]);
    expect(bytesToBase64(bytes)).toBe(btoa("\xff\xfe\x00\x80"));
  });

  it("encodes a multi-megabyte image without blowing the call stack", () => {
    // A naive String.fromCharCode(...bytes) throws RangeError around this size,
    // which is exactly the case a real 4MB photo upload hits.
    const bytes = new Uint8Array(4 * 1024 * 1024).fill(7);
    const encoded = bytesToBase64(bytes);
    expect(encoded.length).toBeGreaterThan(5_000_000);
    expect(atob(encoded).length).toBe(bytes.length);
  });

  it("returns an empty string for empty input", () => {
    expect(bytesToBase64(new Uint8Array())).toBe("");
  });
});
