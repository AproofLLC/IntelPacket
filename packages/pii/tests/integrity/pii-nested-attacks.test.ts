import { describe, expect, it } from "vitest";
import { protectPII, validatePrivacyPolicy } from "../../src/index.js";

const tokenSecret = "nested-token-secret-never-leak";
const hmacSecret = "nested-hmac-secret-never-leak";

describe("PII integrity nested attacks", () => {
  it("transforms policy-covered PII hidden in nested arrays", () => {
    const input = { groups: [{ members: [{ email: "nested.user@example.invalid", phone: "555-010-2222" }] }] };
    const policy = validatePrivacyPolicy({
      version: "v1",
      mode: "fail-closed",
      tokenize: ["groups[].members[].email"],
      mask: ["groups[].members[].phone"],
      allow: ["groups[].members[].email", "groups[].members[].phone"],
    });
    const out = protectPII(input, policy, { tokenSecret, hmacSecret });
    const json = JSON.stringify(out);
    expect(json.includes("nested.user@example.invalid")).toBe(false);
    expect(json.includes("555-010-2222")).toBe(false);
    expect(out.report.safe_for_packetization).toBe(true);
  });

  it("documents that object-key content is not a hard guarantee; policy-covered values are", () => {
    const input = { "key.user@example.invalid": "safe-value", email: "value.user@example.invalid" };
    const policy = validatePrivacyPolicy({
      version: "v1",
      mode: "permissive",
      tokenize: ["email"],
    });
    const out = protectPII(input, policy, { tokenSecret });
    const json = JSON.stringify(out.data);
    expect(json.includes("value.user@example.invalid")).toBe(false);
    expect(json.includes("key.user@example.invalid")).toBe(true);
  });

  it("protects mixed case field names when policy paths match exactly", () => {
    const input = { Email: "mixed.case@example.invalid", LegalName: "Mixed Case User" };
    const policy = validatePrivacyPolicy({
      version: "v1",
      mode: "fail-closed",
      tokenize: ["Email"],
      hmac: ["LegalName"],
      allow: ["Email", "LegalName"],
    });
    const out = protectPII(input, policy, { tokenSecret, hmacSecret });
    const json = JSON.stringify(out);
    expect(json.includes("mixed.case@example.invalid")).toBe(false);
    expect(json.includes("Mixed Case User")).toBe(false);
  });

  it("does not claim detection perfection for encoded-looking emails but protects explicit policy fields", () => {
    const input = { contact: "encoded user [at] example [dot] invalid", email: "plain.user@example.invalid" };
    const policy = validatePrivacyPolicy({
      version: "v1",
      mode: "permissive",
      tokenize: ["email"],
    });
    const out = protectPII(input, policy, { tokenSecret });
    const json = JSON.stringify(out.data);
    expect(json.includes("plain.user@example.invalid")).toBe(false);
    expect(json.includes("encoded user [at] example [dot] invalid")).toBe(true);
  });

  it("handles repeated nested sensitive fields and a large nested payload within limits", () => {
    const input = {
      batches: Array.from({ length: 100 }, (_v, i) => ({
        email: `fake${i}@example.invalid`,
        legal_name: `Nested Fake ${i}`,
      })),
    };
    const policy = validatePrivacyPolicy({
      version: "v1",
      mode: "fail-closed",
      tokenize: ["batches[].email"],
      hmac: ["batches[].legal_name"],
      allow: ["batches[].email", "batches[].legal_name"],
    });
    const out = protectPII(input, policy, { tokenSecret, hmacSecret });
    const json = JSON.stringify(out);
    expect(json.includes("@example.invalid")).toBe(false);
    expect(json.includes("Nested Fake 42")).toBe(false);
    expect(out.report.safe_for_packetization).toBe(true);
  });
});
