import { describe, expect, it } from "vitest";
import { normalizeTypes, validatePacketInput } from "../src/index.js";

describe("enterprise non-plain object rejection", () => {
  it("rejects Date", () => {
    expect(() => validatePacketInput(new Date())).toThrow(/plain objects/);
    expect(() => normalizeTypes(new Date())).toThrow(/plain objects/);
  });

  it("rejects Map and Set", () => {
    expect(() => validatePacketInput(new Map())).toThrow(/Date, Map, Set/);
    expect(() => validatePacketInput(new Set())).toThrow(/Date, Map, Set/);
  });

  it("rejects RegExp", () => {
    expect(() => validatePacketInput(/x/)).toThrow(/Date, Map, Set/);
  });

  it("rejects class instances", () => {
    class C {
      x = 1;
    }
    expect(() => validatePacketInput(new C())).toThrow(/plain objects/);
  });

  it("allows null-prototype object with safe keys", () => {
    const o = Object.create(null) as Record<string, unknown>;
    o.ok = 1;
    expect(normalizeTypes(o)).toEqual({ ok: 1 });
  });

  it("rejects null-prototype unsafe key", () => {
    const o = Object.create(null) as Record<string, unknown>;
    o["__proto__"] = { bad: 1 };
    expect(() => normalizeTypes(o)).toThrow(/unsafe object key/i);
  });
});
