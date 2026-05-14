import { describe, expect, it } from "vitest";
import {
  createPacket,
  MAX_ARRAY_LENGTH,
  MAX_DEPTH,
  MAX_STRING_BYTES,
  replayPacket,
  verifyIntelPacket,
} from "../../src/index.js";
import { genRandJson, mulberry32, shuffleKeyOrderSeeded } from "../prng.js";

describe("integrity fuzz and malformed input", () => {
  it("round-trips 500 seeded JSON-like values deterministically", () => {
    for (let seed = 0; seed < 500; seed++) {
      const rnd = mulberry32(seed + 9001);
      const raw = genRandJson(rnd, 6);
      const input =
        raw !== null && typeof raw === "object" && !Array.isArray(raw)
          ? shuffleKeyOrderSeeded(raw as Record<string, unknown>, rnd)
          : raw;
      const options = { createdAt: "2026-01-01T00:00:00.000Z", disableCompression: true };
      const packet = createPacket(input, options);
      expect(verifyIntelPacket(packet)).toBe(true);
      const replay = replayPacket(packet);
      expect(createPacket(replay.normalized, options).packet_hash).toBe(packet.packet_hash);
    }
  });

  it.each([
    ["circular object", () => { const o: Record<string, unknown> = {}; o.self = o; return o; }],
    ["dangerous __proto__ key", () => JSON.parse('{"__proto__":{"polluted":true}}')],
    ["dangerous constructor key", () => ({ constructor: { prototype: { polluted: true } } })],
    ["dangerous prototype key", () => ({ prototype: { polluted: true } })],
    ["overly deep object", () => { let v: unknown = "leaf"; for (let i = 0; i < MAX_DEPTH + 5; i++) v = { child: v }; return v; }],
    ["extremely long string over limit", () => "x".repeat(MAX_STRING_BYTES + 1)],
    ["huge array over limit", () => new Array(MAX_ARRAY_LENGTH + 1).fill(null)],
    ["symbol", () => ({ value: Symbol("bad") })],
    ["function", () => ({ value: () => "bad" })],
  ])("fails closed for %s", (_name, factory) => {
    expect(() => createPacket(factory(), { disableCompression: true })).toThrow(/IntelPacket/);
  });

  it("documents current JSON-compatible normalization for undefined object values", () => {
    const packet = createPacket({ value: undefined }, { disableCompression: true });
    expect(verifyIntelPacket(packet)).toBe(true);
    expect(replayPacket(packet).normalized).toEqual({});
  });
});
