import { describe, expect, it } from "vitest";
import {
  createPIIPacket,
  protectPII,
  replayPacket,
  validatePrivacyPolicy,
  verifyIntelPacket,
} from "../../src/index.js";

const tokenSecret = "pii-concurrency-token-secret-never-leak";
const hmacSecret = "pii-concurrency-hmac-secret-never-leak";
const policy = validatePrivacyPolicy({
  version: "v1",
  mode: "fail-closed",
  tokenize: ["email", "account_id"],
  mask: ["phone"],
  hmac: ["legal_name"],
  allow: ["id", "email", "account_id", "phone", "legal_name", "safe"],
});

function record(i: number) {
  return {
    id: `id-${i % 10}`,
    email: `worker${i % 10}@example.invalid`,
    account_id: `acct_${i % 10}`,
    phone: "555-010-7777",
    legal_name: `Worker Fake ${i % 10}`,
    safe: "ok",
  };
}

function assertNoLeaks(value: unknown): void {
  const json = JSON.stringify(value);
  expect(json.includes("@example.invalid")).toBe(false);
  expect(json.includes("555-010-7777")).toBe(false);
  expect(json.includes("Worker Fake")).toBe(false);
  expect(json.includes(tokenSecret)).toBe(false);
  expect(json.includes(hmacSecret)).toBe(false);
}

describe("PII integrity concurrency", () => {
  it("runs concurrent protectPII and createPIIPacket operations deterministically", async () => {
    const protectedResults = await Promise.all(
      Array.from({ length: 250 }, async (_v, i) => protectPII(record(i), policy, { tokenSecret, hmacSecret })),
    );
    protectedResults.forEach(assertNoLeaks);

    const packets = await Promise.all(
      Array.from({ length: 250 }, async (_v, i) =>
        createPIIPacket(record(i), policy, {
          tokenSecret,
          hmacSecret,
          packetOptions: { createdAt: "2026-01-01T00:00:00.000Z", disableCompression: true },
        }),
      ),
    );
    packets.forEach((p) => {
      assertNoLeaks(p);
      expect(verifyIntelPacket(p.packet)).toBe(true);
      expect(() => replayPacket(p.packet)).not.toThrow();
    });

    const firstHash = packets[0]!.packet.packet_hash;
    const sameInputHashes = packets.filter((_p, i) => i % 10 === 0).map((p) => p.packet.packet_hash);
    expect(new Set(sameInputHashes)).toEqual(new Set([firstHash]));
  });
});
