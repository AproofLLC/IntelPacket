import { describe, expect, it } from "vitest";
import {
  applyDelta,
  canonicalize,
  createPacket,
  decompressPacket,
  diffPackets,
  expandRefs,
  replayPacket,
  verifyIntelPacket,
} from "../src/index.js";
import type { IntelPacket } from "../src/types.js";

describe("malformed and adversarial inputs", () => {
  it("rejects circular structures (throws before stable packet)", () => {
    const a: Record<string, unknown> = { x: 1 };
    a.self = a;
    expect(() => createPacket(a)).toThrow();
  });

  it("NaN and Infinity become null under canonicalize", () => {
    expect(
      JSON.stringify(canonicalize({ a: Number.NaN, b: Number.POSITIVE_INFINITY })),
    ).toBe(JSON.stringify({ a: null, b: null }));
  });

  it("empty object packet verifies and replays", () => {
    const p = createPacket({}, { disableCompression: true });
    expect(verifyIntelPacket(p)).toBe(true);
    expect(replayPacket(p).canonical).toEqual({});
  });

  it("arrays with explicit null entries round-trip", () => {
    const data = [null, null, 1];
    const p = createPacket(data, { disableCompression: true });
    expect(verifyIntelPacket(p)).toBe(true);
  });

  it("corrupted base64 payload throws on decode or replay", () => {
    const p = createPacket({ a: 1 }, { disableCompression: true });
    const bad: IntelPacket = {
      ...p,
      payload: "!",
    };
    expect(() => replayPacket(bad)).toThrow();
  });

  it("invalid inner JSON throws on replay", () => {
    const p = createPacket({ ok: true }, { disableCompression: true });
    const forged: IntelPacket = {
      ...p,
      payload: Buffer.from("{ not json", "utf8").toString("base64"),
    };
    expect(() => replayPacket(forged)).toThrow();
  });

  it("verifyIntelPacket false when hash tampered", () => {
    const p = createPacket({ v: 1 }, { disableCompression: true });
    const forged: IntelPacket = {
      ...p,
      packet_hash: "0".repeat(64),
    };
    expect(verifyIntelPacket(forged)).toBe(false);
  });

  it("missing dedupe ref throws", () => {
    expect(() => expandRefs({ __ip_ref: "r0" }, {})).toThrow(/missing dedupe ref/i);
  });

  it("applyDelta with empty patch returns base", () => {
    const b = { a: 1 };
    expect(applyDelta(b, {})).toEqual(canonicalize(b));
  });

  it("diff identity yields empty patch", () => {
    const b = canonicalize({ q: 9 });
    expect(Object.keys(diffPackets(b, b))).toHaveLength(0);
  });

  it("decompressPacket fails if metadata.method does not match payload", () => {
    const p = createPacket({ x: 1 }, { disableCompression: true });
    expect(() =>
      decompressPacket(p.payload, { ...p.compression, method: "brotli" }),
    ).toThrow();
  });
});
