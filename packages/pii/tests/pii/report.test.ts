import { describe, expect, it } from "vitest";
import { createPrivacyReport, protectPII, validatePrivacyPolicy, verifyPrivacyResult } from "../../src/index.js";

describe("privacy report structure", () => {
  it("report contains policy_version", () => {
    const out = protectPII(
      { id: "1", ssn: "123-45-6789" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["ssn"],
        allow: ["id", "ssn"],
      }),
    );
    expect(out.report.policy_version).toBe("v1");
    expect(out.report.pii_spec_version).toBe("1");
  });

  it("report contains mode", () => {
    const out = protectPII(
      { email: "a@b.co" },
      validatePrivacyPolicy({ version: "v1", mode: "permissive" }),
    );
    expect(out.report.mode).toBe("permissive");
  });

  it("report fields_detected are path metadata only, not raw values", () => {
    const out = protectPII(
      { ssn: "123-45-6789", phone: "555-123-4567", id: "1" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["ssn"],
        mask: ["phone"],
        allow: ["id", "ssn", "phone"],
      }),
    );
    const r = JSON.stringify(out.report);
    expect(r.includes("123-45")).toBe(false);
    expect(r.includes("555-123")).toBe(false);
    expect(out.report.fields_detected.length).toBeGreaterThan(0);
  });

  it("fields_redacted correct", () => {
    const out = protectPII(
      { ssn: "123-45-6789", id: "1" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["ssn"],
        allow: ["id", "ssn"],
      }),
    );
    expect(out.report.fields_redacted).toContain("ssn");
  });

  it("fields_masked correct", () => {
    const out = protectPII(
      { phone: "555-123-4567", id: "1" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        mask: ["phone"],
        allow: ["id", "phone"],
      }),
    );
    expect(out.report.fields_masked).toContain("phone");
  });

  it("fields_tokenized correct", () => {
    const out = protectPII(
      { mrn: "M-1", id: "1" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        tokenize: ["mrn"],
        allow: ["id", "mrn"],
      }),
      { tokenSecret: "x".repeat(32) },
    );
    expect(out.report.fields_tokenized).toContain("mrn");
  });

  it("fields_hmac correct", () => {
    const out = protectPII(
      { dob: "1980-01-01", id: "1" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        hmac: ["dob"],
        allow: ["id", "dob"],
      }),
      { hmacSecret: "y".repeat(32) },
    );
    expect(out.report.fields_hmac).toContain("dob");
  });

  it("fields_removed correct", () => {
    const out = protectPII(
      { junk: "x", id: "1" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        remove: ["junk"],
        allow: ["id"],
      }),
    );
    expect(out.report.fields_removed).toContain("junk");
  });

  it("denied_fields correct", () => {
    const out = protectPII(
      { raw_notes: "n", id: "1" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        deny: ["raw_notes"],
        allow: ["id"],
      }),
    );
    expect(out.report.denied_fields).toContain("raw_notes");
  });

  it("allowed_fields lists policy allow entries", () => {
    const out = protectPII(
      { id: "1" },
      validatePrivacyPolicy({ version: "v1", allow: ["id", "status"] }),
    );
    expect(out.report.allowed_fields).toContain("id");
    expect(out.report.allowed_fields).toContain("status");
  });

  it("safe_for_packetization true only when no raw PII remains", () => {
    const good = protectPII(
      { id: "1", ssn: "123-45-6789" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["ssn"],
        allow: ["id", "ssn"],
      }),
    );
    expect(good.report.safe_for_packetization).toBe(true);

    const bad = protectPII({ ssn: "123-45-6789" }, validatePrivacyPolicy({ version: "v1", mode: "permissive" }));
    expect(bad.report.safe_for_packetization).toBe(false);
  });

  it("raw_pii_present false after successful fail-closed transform", () => {
    const out = protectPII(
      { id: "1", ssn: "123-45-6789" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["ssn"],
        allow: ["id", "ssn"],
      }),
    );
    expect(out.report.raw_pii_present).toBe(false);
  });

  it("unhandled_sensitive_fields populated in permissive mode", () => {
    const out = protectPII({ ssn: "123-45-6789" }, validatePrivacyPolicy({ version: "v1", mode: "permissive" }));
    expect(out.report.unhandled_sensitive_fields.length).toBeGreaterThan(0);
  });

  it("createPrivacyReport infers redaction from diff", () => {
    const input = { ssn: "123-45-6789" };
    const transformed = { ssn: "[REDACTED]" };
    const rep = createPrivacyReport(input, transformed, { version: "v1", mode: "fail-closed" });
    expect(rep.fields_redacted).toContain("ssn");
    expect(rep.pii_spec_version).toBe("1");
  });
});
