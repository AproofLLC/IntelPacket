import { describe, expect, it } from "vitest";
import {
  createPIIPacket,
  protectPII,
  replayPacket,
  validatePrivacyPolicy,
  verifyPrivacyResult,
} from "../../src/index.js";

const TOK = "m1234567890123456789012345678901";
const HMK = "n1234567890123456789012345678901";

describe("industry payloads 50× stability", () => {
  const healthcare = validatePrivacyPolicy({
    version: "v1",
    mode: "fail-closed",
    tokenize: ["mrn"],
    hmac: ["dob"],
    mask: ["phone"],
    redact: ["ssn"],
    allow: ["encounter_id", "mrn", "dob", "phone", "ssn"],
  });

  const finance = validatePrivacyPolicy({
    version: "v1",
    mode: "fail-closed",
    tokenize: ["account_number", "email"],
    hmac: ["routing_number"],
    mask: ["credit_card"],
    allow: ["ledger_id", "account_number", "routing_number", "credit_card", "email"],
  });

  const hr = validatePrivacyPolicy({
    version: "v1",
    mode: "fail-closed",
    tokenize: ["employee_id"],
    hmac: ["payroll_id"],
    mask: ["emergency_contact"],
    allow: ["department", "employee_id", "payroll_id", "emergency_contact"],
  });

  const saas = validatePrivacyPolicy({
    version: "v1",
    mode: "fail-closed",
    tokenize: ["email", "full_name"],
    mask: ["phone"],
    remove: ["mailing_address"],
    allow: ["user_id", "email", "phone", "full_name"],
  });

  const education = validatePrivacyPolicy({
    version: "v1",
    mode: "fail-closed",
    tokenize: ["student_id", "guardian_name"],
    hmac: ["parent_email"],
    allow: ["course_id", "student_id", "guardian_name", "parent_email", "last_login_at"],
  });

  const legal = validatePrivacyPolicy({
    version: "v1",
    mode: "fail-closed",
    tokenize: ["client_name", "case_number"],
    mask: ["participant_phone"],
    allow: ["matter_id", "client_name", "case_number", "participant_phone"],
  });

  const government = validatePrivacyPolicy({
    version: "v1",
    mode: "fail-closed",
    tokenize: ["national_id"],
    hmac: ["tax_id"],
    mask: ["citizen_phone"],
    redact: ["ssn"],
    allow: ["record_id", "national_id", "tax_id", "citizen_phone", "ssn"],
  });

  const cases: {
    name: string;
    policy: ReturnType<typeof validatePrivacyPolicy>;
    raw: object;
    banned: string[];
    detectOptions?: { sensitiveFieldNames: Record<string, string> };
  }[] = [
    {
      name: "healthcare",
      policy: healthcare,
      raw: {
        encounter_id: "e1",
        mrn: "MRN-50",
        dob: "1982-01-01",
        phone: "555-111-2222",
        ssn: "123-45-6789",
      },
      banned: ["123-45-6789", "555-111-2222"],
    },
    {
      name: "finance",
      policy: finance,
      raw: {
        ledger_id: "l1",
        account_number: "0099887766554433",
        routing_number: "021000021",
        credit_card: "4111111111111111",
        email: "c@example.com",
      },
      banned: ["0099887766554433", "4111111111111111", "021000021", "c@example.com"],
    },
    {
      name: "hr",
      policy: hr,
      raw: {
        department: "Eng",
        employee_id: "E-50",
        payroll_id: "PR-50",
        emergency_contact: "555-999-0000",
      },
      banned: ["555-999-0000", "E-50", "PR-50"],
    },
    {
      name: "saas",
      policy: saas,
      raw: {
        user_id: "u50",
        email: "u@example.com",
        phone: "555-444-3333",
        full_name: "Fifty User",
        mailing_address: "Hidden St",
      },
      banned: ["u@example.com", "555-444-3333", "Fifty", "Hidden"],
    },
    {
      name: "education",
      policy: education,
      raw: {
        course_id: "C50",
        student_id: "STU-50",
        guardian_name: "Guard Fifty",
        parent_email: "p@school.test",
        last_login_at: "2026-02-02T12:00:00Z",
      },
      banned: ["Guard", "p@school.test"],
    },
    {
      name: "legal",
      policy: legal,
      raw: {
        matter_id: "M-50",
        client_name: "Client Fifty LLC",
        case_number: "LF-5050",
        participant_phone: "555-3030",
      },
      banned: ["Client Fifty", "LF-5050", "555-3030"],
      detectOptions: { sensitiveFieldNames: { case_number: "legal_case_ref" } },
    },
    {
      name: "government",
      policy: government,
      raw: {
        record_id: "GR-50",
        national_id: "NAT-5050",
        tax_id: "12-3456789",
        citizen_phone: "555-6060",
        ssn: "123-45-6789",
      },
      banned: ["NAT-5050", "12-3456789", "555-6060", "123-45-6789"],
    },
  ];

  for (const c of cases) {
    it(`50× stable for ${c.name}`, () => {
      let prev: string | undefined;
      const rawFixture = structuredClone(c.raw);
      for (let i = 0; i < 50; i++) {
        const raw = structuredClone(rawFixture);
        expect(raw).toEqual(rawFixture);
        const out = protectPII(raw, c.policy, {
          tokenSecret: TOK,
          hmacSecret: HMK,
          detectOptions: c.detectOptions,
        });
        expect(verifyPrivacyResult(out).ok).toBe(true);
        const s = JSON.stringify(out.data);
        for (const b of c.banned) {
          expect(s.includes(b)).toBe(false);
        }
        if (prev !== undefined) expect(s).toBe(prev);
        prev = s;

        const { packet } = createPIIPacket(structuredClone(c.raw), c.policy, {
          tokenSecret: TOK,
          hmacSecret: HMK,
          detectOptions: c.detectOptions,
          packetOptions: { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" },
        });
        const replayed = replayPacket(packet, { disableCompression: true }).expanded;
        const rs = JSON.stringify(replayed);
        for (const b of c.banned) {
          expect(rs.includes(b)).toBe(false);
        }
      }
    });
  }
});
