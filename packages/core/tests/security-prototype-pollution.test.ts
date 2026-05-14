import { describe, expect, it } from "vitest";
import {
  applyDelta,
  canonicalize,
  createPacket,
  normalizeTypes,
  replayPacket,
} from "../src/index.js";

function isPrototypeClean(): boolean {
  return !Object.prototype.hasOwnProperty.call(
    Object.prototype,
    "__intelpacket_polluted__",
  );
}

describe("prototype pollution resistance", () => {
  it("rejects __proto__ as own key after normalize/createPacket", () => {
    const malicious = Object.create(null) as Record<string, unknown>;
    malicious["__proto__"] = { __intelpacket_polluted__: true };
    expect(() => normalizeTypes(malicious)).toThrow(/unsafe object key/i);
    expect(() =>
      createPacket(malicious, {
        disableCompression: true,
      }),
    ).toThrow(/unsafe object key/i);
    expect(isPrototypeClean()).toBe(true);
  });

  it("rejects constructor and prototype keys", () => {
    expect(() => normalizeTypes({ constructor: { a: 1 } })).toThrow(/unsafe object key/i);
    expect(() => normalizeTypes({ prototype: { a: 1 } })).toThrow(/unsafe object key/i);
    expect(isPrototypeClean()).toBe(true);
  });

  it("rejects nested dangerous keys", () => {
    const inner = Object.create(null) as Record<string, unknown>;
    inner["__proto__"] = { x: 1 };
    expect(() => normalizeTypes({ a: inner })).toThrow(/unsafe object key/i);
    expect(isPrototypeClean()).toBe(true);
  });

  it("rejects dangerous keys inside arrays", () => {
    const el = Object.create(null) as Record<string, unknown>;
    el["__proto__"] = { p: 1 };
    expect(() => normalizeTypes([el])).toThrow(/unsafe object key/i);
    expect(isPrototypeClean()).toBe(true);
  });

  it("canonicalize throws on dangerous keys", () => {
    const o = Object.create(null) as Record<string, unknown>;
    o["__proto__"] = { polluted: true };
    expect(() => canonicalize(o)).toThrow(/unsafe object key/i);
    expect(isPrototypeClean()).toBe(true);
  });

  it("replay does not pollute Object.prototype", () => {
    const p = createPacket({ ok: true }, { disableCompression: true });
    replayPacket(p);
    expect(isPrototypeClean()).toBe(true);
  });

  it("createPacket fails closed on unsafe keys in user input", () => {
    const input = Object.create(null) as Record<string, unknown>;
    input.good = 1;
    input["__proto__"] = { evil: 2 };
    expect(() => createPacket(input, { disableCompression: true })).toThrow(/unsafe object key/i);
    expect(isPrototypeClean()).toBe(true);
  });

  it("applyDelta rejects patches with unsafe keys", () => {
    const patch = Object.create(null) as Record<string, unknown>;
    patch["__proto__"] = { x: 1 };
    expect(() => applyDelta({ a: 1 }, patch)).toThrow(/unsafe object key/i);
    expect(isPrototypeClean()).toBe(true);
  });
});
