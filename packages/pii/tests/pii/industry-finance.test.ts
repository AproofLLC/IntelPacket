import { describe, expect, it } from "vitest";
import { createPIIPacket, protectPII, replayPacket, validatePrivacyPolicy, verifyPrivacyResult } from "../../src/index.js";

const TOK = "c1234567890123456789012345678901";
const HMK = "d1234567890123456789012345678901";

describe("industry: finance-shaped payloads", () => {
  const policy = validatePrivacyPolicy({
    version: "v1",
    mode: "fail-closed",
    tokenize: ["account_number", "email"],
    hmac: ["routing_number"],
    mask: ["credit_card"],
    allow: ["ledger_id", "status", "account_number", "routing_number", "credit_card", "email"],
  });

  const banned = ["0009988776655443", "4111111111111111", "021000021", "client@bank.example"];

  it("tokenizes account, HMACs routing, masks card, tokenizes email; no raw finance patterns remain", () => {
    const raw = {
      ledger_id: "led-1",
      status: "posted",
      account_number: "0009988776655443",
      routing_number: "021000021",
      credit_card: "4111111111111111",
      email: "client@bank.example",
    };
    const out = protectPII(raw, policy, { tokenSecret: TOK, hmacSecret: HMK });
    expect(verifyPrivacyResult(out).ok).toBe(true);
    for (const b of banned) {
      expect(JSON.stringify(out.data).includes(b)).toBe(false);
      expect(JSON.stringify(out.report).includes(b)).toBe(false);
    }
    const { packet, privacy } = createPIIPacket(raw, policy, {
      tokenSecret: TOK,
      hmacSecret: HMK,
      packetOptions: { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" },
    });
    const expanded = replayPacket(packet, { disableCompression: true }).expanded;
    for (const b of banned) {
      expect(JSON.stringify(expanded).includes(b)).toBe(false);
      expect(JSON.stringify(privacy).includes(b)).toBe(false);
      expect(JSON.stringify(packet).includes(b)).toBe(false);
    }
  });
});
