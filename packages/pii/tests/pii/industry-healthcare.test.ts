import { describe, expect, it } from "vitest";
import { createPIIPacket, protectPII, replayPacket, validatePrivacyPolicy, verifyPrivacyResult } from "../../src/index.js";

const TOK = "a1234567890123456789012345678901";
const HMK = "b1234567890123456789012345678901";

describe("industry: healthcare-shaped payloads", () => {
  const policy = validatePrivacyPolicy({
    version: "v1",
    mode: "fail-closed",
    tokenize: ["mrn", "patient_name"],
    hmac: ["dob"],
    mask: ["phone"],
    redact: ["ssn"],
    allow: [
      "encounter_id",
      "heart_rate",
      "event_ts",
      "mrn",
      "patient_name",
      "dob",
      "phone",
      "ssn",
      "member_id",
    ],
  });

  const banned = ["123-45-6789", "555-111-2222", "Pat2", "MRN-Y"];

  it("handles MRN, DOB, patient name, insurance member id; timestamp not DOB", () => {
    const raw = {
      encounter_id: "e1",
      heart_rate: 80,
      event_ts: "1980-01-01T12:00:00Z",
      mrn: "MRN-X",
      patient_name: "Pat",
      dob: "1980-01-02",
      phone: "555-111-2222",
      ssn: "123-45-6789",
      member_id: "MEM-1",
    };
    const out = protectPII(raw, policy, { tokenSecret: TOK, hmacSecret: HMK });
    expect(out.report.safe_for_packetization).toBe(true);
    for (const b of ["123-45-6789", "555-111-2222"]) {
      expect(JSON.stringify(out.data).includes(b)).toBe(false);
      expect(JSON.stringify(out.report).includes(b)).toBe(false);
    }
    expect(verifyPrivacyResult(out).ok).toBe(true);
    const dobMatch = out.report.fields_detected.filter((f) => f.category === "dob" && f.field === "event_ts");
    expect(dobMatch.length).toBe(0);
  });

  it("createPIIPacket, replay: no raw values in data, report, or packet envelope", () => {
    const raw = {
      encounter_id: "e2",
      heart_rate: 70,
      event_ts: "2026-01-01T00:00:00Z",
      mrn: "MRN-Y",
      patient_name: "Pat2",
      dob: "1991-05-05",
      phone: "555-222-3333",
      ssn: "123-45-6789",
      member_id: "MEM-2",
    };
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
    expect(verifyPrivacyResult({ data: expanded, report: privacy }).ok).toBe(true);
  });
});
