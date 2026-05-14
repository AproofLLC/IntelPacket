/**
 * Synthetic HR record — not real employee data.
 * Run: pnpm exec tsx examples/hr.ts
 */
import { protectPII, validatePrivacyPolicy, verifyPrivacyResult } from "@intelpacket/pii";

const TOK = process.env.TOKEN_SECRET ?? "dev-32-byte-hr-placeholder-key!!!";
const HMK = process.env.HMAC_SECRET ?? "dev-32-byte-hr-hmac-placeholder-key!";

const policy = validatePrivacyPolicy({
  version: "v1",
  mode: "fail-closed",
  tokenize: ["employee_id"],
  hmac: ["payroll_id"],
  mask: ["emergency_contact"],
  allow: ["department", "employee_id", "payroll_id", "emergency_contact"],
  deny: ["free_text_review"],
});

const raw = {
  department: "Engineering",
  employee_id: "E-44001",
  payroll_id: "PR-882199",
  emergency_contact: "555-0142",
  free_text_review: "Synthetic manager comment",
};

const out = protectPII(raw, policy, {
  tokenSecret: TOK,
  hmacSecret: HMK,
});

console.log("safe:", out.data);
console.log("verify:", verifyPrivacyResult(out));

const salaryPolicy = validatePrivacyPolicy({
  version: "v1",
  mode: "fail-closed",
  hmac: ["salary"],
  allow: ["role", "salary"],
});
const salaryOut = protectPII(
  { role: "IC4", salary: "142500" },
  salaryPolicy,
  {
    hmacSecret: HMK,
    detectOptions: { sensitiveFieldNames: { salary: "compensation" } },
  },
);
console.log("salary_when_configured:", salaryOut.data);
console.log("salary_verify:", verifyPrivacyResult(salaryOut));
