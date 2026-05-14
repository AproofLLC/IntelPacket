/**
 * Synthetic education record — not real student data.
 * Run: pnpm exec tsx examples/education.ts
 */
import { protectPII, validatePrivacyPolicy, verifyPrivacyResult } from "@intelpacket/pii";

const TOK = process.env.TOKEN_SECRET ?? "dev-32-byte-edu-placeholder-key!!!";
const HMK = process.env.HMAC_SECRET ?? "dev-32-byte-edu-hmac-placeholder!!!";

const policy = validatePrivacyPolicy({
  version: "v1",
  mode: "fail-closed",
  tokenize: ["student_id", "guardian_name"],
  hmac: ["parent_email"],
  allow: ["course_id", "student_id", "guardian_name", "parent_email", "last_login_at"],
});

const raw = {
  course_id: "CS-501",
  student_id: "STU-77821",
  guardian_name: "Taylor Guardian",
  parent_email: "parent@school.example",
  last_login_at: "1990-01-15T08:00:00Z",
};

const out = protectPII(raw, policy, { tokenSecret: TOK, hmacSecret: HMK });
const s = JSON.stringify(out.data);
if (s.includes("parent@school.example") || s.includes("Taylor Guardian")) {
  throw new Error("unexpected raw education PII");
}
console.log("safe:", out.data);
console.log("verify:", verifyPrivacyResult(out));
