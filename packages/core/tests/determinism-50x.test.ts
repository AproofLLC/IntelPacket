import { describe, expect, it } from "vitest";
import {
  canonicalStringify,
  createPacket,
  normalizeTypes,
} from "../src/index.js";

const ITER = 50;
const opts = { disableCompression: true, createdAt: "DET50" } as const;

/** Deterministic reverse lexicographic key order (not random). */
function reverseKeyOrder(obj: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(obj).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = obj[k];
    out[k] =
      v !== null && typeof v === "object" && !Array.isArray(v)
        ? reverseKeyOrder(v as Record<string, unknown>)
        : v;
  }
  return out;
}

describe("determinism 50×", () => {
  it("equivalent numeric string vs number yields identical packet hash", () => {
    let h = "";
    for (let i = 0; i < ITER; i++) {
      void i;
      const a = createPacket({ x: "49.990", y: true }, opts);
      const b = createPacket({ x: 49.99, y: true }, opts);
      expect(a.packet_hash).toBe(b.packet_hash);
      if (h) expect(a.packet_hash).toBe(h);
      h = a.packet_hash;
    }
  });

  it("random key order A vs sorted B yields identical hash", () => {
    const sorted = { a: 1, b: { x: 2, y: 3 }, c: [1, 2, 3] };
    const reversed = reverseKeyOrder({ ...sorted });
    let h = "";
    for (let i = 0; i < ITER; i++) {
      void i;
      const p1 = createPacket(sorted, opts);
      const p2 = createPacket(reversed, opts);
      expect(p1.packet_hash).toBe(p2.packet_hash);
      if (h) expect(p1.packet_hash).toBe(h);
      h = p1.packet_hash;
    }
  });

  it("equivalent timestamp strings normalize identically", () => {
    let h = "";
    for (let i = 0; i < ITER; i++) {
      void i;
      const p1 = createPacket({ t: "2026-06-01 3:30 PM" }, opts);
      const p2 = createPacket({ t: "2026-06-01T15:30:00.000Z" }, opts);
      expect(p1.packet_hash).toBe(p2.packet_hash);
      if (h) expect(p1.packet_hash).toBe(h);
      h = p1.packet_hash;
    }
  });

  it("unicode NFC: decomposed vs precomposed match after normalize", () => {
    let h = "";
    for (let i = 0; i < ITER; i++) {
      void i;
      const p1 = createPacket({ s: "e\u0301" }, opts);
      const p2 = createPacket({ s: "\u00e9" }, opts);
      expect(p1.packet_hash).toBe(p2.packet_hash);
      expect(canonicalStringify(normalizeTypes({ s: "e\u0301" }))).toBe(
        canonicalStringify(normalizeTypes({ s: "\u00e9" })),
      );
      if (h) expect(p1.packet_hash).toBe(h);
      h = p1.packet_hash;
    }
  });

  it("nested object insertion order does not change hash", () => {
    const o1 = { outer: { z: 1, a: 2 } };
    const o2 = { outer: { a: 2, z: 1 } };
    let h = "";
    for (let i = 0; i < ITER; i++) {
      void i;
      const p1 = createPacket(o1, opts);
      const p2 = createPacket(o2, opts);
      expect(p1.packet_hash).toBe(p2.packet_hash);
      if (h) expect(p1.packet_hash).toBe(h);
      h = p1.packet_hash;
    }
  });

  it("created_at does not alter packet_hash", () => {
    const input = { k: "stable-determinism" };
    const hFix = createPacket(input, opts).packet_hash;
    for (let i = 0; i < ITER; i++) {
      const p = createPacket(input, {
        disableCompression: true,
        createdAt: `iso-${i}-2099-01-01T00:00:00.000Z`,
      });
      expect(p.packet_hash).toBe(hFix);
    }
  });
});
