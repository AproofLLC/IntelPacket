import { describe, expect, it } from "vitest";
import { normalizeTypes } from "../src/index.js";

describe("normalizeTypes", () => {
  it("normalizes decimal strings and explicit boolean words only", () => {
    expect(normalizeTypes("49.990")).toBe(49.99);
    expect(normalizeTypes("TRUE")).toBe(true);
    expect(normalizeTypes("false")).toBe(false);
    expect(normalizeTypes("yes")).toBe(true);
  });

  it('does not coerce "1" or "0" strings to booleans', () => {
    expect(normalizeTypes("1")).toBe("1");
    expect(normalizeTypes("0")).toBe("0");
  });

  it("normalizes timestamps to ISO UTC", () => {
    const n = normalizeTypes("2026-05-13 10:00 PM");
    expect(typeof n).toBe("string");
    expect(String(n)).toMatch(/2026-05-13T/);
  });

  it("applies NFC unicode normalization", () => {
    const s = "e\u0301";
    expect(normalizeTypes(s)).toBe("\u00e9");
  });

  it("drops undefined and preserves null", () => {
    expect(
      normalizeTypes({ a: 1, b: undefined, c: null, d: [undefined, 2] }),
    ).toEqual({ a: 1, c: null, d: [2] });
  });

  it("does not mutate input", () => {
    const input = { z: 1, a: { b: "2" } };
    const copy = JSON.parse(JSON.stringify(input)) as typeof input;
    normalizeTypes(input);
    expect(input).toEqual(copy);
  });

  it("does not treat id-like strings as dates", () => {
    expect(normalizeTypes("d-0")).toBe("d-0");
    expect(normalizeTypes("edge-1")).toBe("edge-1");
  });

  it("leaves malformed timestamps as normalized strings", () => {
    expect(normalizeTypes("not-a-real-date-xyz")).toBe("not-a-real-date-xyz");
  });
});
