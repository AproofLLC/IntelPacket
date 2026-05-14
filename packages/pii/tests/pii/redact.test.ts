import { describe, expect, it } from "vitest";
import { protectPII, validatePrivacyPolicy } from "../../src/index.js";

describe("redaction", () => {
  it("ssn redacts to [REDACTED]", () => {
    const out = protectPII(
      { id: "1", ssn: "123-45-6789", encounter_id: "e" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["ssn"],
        allow: ["id", "encounter_id", "ssn"],
      }),
      {},
    );
    expect((out.data as { ssn: string }).ssn).toBe("[REDACTED]");
    expect(out.report.fields_redacted).toContain("ssn");
  });

  it("nested ssn redacts", () => {
    const out = protectPII(
      { patient: { ssn: "123-45-6789" } },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["patient.ssn"],
        allow: ["patient.ssn"],
      }),
      {},
    );
    expect((out.data as { patient: { ssn: string } }).patient.ssn).toBe("[REDACTED]");
  });

  it("array ssn redacts via wildcard", () => {
    const out = protectPII(
      { patients: [{ ssn: "123-45-6789" }] },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["patients[].ssn"],
        allow: ["patients", "patients[].ssn"],
      }),
      {},
    );
    expect((out.data as { patients: { ssn: string }[] }).patients[0].ssn).toBe("[REDACTED]");
  });

  it("multiple fields redact", () => {
    const out = protectPII(
      { ssn: "123-45-6789", tax_id: "12-3456789", id: "1" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["ssn", "tax_id"],
        allow: ["id", "ssn", "tax_id"],
      }),
      {},
    );
    expect((out.data as { ssn: string; tax_id: string }).ssn).toBe("[REDACTED]");
    expect((out.data as { ssn: string; tax_id: string }).tax_id).toBe("[REDACTED]");
    expect(out.report.fields_redacted.sort()).toEqual(["ssn", "tax_id"].sort());
  });

  it("redaction does not mutate input", () => {
    const input = { id: "1", ssn: "123-45-6789", encounter_id: "e" };
    const copy = structuredClone(input);
    protectPII(
      input,
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["ssn"],
        allow: ["id", "encounter_id", "ssn"],
      }),
      {},
    );
    expect(input).toEqual(copy);
  });

  it("redaction report lists fields_redacted", () => {
    const out = protectPII(
      { id: "1", ssn: "123-45-6789", encounter_id: "e" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["ssn"],
        allow: ["id", "encounter_id", "ssn"],
      }),
      {},
    );
    expect(out.report.fields_redacted).toContain("ssn");
  });

  it("raw redacted value does not remain in transformed data", () => {
    const out = protectPII(
      { id: "1", ssn: "123-45-6789", encounter_id: "e" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["ssn"],
        allow: ["id", "encounter_id", "ssn"],
      }),
      {},
    );
    expect(JSON.stringify(out.data).includes("123-45")).toBe(false);
  });
});
