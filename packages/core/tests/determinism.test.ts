import { describe, expect, it } from "vitest";
import {
  canonicalize,
  canonicalStringify,
  compactSchema,
  createPacket,
  dedupeStructures,
  hashPacket,
  normalizeTypes,
  verifyIntelPacket,
} from "../src/index.js";

describe("determinism", () => {
  it("100× identical packets share the same hash and packet_id prefix", () => {
    const input = { z: 9, a: { m: 1, n: 2 }, t: "2026-01-01T00:00:00.000Z" };
    const opts = { disableCompression: true, createdAt: "FIXED" } as const;
    let first: string | undefined;
    for (let i = 0; i < 100; i++) {
      const p = createPacket(input, { ...opts });
      if (first === undefined) {
        first = p.packet_hash;
        expect(p.packet_id).toBe(p.packet_hash.slice(0, 16));
      } else {
        expect(p.packet_hash).toBe(first);
      }
      expect(verifyIntelPacket(p)).toBe(true);
    }
  });

  it("same semantic scalars produce same canonical and hash", () => {
    const a = { x: "49.990", y: true };
    const b = { x: 49.99, y: true };
    expect(canonicalStringify(normalizeTypes(a))).toBe(
      canonicalStringify(normalizeTypes(b)),
    );
    expect(hashPacket(canonicalize(normalizeTypes(a)))).toBe(
      hashPacket(canonicalize(normalizeTypes(b))),
    );
  });
});

describe("canonical idempotence under pipeline shapes", () => {
  const samples: unknown[] = [
    { nested: { b: 1, a: [9, 8] }, u: "é" },
    [{ k: null }, { k: true }],
    compactSchema({ timestamp: 1, user_id: "x" }),
    dedupeStructures({ a: [1, 1], b: [1, 1] }).value,
  ];

  it.each(samples.map((s, i) => [String(i), s]) as [string, unknown][])(
    "C(C(x)) = C(x) for sample %s",
    (_, x) => {
      const c = canonicalize(x);
      expect(canonicalStringify(canonicalize(c))).toBe(canonicalStringify(c));
    },
  );

  it("unicode NFC stable across canonicalize", () => {
    const u = { s: "e\u0301" };
    expect(canonicalStringify(canonicalize(normalizeTypes(u)))).toContain("\u00e9");
  });
});
