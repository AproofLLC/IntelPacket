/**
 * Synthetic legal / matter record — not real client data.
 * Run: pnpm exec tsx examples/legal.ts
 */
import { protectPII, validatePrivacyPolicy, verifyPrivacyResult } from "@intelpacket/pii";

const TOK = process.env.TOKEN_SECRET ?? "dev-32-byte-legal-placeholder-key!";
const HMK = process.env.HMAC_SECRET ?? "dev-32-byte-legal-hmac-placeholder!";

const policy = validatePrivacyPolicy({
  version: "v1",
  mode: "fail-closed",
  tokenize: ["client_name", "case_number"],
  mask: ["participant_phone"],
  allow: ["matter_id", "client_name", "case_number", "participant_phone"],
});

const raw = {
  matter_id: "M-2044",
  client_name: "Contoso Holdings",
  case_number: "REF-009988",
  participant_phone: "555-0166",
};

const out = protectPII(raw, policy, {
  tokenSecret: TOK,
  hmacSecret: HMK,
  detectOptions: { sensitiveFieldNames: { case_number: "legal_case_ref" } },
});
const s = JSON.stringify(out.data);
if (s.includes("Contoso") || s.includes("009988") || s.includes("555-0166")) {
  throw new Error("unexpected raw legal PII");
}
console.log("safe:", out.data);
console.log("verify:", verifyPrivacyResult(out));
