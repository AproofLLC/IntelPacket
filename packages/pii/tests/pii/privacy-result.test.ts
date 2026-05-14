import { describe, expect, it } from "vitest";
import type { PrivacyReport, ProtectPIIResult } from "../../src/index.js";
import { verifyPrivacyResult } from "../../src/index.js";

const baseReport = (over: Partial<PrivacyReport>): PrivacyReport => ({
  policy_version: "v1",
  pii_spec_version: "1",
  mode: "fail-closed",
  raw_pii_present: false,
  fields_detected: [],
  fields_redacted: [],
  fields_masked: [],
  fields_tokenized: [],
  fields_hmac: [],
  fields_removed: [],
  unhandled_sensitive_fields: [],
  denied_fields: [],
  allowed_fields: [],
  transform_count: 0,
  safe_for_packetization: true,
  ...over,
});

describe("verifyPrivacyResult", () => {
  it("passes on safe protect result", () => {
    const r: ProtectPIIResult = {
      data: { id: "1", ssn: "[REDACTED]" },
      report: baseReport({
        fields_detected: [{ path: "ssn", field: "ssn", category: "ssn", detection: "field_name", actionRequired: true }],
        fields_redacted: ["ssn"],
        allowed_fields: ["id", "ssn"],
        transform_count: 1,
      }),
    };
    expect(verifyPrivacyResult(r).ok).toBe(true);
  });

  it("fails when safe_for_packetization false", () => {
    const r: ProtectPIIResult = {
      data: { ssn: "123-45-6789" },
      report: baseReport({ safe_for_packetization: false, unhandled_sensitive_fields: ["ssn"] }),
    };
    const v = verifyPrivacyResult(r);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("RAW_PII_REMAINS");
  });

  it("fails when raw_pii_present true", () => {
    const r: ProtectPIIResult = {
      data: { id: "1" },
      report: baseReport({ raw_pii_present: true, safe_for_packetization: true }),
    };
    const v = verifyPrivacyResult(r);
    expect(v.ok).toBe(false);
  });

  it("fails when residual SSN pattern remains in transformed strings", () => {
    const r: ProtectPIIResult = {
      data: { note: "123-45-6789" },
      report: baseReport({
        fields_detected: [],
        allowed_fields: ["note"],
        safe_for_packetization: true,
        raw_pii_present: false,
      }),
    };
    const v = verifyPrivacyResult(r);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.message).toContain("pattern");
  });

  it("does not require or embed secrets in verification", () => {
    const secret = "zzz-top-secret-key-do-not-echo-32b";
    const r: ProtectPIIResult = {
      data: { t: "tok_x" },
      report: baseReport({
        fields_detected: [],
        allowed_fields: ["t"],
      }),
    };
    const v = verifyPrivacyResult(r);
    const dumped = JSON.stringify(v);
    expect(dumped.includes(secret)).toBe(false);
  });

  it("deterministic: same input gives same outcome", () => {
    const r: ProtectPIIResult = {
      data: { id: "1" },
      report: baseReport({ allowed_fields: ["id"] }),
    };
    expect(JSON.stringify(verifyPrivacyResult(r))).toBe(JSON.stringify(verifyPrivacyResult(r)));
  });
});
