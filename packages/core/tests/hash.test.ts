import { describe, expect, it } from "vitest";
import { canonicalize, hashPacket } from "../src/index.js";

describe("hashPacket", () => {
  it("is deterministic for canonical-equivalent inputs", () => {
    const a = { z: 1, a: 2 };
    const b = { a: 2, z: 1 };
    expect(hashPacket(a)).toBe(hashPacket(b));
    expect(hashPacket(a)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("matches canonicalStringify stability", () => {
    expect(hashPacket(canonicalize({ m: 1 }))).toBe(hashPacket({ m: 1 }));
  });
});
