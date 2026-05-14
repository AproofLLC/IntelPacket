import { performance } from "node:perf_hooks";
import {
  createPIIPacket,
  detectPII,
  protectPII,
  validatePrivacyPolicy,
  verifyPrivacyResult,
} from "../src/index.js";

const TOK = "bench-token-secret-32bytes-minimum!!";
const HMK = "bench-hmac-secret-32bytes-minimum!!!";

function healthcareRow(i: number) {
  return {
    encounter_id: `e-${i}`,
    mrn: `MRN-${i}`,
    dob: "1980-01-01",
    phone: `555-200-${String(1000 + (i % 9000)).padStart(4, "0")}`,
    ssn: "123-45-6789",
  };
}

function financeRow(i: number) {
  return {
    ledger_id: `led-${i}`,
    account_number: `${1000000000000000 + i}`,
    routing_number: "021000021",
    credit_card: "4111111111111111",
    email: `user${i}@finance.example`,
  };
}

function hrRow(i: number) {
  return {
    department: "ENG",
    employee_id: `E-${i}`,
    payroll_id: `PR-${i}`,
    emergency_contact: `555-300-${String(i % 10000).padStart(4, "0")}`,
  };
}

function saasRow(i: number) {
  return {
    user_id: `u-${i}`,
    email: `u${i}@saas.example`,
    phone: `555-400-${String(i % 10000).padStart(4, "0")}`,
    full_name: `User ${i}`,
    mailing_address: `${i} Main St`,
  };
}

function educationRow(i: number) {
  return {
    course_id: `C-${i}`,
    student_id: `STU-${i}`,
    guardian_name: `Guardian ${i}`,
    parent_email: `p${i}@edu.example`,
    last_login_at: "2026-01-01T12:00:00Z",
  };
}

function legalRow(i: number) {
  return {
    matter_id: `M-${i}`,
    client_name: `Client ${i}`,
    case_number: `LF-${i}`,
    participant_phone: `555-500-${String(i % 10000).padStart(4, "0")}`,
  };
}

const policies = {
  healthcare: validatePrivacyPolicy({
    version: "v1",
    mode: "fail-closed",
    tokenize: ["mrn"],
    hmac: ["dob"],
    mask: ["phone"],
    redact: ["ssn"],
    allow: ["encounter_id", "mrn", "dob", "phone", "ssn"],
  }),
  finance: validatePrivacyPolicy({
    version: "v1",
    mode: "fail-closed",
    tokenize: ["account_number", "email"],
    hmac: ["routing_number"],
    mask: ["credit_card"],
    allow: ["ledger_id", "account_number", "routing_number", "credit_card", "email"],
  }),
  hr: validatePrivacyPolicy({
    version: "v1",
    mode: "fail-closed",
    tokenize: ["employee_id"],
    hmac: ["payroll_id"],
    mask: ["emergency_contact"],
    allow: ["department", "employee_id", "payroll_id", "emergency_contact"],
  }),
  saas: validatePrivacyPolicy({
    version: "v1",
    mode: "fail-closed",
    tokenize: ["email", "full_name"],
    mask: ["phone"],
    remove: ["mailing_address"],
    allow: ["user_id", "email", "phone", "full_name"],
  }),
  education: validatePrivacyPolicy({
    version: "v1",
    mode: "fail-closed",
    tokenize: ["student_id", "guardian_name"],
    hmac: ["parent_email"],
    allow: ["course_id", "student_id", "guardian_name", "parent_email", "last_login_at"],
  }),
  legal: validatePrivacyPolicy({
    version: "v1",
    mode: "fail-closed",
    tokenize: ["client_name", "case_number"],
    mask: ["participant_phone"],
    allow: ["matter_id", "client_name", "case_number", "participant_phone"],
  }),
} as const;

type Industry = keyof typeof policies;

function buildBatch(industry: Industry, n: number): unknown[] {
  const fns = {
    healthcare: healthcareRow,
    finance: financeRow,
    hr: hrRow,
    saas: saasRow,
    education: educationRow,
    legal: legalRow,
  };
  const fn = fns[industry];
  return Array.from({ length: n }, (_, i) => fn(i));
}

function benchIndustry(industry: Industry, count: number): void {
  const rows = buildBatch(industry, count);
  const policy = policies[industry];
  const detectOpts =
    industry === "legal" ? { sensitiveFieldNames: { case_number: "legal_case_ref" as const } } : undefined;

  const t0 = performance.now();
  for (const row of rows) {
    detectPII(row, detectOpts);
  }
  const detMs = performance.now() - t0;

  const t1 = performance.now();
  const protectedRows: ReturnType<typeof protectPII>[] = [];
  for (const row of rows) {
    protectedRows.push(
      protectPII(row, policy, {
        tokenSecret: TOK,
        hmacSecret: HMK,
        detectOptions: detectOpts,
      }),
    );
  }
  const protMs = performance.now() - t1;

  const t2 = performance.now();
  for (let i = 0; i < rows.length; i++) {
    createPIIPacket(rows[i], policy, {
      tokenSecret: TOK,
      hmacSecret: HMK,
      detectOptions: detectOpts,
      packetOptions: { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" },
    });
  }
  const packMs = performance.now() - t2;

  let verifyOk = 0;
  for (const pr of protectedRows) {
    if (verifyPrivacyResult(pr).ok) verifyOk++;
  }

  const totalSec = (detMs + protMs + packMs) / 1000;
  const rps = totalSec > 0 ? count / totalSec : 0;

  console.log(`=== ${industry} × ${count} records ===`);
  console.log(`detect ms (total):   ${detMs.toFixed(2)}`);
  console.log(`protectPII ms:       ${protMs.toFixed(2)}`);
  console.log(`createPIIPacket ms:  ${packMs.toFixed(2)}`);
  console.log(`verifyPrivacy OK:    ${verifyOk} / ${count}`);
  console.log(`approx records/sec:  ${rps.toFixed(1)} (combined pipeline wall)`);
  console.log("");
}

console.log("IntelPacketPII multi-industry benchmark (100 records each)\n");

const industries: Industry[] = ["healthcare", "finance", "hr", "saas", "education", "legal"];
for (const ind of industries) {
  benchIndustry(ind, 100);
}

console.log("Done.\n");
