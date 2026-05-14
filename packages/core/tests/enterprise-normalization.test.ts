import { describe, expect, it } from "vitest";
import { normalizeTypes } from "../src/index.js";

describe("enterprise normalization (strings)", () => {
  it('keeps "1" and "0" as strings', () => {
    expect(normalizeTypes("1")).toBe("1");
    expect(normalizeTypes("0")).toBe("0");
  });

  it('keeps "00123" as string', () => {
    expect(normalizeTypes("00123")).toBe("00123");
  });

  it("boolean words only", () => {
    expect(normalizeTypes("true")).toBe(true);
    expect(normalizeTypes("false")).toBe(false);
    expect(normalizeTypes("TRUE")).toBe(true);
    expect(normalizeTypes("yes")).toBe(true);
    expect(normalizeTypes("no")).toBe(false);
  });

  it("patient_id zero stays string", () => {
    expect(normalizeTypes({ patient_id: "0" })).toEqual({ patient_id: "0" });
  });

  it("decimal amount still normalizes", () => {
    expect(normalizeTypes("49.990")).toBe(49.99);
    expect(normalizeTypes({ amount: "49.990" })).toEqual({ amount: 49.99 });
  });

  it("integer-looking strings stay strings", () => {
    expect(normalizeTypes("42")).toBe("42");
    expect(normalizeTypes("-7")).toBe("-7");
  });
});
