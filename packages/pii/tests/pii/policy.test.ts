import { describe, expect, it } from "vitest";
import { IntelPacketPIIError, protectPII, validatePrivacyPolicy } from "../../src/index.js";

describe("privacy policy validation", () => {
  it("valid policy passes", () => {
    const p = validatePrivacyPolicy({
      version: "v1",
      mode: "fail-closed",
      redact: ["ssn"],
      allow: ["id", "ssn"],
    });
    expect(p.version).toBe("v1");
  });

  it("default mode is fail-closed", () => {
    const p = validatePrivacyPolicy({ version: "v1" });
    expect(p.mode).toBe("fail-closed");
  });

  it("invalid mode fails", () => {
    expect(() =>
      validatePrivacyPolicy({
        version: "v1",
        mode: "open",
      } as unknown as Parameters<typeof validatePrivacyPolicy>[0]),
    ).toThrow(IntelPacketPIIError);
    try {
      validatePrivacyPolicy({
        version: "v1",
        mode: "open",
      } as unknown as Parameters<typeof validatePrivacyPolicy>[0]);
    } catch (e) {
      expect(e).toBeInstanceOf(IntelPacketPIIError);
      expect((e as IntelPacketPIIError).code).toBe("INVALID_POLICY");
    }
  });

  it("duplicate field across actions fails", () => {
    expect(() =>
      validatePrivacyPolicy({
        version: "v1",
        redact: ["ssn"],
        mask: ["ssn"],
      }),
    ).toThrow(IntelPacketPIIError);
  });

  it("field in redact + tokenize fails", () => {
    expect(() =>
      validatePrivacyPolicy({
        version: "v1",
        redact: ["x"],
        tokenize: ["x"],
      }),
    ).toThrow(IntelPacketPIIError);
  });

  it("field in mask + hmac fails", () => {
    expect(() =>
      validatePrivacyPolicy({
        version: "v1",
        mask: ["email"],
        hmac: ["email"],
      }),
    ).toThrow(IntelPacketPIIError);
  });

  it("rejects unsafe path __proto__", () => {
    expect(() =>
      validatePrivacyPolicy({ version: "v1", redact: ["__proto__.polluted"] }),
    ).toThrow(IntelPacketPIIError);
  });

  it("rejects unsafe path constructor", () => {
    expect(() =>
      validatePrivacyPolicy({ version: "v1", redact: ["constructor.foo"] }),
    ).toThrow(IntelPacketPIIError);
  });

  it("rejects unsafe path prototype", () => {
    expect(() =>
      validatePrivacyPolicy({ version: "v1", redact: ["prototype.foo"] }),
    ).toThrow(IntelPacketPIIError);
  });

  it("accepts patients[].ssn wildcard", () => {
    expect(() =>
      validatePrivacyPolicy({
        version: "v1",
        redact: ["patients[].ssn"],
      }),
    ).not.toThrow();
  });

  it("accepts employees[].email wildcard", () => {
    expect(() =>
      validatePrivacyPolicy({
        version: "v1",
        mask: ["employees[].email"],
      }),
    ).not.toThrow();
  });

  it("rejects literal indexed path patients[0].ssn", () => {
    expect(() =>
      validatePrivacyPolicy({
        version: "v1",
        redact: ["patients[0].ssn"],
      }),
    ).toThrow(IntelPacketPIIError);
  });

  it("allowlist policy validates", () => {
    expect(() =>
      validatePrivacyPolicy({
        version: "v1",
        allow: ["id", "status"],
      }),
    ).not.toThrow();
  });

  it("denylist policy validates", () => {
    expect(() =>
      validatePrivacyPolicy({
        version: "v1",
        deny: ["raw_notes"],
        allow: ["id"],
      }),
    ).not.toThrow();
  });

  it("same path may appear in allow and redact", () => {
    expect(() =>
      validatePrivacyPolicy({
        version: "v1",
        redact: ["ssn"],
        allow: ["ssn", "id"],
      }),
    ).not.toThrow();
  });

  it("duplicate paths in deny and remove fail", () => {
    expect(() =>
      validatePrivacyPolicy({
        version: "v1",
        remove: ["x"],
        deny: ["x"],
      }),
    ).toThrow(IntelPacketPIIError);
  });

  it("empty minimal policy validates; benign payload does not throw", () => {
    const p = validatePrivacyPolicy({ version: "v1" });
    const out = protectPII({ record_kind: "heartbeat", beats_per_minute: 72 }, p);
    expect(out.report.safe_for_packetization).toBe(true);
    expect(out.report.raw_pii_present).toBe(false);
  });

  it("empty policy still fail-closes on detected PII without rules", () => {
    const p = validatePrivacyPolicy({ version: "v1" });
    expect(() => protectPII({ email: "a@b.example", id: "1" }, p)).toThrow(IntelPacketPIIError);
  });
});
