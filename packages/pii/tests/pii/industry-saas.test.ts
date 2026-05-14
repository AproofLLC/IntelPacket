import { describe, expect, it } from "vitest";
import { createPIIPacket, protectPII, replayPacket, validatePrivacyPolicy, verifyPrivacyResult } from "../../src/index.js";

const TOK = "g1234567890123456789012345678901";
const HMK = "h1234567890123456789012345678901";

describe("industry: SaaS user profile", () => {
  it("retains user_id when allowed; tokenizes email/name; masks phone; removes address", () => {
    const policy = validatePrivacyPolicy({
      version: "v1",
      mode: "fail-closed",
      tokenize: ["email", "full_name"],
      mask: ["phone"],
      remove: ["mailing_address"],
      allow: ["user_id", "plan", "email", "phone", "full_name"],
    });
    const raw = {
      user_id: "usr_42",
      plan: "team",
      email: "owner@saas.example",
      phone: "555-123-4567",
      full_name: "Owner User",
      mailing_address: "1 Main St",
    };
    const out = protectPII(raw, policy, { tokenSecret: TOK, hmacSecret: HMK });
    expect(verifyPrivacyResult(out).ok).toBe(true);
    const d = out.data as Record<string, unknown>;
    expect(d.user_id).toBe("usr_42");
    expect((d.email as string).startsWith("tok_")).toBe(true);
    expect((d.phone as string).includes("*")).toBe(true);
    expect(d.mailing_address).toBeUndefined();
    const banned = ["owner@saas.example", "1 Main St", "Owner User", "555-123-4567"];
    for (const b of banned) {
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
    }
  });
});
