import { describe, expect, it } from "vitest";
import {
  IP_DELETE_SENTINEL,
  IP_NUM_ADD_KEY,
  applyDelta,
  canonicalize,
  diffPackets,
} from "../src/index.js";

describe("diffPackets / applyDelta", () => {
  it("supports nested object diffs and numeric deltas", () => {
    const base = canonicalize({ cpu: 50, nest: { a: 1 } });
    const next = canonicalize({ cpu: 51, nest: { a: 2 }, z: 3 });
    const d = diffPackets(base, next);
    expect(applyDelta(base, d)).toEqual(next);
    expect(d.cpu).toEqual({ [IP_NUM_ADD_KEY]: 1 });
  });

  it("removes keys via deletion sentinel", () => {
    const base = canonicalize({ a: 1, b: 2 });
    const next = canonicalize({ a: 1 });
    const d = diffPackets(base, next);
    expect(d.b).toBe(IP_DELETE_SENTINEL);
    expect(applyDelta(base, d)).toEqual(next);
  });

  it("replaces arrays wholesale", () => {
    const base = canonicalize({ items: [1, 2] });
    const next = canonicalize({ items: [1, 2, 3] });
    const d = diffPackets(base, next);
    expect(applyDelta(base, d)).toEqual(next);
  });

  it("delta reversibility for empty diff", () => {
    const base = canonicalize({ x: 1 });
    expect(diffPackets(base, base)).toEqual({});
    expect(applyDelta(base, {})).toEqual(base);
  });
});
