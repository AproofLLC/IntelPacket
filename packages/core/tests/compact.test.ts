import { describe, expect, it } from "vitest";
import { canonicalize, compactSchema, expandSchema } from "../src/index.js";

describe("compactSchema", () => {
  it("reverses deterministically with defaults", () => {
    const input = { timestamp: 1, user_id: "x", other: 2 };
    const c = compactSchema(input);
    expect(c).toEqual({ ts: 1, uid: "x", other: 2 });
    expect(expandSchema(c)).toEqual(canonicalize(input));
  });

  it("supports custom dictionaries", () => {
    const input = { custom_long: 5 };
    const c = compactSchema(input, { dictionary: { custom_long: "cl" } });
    expect(c).toEqual({ cl: 5 });
    expect(expandSchema(c, { dictionary: { custom_long: "cl" } })).toEqual(
      canonicalize(input),
    );
  });
});
