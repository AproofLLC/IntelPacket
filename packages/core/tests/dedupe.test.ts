import { describe, expect, it } from "vitest";
import { dedupeStructures, expandRefs } from "../src/index.js";

describe("dedupeStructures", () => {
  it("replaces duplicate subtrees with stable refs", () => {
    const shared = { k: 1, j: 2 };
    const input = { a: shared, b: shared };
    const d = dedupeStructures(input);
    expect(d.value).toEqual({
      a: { k: 1, j: 2 },
      b: { __ip_ref: "r0" },
    });
    expect(d.refs.r0).toEqual({ j: 2, k: 1 });
  });

  it("handles nested arrays with repeated objects", () => {
    const row = { id: 1 };
    const input = { rows: [row, row] };
    const d = dedupeStructures(input);
    expect(expandRefs(d.value, d.refs)).toEqual({ rows: [{ id: 1 }, { id: 1 }] });
  });
});

describe("expandRefs", () => {
  it("throws on missing ref", () => {
    expect(() => expandRefs({ __ip_ref: "nope" }, {})).toThrow(/missing dedupe ref/i);
  });
});
