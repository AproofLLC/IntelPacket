import { describe, expect, it } from "vitest";
import { IntelPacketPIIError, protectPII, tokenizeField, validatePrivacyPolicy } from "../../src/index.js";

const SEC = "unit-test-token-secret-min-32b!!!";

describe("tokenization", () => {
  it("same value + same secret + same field gives same token", () => {
    const a = tokenizeField("patient_name", "John Smith", SEC);
    const b = tokenizeField("patient_name", "John Smith", SEC);
    expect(a).toBe(b);
  });

  it("same value + different secret gives different token", () => {
    const a = tokenizeField("patient_name", "John Smith", SEC);
    const b = tokenizeField("patient_name", "John Smith", SEC + "x");
    expect(a).not.toBe(b);
  });

  it("same value + same secret + different field gives different token", () => {
    const a = tokenizeField("a.name", "John Smith", SEC);
    const b = tokenizeField("b.name", "John Smith", SEC);
    expect(a).not.toBe(b);
  });

  it("token prefix is field-safe", () => {
    const t = tokenizeField("patient_name", "John Smith", SEC);
    expect(t.startsWith("tok_patient_name_")).toBe(true);
  });

  it("token does not contain raw value", () => {
    const t = tokenizeField("x", "SUPER_SECRET_VALUE", SEC);
    expect(t.includes("SUPER")).toBe(false);
    expect(t.includes("SECRET")).toBe(false);
  });

  it("missing tokenSecret throws IntelPacketPIIError", () => {
    expect(() =>
      protectPII(
        { patient_name: "A" },
        validatePrivacyPolicy({
          version: "v1",
          mode: "fail-closed",
          tokenize: ["patient_name"],
          allow: ["patient_name"],
        }),
        {},
      ),
    ).toThrow(IntelPacketPIIError);
  });

  it("nested tokenization", () => {
    const out = protectPII(
      { ward: { mrn: "M-1" } },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        tokenize: ["ward.mrn"],
        allow: ["ward.mrn"],
      }),
      { tokenSecret: SEC },
    );
    expect(((out.data as { ward: { mrn: string } }).ward.mrn).startsWith("tok_")).toBe(true);
  });

  it("array tokenization", () => {
    const out = protectPII(
      { rows: [{ id: "r1" }] },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        tokenize: ["rows[].id"],
        allow: ["rows", "rows[].id"],
      }),
      { tokenSecret: SEC },
    );
    expect(((out.data as { rows: { id: string }[] }).rows[0].id).startsWith("tok_")).toBe(true);
  });

  it("tokenization does not mutate input", () => {
    const input = { patient_name: "Pat" };
    const copy = structuredClone(input);
    protectPII(
      input,
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        tokenize: ["patient_name"],
        allow: ["patient_name"],
      }),
      { tokenSecret: SEC },
    );
    expect(input).toEqual(copy);
  });

  it("report lists fields_tokenized", () => {
    const out = protectPII(
      { patient_name: "John Smith" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        tokenize: ["patient_name"],
        allow: ["patient_name"],
      }),
      { tokenSecret: SEC },
    );
    expect(out.report.fields_tokenized).toContain("patient_name");
  });

  it("deterministic across 50 runs", () => {
    const pol = validatePrivacyPolicy({
      version: "v1",
      mode: "fail-closed",
      tokenize: ["patient_name"],
      allow: ["patient_name"],
    });
    let prev: string | undefined;
    for (let i = 0; i < 50; i++) {
      const out = protectPII({ patient_name: "Same" }, pol, { tokenSecret: SEC });
      const s = JSON.stringify(out.data);
      if (prev !== undefined) expect(s).toBe(prev);
      prev = s;
    }
  });
});
