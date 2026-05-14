import { describe, expect, it } from "vitest";
import { IntelPacketPIIError, protectPII, validatePrivacyPolicy, verifyPrivacyResult } from "../../src/index.js";

const TOK = "no-leak-token-secret-32bytes-min!!";
const HMK = "no-leak-hmac-secret-32bytes-min!!!";

describe("no raw PII or secret leakage", () => {
  const raw = "123-45-6789";
  const policy = validatePrivacyPolicy({
    version: "v1",
    mode: "fail-closed",
    redact: ["ssn"],
    allow: ["id", "ssn"],
  });

  it("reports never include raw sensitive literals", () => {
    const out = protectPII({ id: "1", ssn: raw }, policy, { tokenSecret: TOK, hmacSecret: HMK });
    expect(JSON.stringify(out.report).includes(raw)).toBe(false);
  });

  it("errors never echo raw ssn in message", () => {
    try {
      protectPII({ ssn: raw }, validatePrivacyPolicy({ version: "v1" }));
      expect.fail("expected throw");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg.includes(raw)).toBe(false);
    }
  });

  it("output JSON does not contain secrets", () => {
    const out = protectPII(
      { id: "1", mrn: "m1" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        tokenize: ["mrn"],
        allow: ["id", "mrn"],
      }),
      { tokenSecret: TOK, hmacSecret: HMK },
    );
    const blob = JSON.stringify(out);
    expect(blob.includes(TOK)).toBe(false);
    expect(blob.includes(HMK)).toBe(false);
  });

  it("no raw card or account pattern after handling", () => {
    const out = protectPII(
      {
        ledger_id: "L1",
        account_number: "0000111122223333",
        credit_card: "4111111111111111",
      },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        tokenize: ["account_number"],
        mask: ["credit_card"],
        allow: ["ledger_id", "account_number", "credit_card"],
      }),
      { tokenSecret: TOK, hmacSecret: HMK },
    );
    const s = JSON.stringify(out.data);
    expect(s.includes("0000111122223333")).toBe(false);
    expect(s.includes("4111111111111111")).toBe(false);
    expect(verifyPrivacyResult(out).ok).toBe(true);
  });

  it("missing token secret error does not echo field values", () => {
    try {
      protectPII(
        { mrn: "LEAK-THIS" },
        validatePrivacyPolicy({
          version: "v1",
          mode: "fail-closed",
          tokenize: ["mrn"],
          allow: ["mrn"],
        }),
      );
      expect.fail("expected throw");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg.includes("LEAK-THIS")).toBe(false);
      expect(e).toBeInstanceOf(IntelPacketPIIError);
    }
  });
});
