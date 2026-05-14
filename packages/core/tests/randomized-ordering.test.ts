import { describe, expect, it } from "vitest";
import { createPacket, replayPacket } from "../src/index.js";
import { assertReplayCanonical } from "./helpers.js";

/** Deterministic “wrong” key order (descending lexicographic). */
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

describe("ordering adversarial", () => {
  it("reverse key order yields identical packet hash (100 iterations)", () => {
    const canonicalShape = { a: 1, b: { y: 2, x: 3 }, c: [3, 2, 1] };
    const shuffled = reverseKeyOrder(canonicalShape);
    const opts = { disableCompression: true, createdAt: "ORD" } as const;
    const h0 = createPacket(canonicalShape, opts).packet_hash;
    for (let i = 0; i < 100; i++) {
      expect(createPacket(shuffled, opts).packet_hash).toBe(h0);
    }
  });

  it("array build order permuted (same elements) hashes identically", () => {
    const a = [{ k: 1 }, { k: 2 }];
    const b = [{ k: 2 }, { k: 1 }].sort((x, y) =>
      (x as { k: number }).k < (y as { k: number }).k ? -1 : 1,
    );
    expect(createPacket(a, { disableCompression: true }).packet_hash).toBe(
      createPacket(b, { disableCompression: true }).packet_hash,
    );
  });

  it("replay stable under adversarial nesting", () => {
    const inner = { m: 1, n: 2 };
    const input = reverseKeyOrder({ zz: inner, aa: inner });
    const p = createPacket(input, { disableCompression: true });
    assertReplayCanonical(replayPacket(p).canonical, input);
  });
});
