import { describe, expect, it } from "vitest";
import { createPIIPacket, protectPII, replayPacket, validatePrivacyPolicy, verifyPrivacyResult } from "../../src/index.js";

const TOK = "k1234567890123456789012345678901";
const HMK = "l1234567890123456789012345678901";

describe("industry: legal / matter records", () => {
  it("client_name tokenized, participant phone masked, configurable case_number tokenized", () => {
    const policy = validatePrivacyPolicy({
      version: "v1",
      mode: "fail-closed",
      tokenize: ["client_name", "case_number"],
      mask: ["participant_phone"],
      allow: ["matter_id", "client_name", "case_number", "participant_phone"],
    });
    const raw = {
      matter_id: "M-88",
      client_name: "Acme Legal Client",
      case_number: "LF-0099",
      participant_phone: "555-0200",
    };
    const out = protectPII(raw, policy, {
      tokenSecret: TOK,
      hmacSecret: HMK,
      detectOptions: { sensitiveFieldNames: { case_number: "legal_case_ref" } },
    });
    const s = JSON.stringify(out.data);
    expect(s.includes("Acme")).toBe(false);
    expect(s.includes("LF-0099")).toBe(false);
    expect(s.includes("555-0200")).toBe(false);
    expect(verifyPrivacyResult(out).ok).toBe(true);
    const banned = ["Acme", "LF-0099", "555-0200"];
    for (const b of banned) {
      expect(JSON.stringify(out.report).includes(b)).toBe(false);
    }
    const { packet, privacy } = createPIIPacket(raw, policy, {
      tokenSecret: TOK,
      hmacSecret: HMK,
      detectOptions: { sensitiveFieldNames: { case_number: "legal_case_ref" } },
      packetOptions: { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" },
    });
    const expanded = replayPacket(packet, { disableCompression: true }).expanded;
    for (const b of banned) {
      expect(JSON.stringify(expanded).includes(b)).toBe(false);
      expect(JSON.stringify(privacy).includes(b)).toBe(false);
    }
  });
});
