import { describe, expect, it } from "vitest";
import { IntelPacketPIIError, protectPII, validatePrivacyPolicy, verifyPrivacyResult } from "../../src/index.js";

describe("permissive mode", () => {
  it("unhandled PII does not throw", () => {
    expect(() =>
      protectPII({ ssn: "123-45-6789" }, validatePrivacyPolicy({ version: "v1", mode: "permissive" })),
    ).not.toThrow();
  });

  it("report lists unhandled_sensitive_fields", () => {
    const out = protectPII({ ssn: "123-45-6789" }, validatePrivacyPolicy({ version: "v1", mode: "permissive" }));
    expect(out.report.unhandled_sensitive_fields.length).toBeGreaterThan(0);
  });

  it("safe_for_packetization false when raw PII remains", () => {
    const out = protectPII({ ssn: "123-45-6789" }, validatePrivacyPolicy({ version: "v1", mode: "permissive" }));
    expect(out.report.safe_for_packetization).toBe(false);
  });

  it("raw_pii_present true when raw PII remains", () => {
    const out = protectPII({ ssn: "123-45-6789" }, validatePrivacyPolicy({ version: "v1", mode: "permissive" }));
    expect(out.report.raw_pii_present).toBe(true);
  });

  it("permissive result does not pass verifyPrivacyResult", () => {
    const out = protectPII({ ssn: "123-45-6789" }, validatePrivacyPolicy({ version: "v1", mode: "permissive" }));
    expect(verifyPrivacyResult(out).ok).toBe(false);
  });

  it("failOnUnhandledPII forces throw in permissive mode", () => {
    expect(() =>
      protectPII(
        { ssn: "123-45-6789" },
        validatePrivacyPolicy({ version: "v1", mode: "permissive" }),
        { failOnUnhandledPII: true },
      ),
    ).toThrow(IntelPacketPIIError);
  });
});
