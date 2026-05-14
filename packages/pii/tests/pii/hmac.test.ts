import { describe, expect, it } from "vitest";
import { IntelPacketPIIError, hmacField, protectPII, validatePrivacyPolicy } from "../../src/index.js";

const HSEC = "unit-test-hmac-secret-min-32bytes!!";

describe("HMAC field digests", () => {
  it("same value + same secret + same field gives same digest", () => {
    const a = hmacField("dob", "1980-01-01", HSEC);
    const b = hmacField("dob", "1980-01-01", HSEC);
    expect(a).toBe(b);
  });

  it("same value + different secret gives different digest", () => {
    expect(hmacField("dob", "1980-01-01", HSEC)).not.toBe(hmacField("dob", "1980-01-01", HSEC + "!"));
  });

  it("same value + different field gives different digest", () => {
    expect(hmacField("dob_a", "1980-01-01", HSEC)).not.toBe(hmacField("dob_b", "1980-01-01", HSEC));
  });

  it("digest does not contain raw value", () => {
    const h = hmacField("email", "secret-value@x.com", HSEC);
    expect(h.includes("secret")).toBe(false);
    expect(h.includes("@x.com")).toBe(false);
  });

  it("missing hmacSecret throws IntelPacketPIIError", () => {
    expect(() =>
      protectPII(
        { dob: "1980-01-01" },
        validatePrivacyPolicy({
          version: "v1",
          mode: "fail-closed",
          hmac: ["dob"],
          allow: ["dob"],
        }),
        {},
      ),
    ).toThrow(IntelPacketPIIError);
  });

  it("nested HMAC", () => {
    const out = protectPII(
      { p: { dob: "1980-01-01" } },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        hmac: ["p.dob"],
        allow: ["p.dob"],
      }),
      { hmacSecret: HSEC },
    );
    expect(((out.data as { p: { dob: string } }).p.dob).startsWith("hmac_")).toBe(true);
  });

  it("array HMAC", () => {
    const out = protectPII(
      { rows: [{ dob: "1990-01-01" }] },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        hmac: ["rows[].dob"],
        allow: ["rows", "rows[].dob"],
      }),
      { hmacSecret: HSEC },
    );
    expect(((out.data as { rows: { dob: string }[] }).rows[0].dob).startsWith("hmac_")).toBe(true);
  });

  it("report lists fields_hmac", () => {
    const out = protectPII(
      { dob: "1980-01-01" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        hmac: ["dob"],
        allow: ["dob"],
      }),
      { hmacSecret: HSEC },
    );
    expect(out.report.fields_hmac).toContain("dob");
  });

  it("deterministic across 50 runs", () => {
    const pol = validatePrivacyPolicy({
      version: "v1",
      mode: "fail-closed",
      hmac: ["dob"],
      allow: ["dob"],
    });
    let prev: string | undefined;
    for (let i = 0; i < 50; i++) {
      const out = protectPII({ dob: "1980-01-01" }, pol, { hmacSecret: HSEC });
      const s = JSON.stringify(out.data);
      if (prev !== undefined) expect(s).toBe(prev);
      prev = s;
    }
  });
});
