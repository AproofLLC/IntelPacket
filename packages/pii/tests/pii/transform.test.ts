import { describe, expect, it } from "vitest";
import {
  IntelPacketPIIError,
  createPIIPacket,
  protectPII,
  validatePrivacyPolicy,
  verifyPrivacyResult,
} from "../../src/index.js";

const TOK = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HMK = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("protectPII transform", () => {
  it("returns { data, report }", () => {
    const raw = { ssn: "123-45-6789", encounter_id: "e1" };
    const out = protectPII(raw, {
      version: "v1",
      mode: "fail-closed",
      redact: ["ssn"],
      allow: ["encounter_id", "ssn"],
    });
    expect(out.data).toBeDefined();
    expect(out.report.policy_version).toBe("v1");
    expect(verifyPrivacyResult(out).ok).toBe(true);
  });

  it("mixed policy: redact, mask, tokenize, hmac, remove", () => {
    const out = protectPII(
      {
        ssn: "123-45-6789",
        phone: "555-123-4567",
        full_name: "Jane Q",
        email: "jane@example.com",
        street_address: "10 Main",
        id: "1",
      },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["ssn"],
        mask: ["phone"],
        tokenize: ["full_name"],
        hmac: ["email"],
        remove: ["street_address"],
        allow: ["id", "ssn", "phone", "full_name", "email"],
      }),
      { tokenSecret: TOK, hmacSecret: HMK },
    );
    const d = out.data as Record<string, unknown>;
    expect(d.ssn).toBe("[REDACTED]");
    expect((d.phone as string).includes("*")).toBe(true);
    expect((d.full_name as string).startsWith("tok_")).toBe(true);
    expect((d.email as string).startsWith("hmac_")).toBe(true);
    expect(d.street_address).toBeUndefined();
    const s = JSON.stringify(out.data);
    expect(s.includes("123-45")).toBe(false);
    expect(s.includes("jane@")).toBe(false);
    expect(verifyPrivacyResult(out).ok).toBe(true);
  });

  it("no input mutation", () => {
    const input = { ssn: "123-45-6789", id: "1" };
    const copy = structuredClone(input);
    protectPII(input, {
      version: "v1",
      mode: "fail-closed",
      redact: ["ssn"],
      allow: ["id", "ssn"],
    });
    expect(input).toEqual(copy);
  });

  it("transform_count reflects applied actions", () => {
    const out = protectPII(
      { ssn: "123-45-6789", phone: "555-123-4567", id: "1" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["ssn"],
        mask: ["phone"],
        allow: ["id", "ssn", "phone"],
      }),
    );
    expect(out.report.transform_count).toBe(2);
  });

  it("includePrivacyMetadata adds non-secret meta", () => {
    const out = protectPII(
      { id: "1", ssn: "123-45-6789" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["ssn"],
        allow: ["id", "ssn"],
      }),
      { includePrivacyMetadata: true, tokenSecret: TOK },
    );
    const d = out.data as Record<string, unknown>;
    const meta = d.__intelpacket_pii_meta as Record<string, unknown>;
    expect(meta.policy_version).toBe("v1");
    expect(meta.transform_count).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(meta).includes(TOK)).toBe(false);
    expect(verifyPrivacyResult({ data: d, report: out.report }).ok).toBe(true);
  });

  it("deny removes denied fields from output", () => {
    const out = protectPII(
      { raw_notes: "secret", id: "1" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        deny: ["raw_notes"],
        allow: ["id"],
      }),
    );
    expect((out.data as Record<string, unknown>).raw_notes).toBeUndefined();
    expect(out.report.denied_fields).toContain("raw_notes");
  });

  it("allowlist drops unallowed scalar fields", () => {
    const out = protectPII(
      { id: "1", noise: "x", ssn: "123-45-6789" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        redact: ["ssn"],
        allow: ["id", "ssn"],
      }),
    );
    expect((out.data as Record<string, unknown>).noise).toBeUndefined();
  });

  it("allowlist keeps transformed fields when listed", () => {
    const out = protectPII(
      { id: "1", phone: "555-123-4567" },
      validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        mask: ["phone"],
        allow: ["id", "phone"],
      }),
    );
    expect((out.data as { phone: string }).phone.includes("*")).toBe(true);
  });

  it("failOnUnhandledPII forces throw in permissive mode", () => {
    expect(() =>
      protectPII({ ssn: "123-45-6789" }, { version: "v1", mode: "permissive" }, { failOnUnhandledPII: true }),
    ).toThrow(IntelPacketPIIError);
  });
});

describe("protectPII mixed shapes — 50× stability", () => {
  const policy = validatePrivacyPolicy({
    version: "v1",
    mode: "fail-closed",
    redact: ["ssn", "patients[].ssn"],
    mask: ["phone"],
    tokenize: ["mrn", "patients[].mrn"],
    hmac: ["dob", "patients[].dob"],
    remove: ["insurance_member_id"],
    allow: [
      "patient_id",
      "heart_rate",
      "timestamp",
      "loinc",
      "value",
      "id",
      "provider_email",
      "timeline",
      "patients",
      "ssn",
      "phone",
      "mrn",
      "dob",
      "insurance_id",
      "patients[].name",
      "patients[].mrn",
      "patients[].ssn",
      "patients[].dob",
      "timeline[].ts",
      "timeline[].code",
    ],
  });

  const patientIdentity = {
    patient_id: "p-1",
    mrn: "MRN-50x",
    ssn: "123-45-6789",
    phone: "555-111-2222",
    dob: "1975-03-03",
    insurance_member_id: "should-drop",
    insurance_id: "ok-id",
  };

  const vitals = { patient_id: "p-1", heart_rate: 82, timestamp: "2026-05-01T12:00:00Z" };
  const lab = { patient_id: "p-1", loinc: "12345-6", value: "12.1" };
  const encounter = { id: "enc-1", provider_email: "nurse@clinic.test" };
  const timeline = [
    { ts: "2026-01-01T00:00:00Z", code: "A01" },
    { ts: "2026-01-02T00:00:00Z", code: "B02" },
  ];
  const nestedTimeline = { patient_id: "p-1", timeline };
  const patientsArr = {
    patients: [
      { name: "A", mrn: "m-a", ssn: "987-65-4321", dob: "1980-01-01" },
      { name: "B", mrn: "m-b", ssn: "876-54-3210", dob: "1990-02-02" },
    ],
  };

  it("repeated transforms stay stable for multiple record shapes", () => {
    const payloads = [patientIdentity, vitals, lab, encounter, nestedTimeline, patientsArr];
    for (const raw of payloads) {
      let prev: string | undefined;
      for (let i = 0; i < 50; i++) {
        const r = protectPII(structuredClone(raw), policy, { tokenSecret: TOK, hmacSecret: HMK });
        expect(verifyPrivacyResult(r).ok).toBe(true);
        const s = JSON.stringify(r.data);
        expect(s.includes("123-45-6789")).toBe(false);
        expect(s.includes("987-65-4321")).toBe(false);
        expect(s.includes("876-54-3210")).toBe(false);
        if (prev !== undefined) expect(s).toBe(prev);
        prev = s;
      }
    }
  });

  it("createPIIPacket succeeds across repeated calls for patient identity", () => {
    for (let i = 0; i < 50; i++) {
      const { packet, privacy } = createPIIPacket(structuredClone(patientIdentity), policy, {
        tokenSecret: TOK,
        hmacSecret: HMK,
        packetOptions: { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" },
      });
      expect(packet.packet_id.length).toBe(16);
      expect(privacy.safe_for_packetization).toBe(true);
    }
  });
});
