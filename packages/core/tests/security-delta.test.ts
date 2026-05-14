import { describe, expect, it } from "vitest";
import {
  IP_DELETE_SENTINEL,
  applyDelta,
  canonicalize,
  canonicalStringify,
  diffPackets,
  normalizeTypes,
} from "../src/index.js";

describe("delta abuse resistance", () => {
  it("applyDelta rejects unsafe keys in patch", () => {
    const patch = Object.create(null) as Record<string, unknown>;
    patch.b = 2;
    patch["__proto__"] = { z: 1 };
    expect(() => applyDelta({ a: 1 }, patch)).toThrow(/unsafe object key/i);
  });

  it("diffPackets rejects unsafe keys in operands", () => {
    expect(() =>
      diffPackets({ good: 1 }, { good: 1, constructor: { x: 1 } }),
    ).toThrow(/unsafe object key/i);
  });

  it("deletion sentinel removes only the targeted key; nested object is not implicit delete-all", () => {
    const base = { a: { x: 1 } };
    const patch = { a: { nestedDelete: IP_DELETE_SENTINEL } };
    const out = applyDelta(base, patch as Record<string, unknown>);
    expect(out).toEqual(canonicalize({ a: { x: 1 } }));
    const removed = applyDelta({ a: 1, b: 2 }, { b: IP_DELETE_SENTINEL });
    expect(removed).toEqual(canonicalize({ a: 1 }));
  });

  it("numeric delta rejects non-finite via canonicalize path", () => {
    const base = { n: 1 };
    const next = { n: Number.NaN };
    const d = diffPackets(base, next);
    const rebuilt = applyDelta(base, d);
    expect(JSON.stringify(canonicalize(next))).toContain("null");
    expect(rebuilt).toEqual(canonicalize({ n: null }));
  });

  it("nested invalid patch shapes are normalized by canonicalize", () => {
    const base = { a: { b: 1 } };
    const patch = { a: { b: { __ip_num_add: Number.NaN } } } as Record<string, unknown>;
    const out = applyDelta(base, patch);
    expect(out).toEqual(
      canonicalize({
        a: { b: { __ip_num_add: null } },
      }),
    );
  });

  it("applyDelta does not mutate the caller base object", () => {
    const base = { x: 1, nest: { y: 2 } };
    const copy = structuredClone(base);
    applyDelta(base, { x: 9, nest: { y: 3, z: 4 } });
    expect(base).toEqual(copy);
  });

  it("delta with prototype-named key rejected before merge", () => {
    expect(() => applyDelta({}, { prototype: 1 } as Record<string, unknown>)).toThrow(
      /unsafe object key/i,
    );
  });

  it("large numeric index in array patch replaces entire array (delta is object-shaped)", () => {
    const base = { arr: [1, 2, 3] };
    const patch = { arr: [1, 2, 3, 4, 5] };
    const d = diffPackets(base, patch);
    expect(applyDelta(base, d)).toEqual(canonicalize(patch));
  });
});

describe("delta integration with normalize", () => {
  it("diff after normalize stays deterministic", () => {
    const b = normalizeTypes({ n: "10" });
    const n = normalizeTypes({ n: 12 });
    const d = diffPackets(b, n);
    expect(canonicalStringify(applyDelta(b, d))).toBe(canonicalStringify(n));
  });
});
