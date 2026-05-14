import { describe, expect, it } from "vitest";
import {
  createPIIPacket,
  protectPII,
  replayPacket,
  validatePrivacyPolicy,
  verifyIntelPacket,
} from "../../src/index.js";

const tokenSecret = "pii-soak-token-secret-never-leak";
const hmacSecret = "pii-soak-hmac-secret-never-leak";
const policy = validatePrivacyPolicy({
  version: "v1",
  mode: "fail-closed",
  tokenize: ["email"],
  mask: ["phone"],
  hmac: ["legal_name"],
  redact: ["internal_note"],
  allow: ["id", "email", "phone", "legal_name", "internal_note", "safe"],
});

function input(i: number) {
  return {
    id: `soak-${i % 25}`,
    email: `soak${i % 25}@example.invalid`,
    phone: "555-010-8888",
    legal_name: `Soak Fake ${i % 25}`,
    internal_note: "synthetic soak note",
    safe: i % 2 === 0 ? "a" : "b",
  };
}

function assertNoLeaks(value: unknown): void {
  const json = JSON.stringify(value);
  expect(json.includes("@example.invalid")).toBe(false);
  expect(json.includes("555-010-8888")).toBe(false);
  expect(json.includes("Soak Fake")).toBe(false);
  expect(json.includes("synthetic soak note")).toBe(false);
  expect(json.includes(tokenSecret)).toBe(false);
  expect(json.includes(hmacSecret)).toBe(false);
}

describe("PII integrity soak smoke", () => {
  it("runs 1,000 protect/create/verify/replay cycles without raw or secret leaks", () => {
    const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 1_000; i++) {
      const protectedResult = protectPII(input(i), policy, { tokenSecret, hmacSecret });
      assertNoLeaks(protectedResult);
      const piiPacket = createPIIPacket(input(i), policy, {
        tokenSecret,
        hmacSecret,
        packetOptions: { createdAt: "2026-01-01T00:00:00.000Z", disableCompression: true },
      });
      assertNoLeaks(piiPacket);
      expect(verifyIntelPacket(piiPacket.packet)).toBe(true);
      assertNoLeaks(replayPacket(piiPacket.packet));
    }
    const delta = process.memoryUsage().heapUsed - before;
    console.info(`pii soak heap delta bytes: ${delta}`);
    expect(Number.isFinite(delta)).toBe(true);
  });
});
