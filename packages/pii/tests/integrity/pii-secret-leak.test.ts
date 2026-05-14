import { describe, expect, it } from "vitest";
import {
  createPIIPacket,
  hmacField,
  protectPII,
  replayPacket,
  tokenizeField,
  validatePrivacyPolicy,
} from "../../src/index.js";

const tokenSecret = "test-token-secret-never-leak-secret-suite";
const hmacSecret = "test-hmac-secret-never-leak-secret-suite";
const input = {
  id: "secret-test",
  email: "secret.user@example.invalid",
  legal_name: "Secret Test User",
};
const policy = validatePrivacyPolicy({
  version: "v1",
  mode: "fail-closed",
  tokenize: ["email"],
  hmac: ["legal_name"],
  allow: ["id", "email", "legal_name"],
});

function expectNoSecretLeak(value: unknown): void {
  const json = JSON.stringify(value);
  expect(json.includes(tokenSecret)).toBe(false);
  expect(json.includes(hmacSecret)).toBe(false);
}

describe("PII integrity secret leakage", () => {
  it("does not leak token or HMAC secrets through data, report, packet, replay, or errors", () => {
    const protectedResult = protectPII(input, policy, { tokenSecret, hmacSecret });
    const packet = createPIIPacket(input, policy, {
      tokenSecret,
      hmacSecret,
      packetOptions: { createdAt: "2026-01-01T00:00:00.000Z", disableCompression: true },
    });
    expectNoSecretLeak(protectedResult.data);
    expectNoSecretLeak(protectedResult.report);
    expectNoSecretLeak(packet);
    expectNoSecretLeak(replayPacket(packet.packet));

    try {
      protectPII(input, policy, { tokenSecret });
      expect.fail("expected missing hmac secret error");
    } catch (e) {
      expectNoSecretLeak(e instanceof Error ? { message: e.message, stack: e.stack } : String(e));
    }
  });

  it("keeps deterministic token and HMAC output stable for same secret and distinct for different secrets", () => {
    expect(tokenizeField("email", input.email, tokenSecret)).toBe(tokenizeField("email", input.email, tokenSecret));
    expect(hmacField("legal_name", input.legal_name, hmacSecret)).toBe(hmacField("legal_name", input.legal_name, hmacSecret));
    expect(tokenizeField("email", input.email, tokenSecret)).not.toBe(
      tokenizeField("email", input.email, `${tokenSecret}-different`),
    );
    expect(hmacField("legal_name", input.legal_name, hmacSecret)).not.toBe(
      hmacField("legal_name", input.legal_name, `${hmacSecret}-different`),
    );
  });
});
