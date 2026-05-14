import { describe, expect, it } from "vitest";
import {
  createPIIPacket,
  protectPII,
  replayPacket,
  validatePrivacyPolicy,
  verifyIntelPacket,
} from "../../src/index.js";

const tokenSecret = "test-token-secret-never-leak-leak-matrix";
const hmacSecret = "test-hmac-secret-never-leak-leak-matrix";
const protectedValues = [
  "123-45-6789",
  "synthetic internal note",
  "555-010-1234",
  "user.one@example.invalid",
  "acct_fake_001",
  "Fake Legal One",
];

function expectNoLeaks(value: unknown): void {
  const blob = JSON.stringify(value);
  for (const raw of protectedValues) expect(blob.includes(raw)).toBe(false);
  expect(blob.includes(tokenSecret)).toBe(false);
  expect(blob.includes(hmacSecret)).toBe(false);
}

describe("PII integrity leak matrix", () => {
  const policy = validatePrivacyPolicy({
    version: "v1",
    mode: "fail-closed",
    redact: ["ssn", "internal_note", "profile.ssn", "events[].internal_note"],
    mask: ["phone", "profile.phone", "contacts[].phone"],
    tokenize: ["email", "account_id", "profile.email", "contacts[].email", "events[].account_id"],
    hmac: ["legal_name", "profile.legal_name", "contacts[].legal_name"],
    allow: [
      "id",
      "safe",
      "ssn",
      "internal_note",
      "phone",
      "email",
      "account_id",
      "legal_name",
      "profile.ssn",
      "profile.phone",
      "profile.email",
      "profile.legal_name",
      "contacts[].phone",
      "contacts[].email",
      "contacts[].legal_name",
      "events[].internal_note",
      "events[].account_id",
    ],
  });

  it.each([
    ["top-level fields", { id: "1", ssn: "123-45-6789", internal_note: "synthetic internal note", phone: "555-010-1234", email: "user.one@example.invalid", account_id: "acct_fake_001", legal_name: "Fake Legal One" }],
    ["nested objects", { id: "2", profile: { ssn: "123-45-6789", phone: "555-010-1234", email: "user.one@example.invalid", legal_name: "Fake Legal One" } }],
    ["arrays", { id: "3", contacts: [{ phone: "555-010-1234", email: "user.one@example.invalid", legal_name: "Fake Legal One" }] }],
    ["deeply nested objects", { id: "4", profile: { ssn: "123-45-6789", email: "user.one@example.invalid", phone: "555-010-1234", legal_name: "Fake Legal One" } }],
    ["repeated fields", { id: "5", contacts: [{ email: "user.one@example.invalid", phone: "555-010-1234", legal_name: "Fake Legal One" }, { email: "user.one@example.invalid", phone: "555-010-1234", legal_name: "Fake Legal One" }] }],
    ["mixed safe and sensitive", { id: "6", safe: "public", events: [{ internal_note: "synthetic internal note", account_id: "acct_fake_001" }] }],
  ])("protects %s", (_name, input) => {
    const protectedResult = protectPII(input, policy, { tokenSecret, hmacSecret });
    expect(protectedResult.report.safe_for_packetization).toBe(true);
    expectNoLeaks(protectedResult);

    const piiPacket = createPIIPacket(input, policy, {
      tokenSecret,
      hmacSecret,
      packetOptions: { createdAt: "2026-01-01T00:00:00.000Z", disableCompression: true },
    });
    expect(verifyIntelPacket(piiPacket.packet)).toBe(true);
    expectNoLeaks(piiPacket);
    expectNoLeaks(replayPacket(piiPacket.packet));
  });
});
