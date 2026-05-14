import { describe, expect, it } from "vitest";
import { maskStringByKind, protectPII, validatePrivacyPolicy } from "../../src/index.js";

describe("masking", () => {
  it("phone masking", () => {
    expect(maskStringByKind("555-123-4567", "phone")).toMatch(/\*\*\*-\*\*\*-4567/);
  });

  it("email masking", () => {
    const m = maskStringByKind("john@example.com", "email");
    expect(m).toContain("@example.com");
    expect(m).toContain("*");
  });

  it("ssn masking", () => {
    const m = maskStringByKind("123-45-6789", "ssn");
    expect(m).toContain("6789");
    expect(m).toContain("*");
  });

  it("generic string masking", () => {
    expect(maskStringByKind("anything", "generic")).toBe("****");
  });

  it("nested masking via protectPII", () => {
    const out = protectPII(
      { user: { phone: "555-123-4567" } },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        mask: ["user.phone"],
        allow: ["user.phone"],
      }),
    );
    expect(((out.data as { user: { phone: string } }).user.phone).includes("*")).toBe(true);
  });

  it("array masking via wildcard", () => {
    const out = protectPII(
      { items: [{ phone: "555-111-2222" }] },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        mask: ["items[].phone"],
        allow: ["items", "items[].phone"],
      }),
    );
    expect(((out.data as { items: { phone: string }[] }).items[0].phone).includes("*")).toBe(true);
  });

  it("raw original phone does not remain after mask action", () => {
    const out = protectPII(
      { phone: "555-999-0000" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        mask: ["phone"],
        allow: ["phone"],
      }),
    );
    expect(JSON.stringify(out.data).includes("555-999")).toBe(false);
  });

  it("report lists fields_masked", () => {
    const out = protectPII(
      { phone: "555-123-4567", email: "u@example.com" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        mask: ["phone", "email"],
        allow: ["phone", "email"],
      }),
    );
    expect(out.report.fields_masked.sort()).toEqual(["email", "phone"]);
  });

  it("masking is deterministic", () => {
    const a = maskStringByKind("555-123-4567", "phone");
    const b = maskStringByKind("555-123-4567", "phone");
    expect(a).toBe(b);
  });
});
