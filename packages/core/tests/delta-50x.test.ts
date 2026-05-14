import { describe, expect, it } from "vitest";
import {
  applyDelta,
  canonicalStringify,
  canonicalize,
  diffPackets,
} from "../src/index.js";
import { genRandJson, mulberry32 } from "./prng.js";

const ITER = 50;

describe("delta 50×", () => {
  it("diff/apply round-trip for generated and fixed pairs", () => {
    for (let i = 0; i < ITER; i++) {
      let base: unknown;
      let next: unknown;
      if (i % 10 === 0) {
        base = { nested: { a: 1, b: 2 }, top: true };
        next = { nested: { a: 2, b: 2, c: 3 }, top: true };
      } else if (i % 10 === 1) {
        base = { arr: [1, 2, 3] };
        next = { arr: [1, 2, 3, 4] };
      } else if (i % 10 === 2) {
        base = { n: 100 };
        next = { n: 107 };
      } else if (i % 10 === 3) {
        base = { keep: 1, drop: 2 };
        next = { keep: 1 };
      } else if (i % 10 === 4) {
        base = { x: 1 };
        next = { x: 1, y: { z: [1, 1, 1] } };
      } else if (i % 10 === 5) {
        base = { dup: { k: 1 }, other: { k: 1 } };
        next = { dup: { k: 2 }, other: { k: 1 } };
      } else {
        let saltA = 0;
        let baseR = genRandJson(mulberry32(i * 13), 4);
        while (baseR === null || typeof baseR !== "object") {
          baseR = genRandJson(mulberry32(i * 13 + ++saltA), 4);
        }
        let saltB = 0;
        let nextR = genRandJson(mulberry32(i * 13 + 99_001), 4);
        while (nextR === null || typeof nextR !== "object") {
          nextR = genRandJson(mulberry32(i * 13 + 99_001 + ++saltB), 4);
        }
        base = baseR;
        next = nextR;
      }
      const baseSnap = structuredClone(base);
      const delta = diffPackets(base, next);
      const reconstructed = applyDelta(base, delta);
      expect(canonicalStringify(reconstructed)).toBe(
        canonicalStringify(canonicalize(next)),
      );
      expect(structuredClone(base)).toEqual(baseSnap);
    }
  });

  it("50× rejection of unsafe keys in delta", () => {
    for (let i = 0; i < ITER; i++) {
      void i;
      const patch = Object.create(null) as Record<string, unknown>;
      patch["__proto__"] = { x: 1 };
      expect(() => applyDelta({ a: 1 }, patch)).toThrow(/unsafe object key/i);
    }
  });
});
