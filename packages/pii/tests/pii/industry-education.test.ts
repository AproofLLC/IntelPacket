import { describe, expect, it } from "vitest";
import { createPIIPacket, protectPII, replayPacket, validatePrivacyPolicy, verifyPrivacyResult } from "../../src/index.js";

const TOK = "i1234567890123456789012345678901";
const HMK = "j1234567890123456789012345678901";

describe("industry: education records", () => {
  it("student_id and guardian tokenized; parent email HMAC; operational login date not classified as DOB", () => {
    const policy = validatePrivacyPolicy({
      version: "v1",
      mode: "fail-closed",
      tokenize: ["student_id", "guardian_name"],
      hmac: ["parent_email"],
      allow: ["course_id", "student_id", "guardian_name", "parent_email", "last_login_at"],
    });
    const raw = {
      course_id: "BIO-101",
      student_id: "STU-501",
      guardian_name: "Jamie Guardian",
      parent_email: "jamie@district.example",
      last_login_at: "1990-01-10T15:30:00Z",
    };
    const out = protectPII(raw, policy, { tokenSecret: TOK, hmacSecret: HMK });
    expect(verifyPrivacyResult(out).ok).toBe(true);
    const s = JSON.stringify(out.data);
    expect(s.includes("jamie@district.example")).toBe(false);
    const dobNoise = out.report.fields_detected.filter((f) => f.field === "last_login_at" && f.category === "dob");
    expect(dobNoise.length).toBe(0);
    const banned = ["jamie@district.example", "Jamie Guardian", "STU-501"];
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
