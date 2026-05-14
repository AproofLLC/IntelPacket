import { describe, expect, it } from "vitest";
import { canonicalize, canonicalStringify } from "../src/index.js";

describe("canonicalize", () => {
  it("sorts keys lexicographically idempotently (C(C(x)) = C(x))", () => {
    const x = { b: 1, a: { d: 2, c: 3 } };
    const once = canonicalize(x);
    const twice = canonicalize(once);
    expect(once).toEqual(twice);
    expect(Object.keys(once as object)).toEqual(["a", "b"]);
    expect(Object.keys((once as { a: object }).a)).toEqual(["c", "d"]);
  });

  it("preserves array order", () => {
    expect(canonicalize([3, 2, 1])).toEqual([3, 2, 1]);
  });

  it("stable canonicalStringify", () => {
    const a = { z: 1, y: [{ b: 2, a: 1 }] };
    const b = { y: [{ a: 1, b: 2 }], z: 1 };
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });

  it("deterministic null handling", () => {
    expect(canonicalStringify({ a: null })).toBe('{"a":null}');
  });
});
