import { describe, expect, it } from "vitest";
import { IntelPacketPIIError, protectPII, validatePrivacyPolicy, verifyPrivacyResult } from "../../src/index.js";

describe("nested path behavior", () => {
  it("dot path patient.ssn works", () => {
    const out = protectPII(
      { patient: { ssn: "123-45-6789" } },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["patient.ssn"],
        allow: ["patient.ssn"],
      }),
    );
    expect((out.data as { patient: { ssn: string } }).patient.ssn).toBe("[REDACTED]");
    expect(verifyPrivacyResult(out).ok).toBe(true);
  });

  it("wildcard patients[].ssn works", () => {
    const out = protectPII(
      { patients: [{ ssn: "123-45-6789" }] },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["patients[].ssn"],
        allow: ["patients", "patients[].ssn"],
      }),
    );
    expect((out.data as { patients: { ssn: string }[] }).patients[0].ssn).toBe("[REDACTED]");
  });

  it("nested provider email masking", () => {
    const out = protectPII(
      {
        encounters: [{ id: "e1", provider: { email: "dr@clinic.test", name: "Dr" } }],
      },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        mask: ["encounters[].provider.email"],
        allow: ["encounters", "encounters[].id", "encounters[].provider", "encounters[].provider.email", "encounters[].provider.name"],
      }),
    );
    const em = (out.data as { encounters: { provider: { email: string } }[] }).encounters[0].provider.email;
    expect(em.includes("*")).toBe(true);
    expect(verifyPrivacyResult(out).ok).toBe(true);
  });

  it("nested array of encounters tokenization", () => {
    const out = protectPII(
      { encounters: [{ enc_id: "E1", mrn: "M-9" }] },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        tokenize: ["encounters[].mrn"],
        allow: ["encounters", "encounters[].enc_id", "encounters[].mrn"],
      }),
      { tokenSecret: "t".repeat(32) },
    );
    expect(((out.data as { encounters: { mrn: string }[] }).encounters[0].mrn).startsWith("tok_")).toBe(true);
  });

  it("nested allowlist keeps allowed deep leaves", () => {
    const out = protectPII(
      { root: { child: { id: "1" } } },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        allow: ["root", "root.child", "root.child.id"],
      }),
    );
    expect((out.data as { root: { child: { id: string } } }).root.child.id).toBe("1");
  });

  it("nested denylist strips deny path", () => {
    const out = protectPII(
      { root: { secret_note: "x", id: "1" } },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        deny: ["root.secret_note"],
        allow: ["root", "root.id"],
      }),
    );
    expect((out.data as { root: Record<string, unknown> }).root.secret_note).toBeUndefined();
  });

  it("deep object transform applies at leaf", () => {
    const out = protectPII(
      { a: { b: { c: { ssn: "123-45-6789" } } } },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["a.b.c.ssn"],
        allow: ["a.b.c.ssn"],
      }),
    );
    expect((out.data as { a: { b: { c: { ssn: string } } } }).a.b.c.ssn).toBe("[REDACTED]");
  });

  it("literal indexed policy paths are rejected at validation", () => {
    expect(() =>
      validatePrivacyPolicy({
        version: "v1",
        redact: ["patients[0].ssn"],
      }),
    ).toThrow(IntelPacketPIIError);
  });
});
