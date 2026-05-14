import { describe, expect, it } from "vitest";
import { IntelPacketPIIError, createPIIPacket, protectPII, validatePrivacyPolicy } from "../../src/index.js";

const TOK = "qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
const HMK = "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr";

class NotPlain {}

describe("PII security constraints", () => {
  it("rejects __proto__ key on plain object", () => {
    const o = JSON.parse('{"__proto__":{"polluted":1},"a":1}');
    expect(() =>
      protectPII(o, validatePrivacyPolicy({ version: "v1", mode: "fail-closed", allow: ["a"] })),
    ).toThrow(IntelPacketPIIError);
  });

  it("rejects constructor key", () => {
    expect(() =>
      protectPII(
        JSON.parse('{"constructor":{"name":"x"},"a":1}'),
        validatePrivacyPolicy({ version: "v1", mode: "fail-closed", allow: ["a"] }),
      ),
    ).toThrow(IntelPacketPIIError);
  });

  it("rejects prototype key", () => {
    expect(() =>
      protectPII(
        JSON.parse('{"prototype":{"x":1},"a":1}'),
        validatePrivacyPolicy({ version: "v1", mode: "fail-closed", allow: ["a"] }),
      ),
    ).toThrow(IntelPacketPIIError);
  });

  it("rejects nested dangerous key", () => {
    expect(() =>
      protectPII(
        { outer: JSON.parse('{"__proto__":{}}') },
        validatePrivacyPolicy({ version: "v1", mode: "fail-closed", allow: ["outer"] }),
      ),
    ).toThrow(IntelPacketPIIError);
  });

  it("rejects dangerous key inside array element object", () => {
    expect(() =>
      protectPII(
        { rows: [JSON.parse('{"__proto__":{}}')] },
        validatePrivacyPolicy({ version: "v1", mode: "fail-closed", allow: ["rows"] }),
      ),
    ).toThrow(IntelPacketPIIError);
  });

  it("rejects circular input", () => {
    const a: Record<string, unknown> = { x: 1 };
    a.self = a;
    expect(() =>
      createPIIPacket(a, { version: "v1", mode: "fail-closed", allow: ["x"] }, { packetOptions: { disableCompression: true } }),
    ).toThrow(IntelPacketPIIError);
  });

  it("rejects Date values in object", () => {
    expect(() =>
      protectPII({ when: new Date() }, validatePrivacyPolicy({ version: "v1", allow: ["when"] })),
    ).toThrow(IntelPacketPIIError);
  });

  it("rejects Map", () => {
    expect(() =>
      protectPII({ m: new Map([["k", "v"]]) }, validatePrivacyPolicy({ version: "v1", allow: ["m"] })),
    ).toThrow(IntelPacketPIIError);
  });

  it("rejects Set", () => {
    expect(() =>
      protectPII({ s: new Set([1]) }, validatePrivacyPolicy({ version: "v1", allow: ["s"] })),
    ).toThrow(IntelPacketPIIError);
  });

  it("rejects class instance object payloads", () => {
    expect(() =>
      protectPII({ c: new NotPlain() }, validatePrivacyPolicy({ version: "v1", allow: ["c"] })),
    ).toThrow(IntelPacketPIIError);
  });

  it("secrets never appear in protectPII output", () => {
    const out = protectPII(
      { id: "1", mrn: "m" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        tokenize: ["mrn"],
        allow: ["id", "mrn"],
      }),
      { tokenSecret: TOK, hmacSecret: HMK },
    );
    const blob = JSON.stringify(out);
    expect(blob.includes(TOK)).toBe(false);
    expect(blob.includes(HMK)).toBe(false);
  });

  it("secrets never appear in typical IntelPacketPIIError messages for unhandled PII", () => {
    try {
      protectPII({ ssn: "123-45-6789" }, validatePrivacyPolicy({ version: "v1" }), {
        tokenSecret: TOK,
        hmacSecret: HMK,
      });
      expect.fail("expected throw");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg.includes(TOK)).toBe(false);
      expect(msg.includes(HMK)).toBe(false);
    }
  });

  it("reports never contain raw PII values after transform", () => {
    const out = protectPII(
      { id: "1", ssn: "123-45-6789" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["ssn"],
        allow: ["id", "ssn"],
      }),
      { tokenSecret: TOK, hmacSecret: HMK },
    );
    expect(JSON.stringify(out.report).includes("123-45")).toBe(false);
  });

  it("errors from missing secrets do not include raw field values", () => {
    try {
      protectPII(
        { mrn: "SECRET-MRN-VALUE" },
        validatePrivacyPolicy({
          version: "v1",
          mode: "fail-closed",
          tokenize: ["mrn"],
          allow: ["mrn"],
        }),
      );
      expect.fail("expected throw");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg.includes("SECRET-MRN-VALUE")).toBe(false);
    }
  });

  it("library processing does not add enumerable properties to Object.prototype", () => {
    const descCountBefore = Object.getOwnPropertyDescriptors(Object.prototype);
    protectPII(
      { id: "1" },
      validatePrivacyPolicy({ version: "v1", mode: "fail-closed", allow: ["id"] }),
    );
    const descCountAfter = Object.getOwnPropertyDescriptors(Object.prototype);
    expect(Object.keys(descCountAfter).sort()).toEqual(Object.keys(descCountBefore).sort());
  });
});
