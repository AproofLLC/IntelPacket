import { describe, expect, it } from "vitest";
import { createPIIPacket, protectPII, replayPacket, validatePrivacyPolicy, verifyPrivacyResult } from "../../src/index.js";

const TOK = "e1234567890123456789012345678901";
const HMK = "f1234567890123456789012345678901";

describe("industry: HR-shaped payloads", () => {
  it("employee id tokenized, payroll HMAC, emergency contact masked", () => {
    const policy = validatePrivacyPolicy({
      version: "v1",
      mode: "fail-closed",
      tokenize: ["employee_id"],
      hmac: ["payroll_id"],
      mask: ["emergency_contact"],
      allow: ["department", "employee_id", "payroll_id", "emergency_contact"],
    });
    const raw = {
      department: "Ops",
      employee_id: "E-900",
      payroll_id: "PR-77",
      emergency_contact: "555-0101",
    };
    const out = protectPII(raw, policy, { tokenSecret: TOK, hmacSecret: HMK });
    expect(verifyPrivacyResult(out).ok).toBe(true);
    const d = out.data as Record<string, string>;
    expect(d.employee_id.startsWith("tok_")).toBe(true);
    expect(d.payroll_id.startsWith("hmac_")).toBe(true);
    expect(d.emergency_contact.includes("*")).toBe(true);
    const banned = ["E-900", "PR-77", "555-0101"];
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

  it("salary only when configured sensitive via detectOptions + policy", () => {
    const policy = validatePrivacyPolicy({
      version: "v1",
      mode: "fail-closed",
      hmac: ["salary"],
      allow: ["title", "salary"],
    });
    const raw = { title: "Analyst", salary: "95000" };
    const out = protectPII(raw, policy, {
      hmacSecret: HMK,
      detectOptions: { sensitiveFieldNames: { salary: "compensation" } },
    });
    expect((out.data as { salary: string }).salary.startsWith("hmac_")).toBe(true);
    expect(verifyPrivacyResult(out).ok).toBe(true);
    expect(JSON.stringify(out.report).includes("95000")).toBe(false);
    const { packet, privacy } = createPIIPacket(raw, policy, {
      hmacSecret: HMK,
      detectOptions: { sensitiveFieldNames: { salary: "compensation" } },
      packetOptions: { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" },
    });
    expect(JSON.stringify(replayPacket(packet, { disableCompression: true }).expanded).includes("95000")).toBe(false);
    expect(JSON.stringify(privacy).includes("95000")).toBe(false);
  });
});
