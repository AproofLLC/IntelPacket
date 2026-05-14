import { describe, expect, it } from "vitest";
import { protectPII, validatePrivacyPolicy } from "../../src/index.js";

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

describe("PII integrity policy fuzzing", () => {
  it("accepts deterministic valid policy paths", () => {
    const rnd = mulberry32(1234);
    const fields = ["email", "phone", "ssn", "account_id", "legal_name"];
    for (let i = 0; i < 150; i++) {
      const field = fields[Math.floor(rnd() * fields.length)]!;
      const prefix = rnd() < 0.5 ? "users[]." : "";
      const path = `${prefix}${field}`;
      const policy = validatePrivacyPolicy({
        version: "v1",
        mode: "permissive",
        redact: field === "ssn" ? [path] : [],
        mask: field === "phone" ? [path] : [],
        tokenize: field === "email" || field === "account_id" ? [path] : [],
        hmac: field === "legal_name" ? [path] : [],
        allow: [path],
      });
      expect(policy.version).toBe("v1");
    }
  });

  it.each([
    ["empty path", { redact: [""] }],
    ["unsafe __proto__ path", { redact: ["profile.__proto__.ssn"] }],
    ["unsafe constructor path", { mask: ["constructor.phone"] }],
    ["unsafe prototype path", { tokenize: ["users[].prototype.email"] }],
    ["conflicting action path", { redact: ["ssn"], mask: ["ssn"] }],
    ["malformed array path", { redact: ["users[0].ssn"] }],
    ["unknown version", { version: "v2" }],
    ["unknown field type", { redact: [123] }],
  ])("fails closed for %s", (_name, patch) => {
    expect(() => validatePrivacyPolicy({ version: "v1", mode: "fail-closed", ...patch })).toThrow();
  });

  it("does not crash or hang on deeply nested valid paths", () => {
    const path = Array.from({ length: 40 }, (_, i) => `layer${i}`).join(".") + ".email";
    const policy = validatePrivacyPolicy({ version: "v1", mode: "permissive", tokenize: [path], allow: [path] });
    const result = protectPII({}, policy, { tokenSecret: "policy-fuzz-token-secret" });
    expect(result.report.safe_for_packetization).toBe(true);
  });
});
