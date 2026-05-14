import { describe, expect, it } from "vitest";
import { normalizeTypes } from "../src/index.js";

describe("enterprise date normalization", () => {
  it('preserves invalid calendar dates as strings', () => {
    expect(normalizeTypes("2026-02-31")).toBe("2026-02-31");
    expect(normalizeTypes("2026-13-01")).toBe("2026-13-01");
    expect(normalizeTypes("2026-00-10")).toBe("2026-00-10");
  });

  it("valid ISO date normalizes to ISO UTC string", () => {
    const n = normalizeTypes("2026-05-20T12:00:00.000Z");
    expect(n).toBe("2026-05-20T12:00:00.000Z");
  });

  it("valid date-only normalizes", () => {
    const n = normalizeTypes("2026-05-20");
    expect(typeof n).toBe("string");
    expect(String(n)).toMatch(/^2026-05-20/);
  });

  it("space-separated wall time normalizes when valid", () => {
    const n = normalizeTypes("2026-05-13 10:00 PM");
    expect(String(n)).toContain("2026-05-13T");
  });
});
