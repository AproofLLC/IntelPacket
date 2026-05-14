/**
 * Synthetic finance record — not real account data.
 * Run: pnpm exec tsx examples/finance.ts
 */
import { createPIIPacket, protectPII, validatePrivacyPolicy, verifyPrivacyResult } from "@intelpacket/pii";

const TOK = process.env.TOKEN_SECRET ?? "dev-32-byte-finance-placeholder!!";
const HMK = process.env.HMAC_SECRET ?? "dev-32-byte-finance-hmac-placeholder";

const policy = validatePrivacyPolicy({
  version: "v1",
  mode: "fail-closed",
  tokenize: ["account_number", "email"],
  hmac: ["routing_number"],
  mask: ["credit_card"],
  allow: ["ledger_id", "status", "account_number", "routing_number", "credit_card", "email"],
});

const raw = {
  ledger_id: "led-syn-22",
  status: "posted",
  account_number: "0009988776655",
  routing_number: "021000021",
  credit_card: "4111111111111111",
  email: "holder@example.com",
};

const out = protectPII(raw, policy, { tokenSecret: TOK, hmacSecret: HMK });
const serialized = JSON.stringify(out.data);
for (const forbidden of ["0009988776655", "4111111111111111", "021000021", "holder@example.com"]) {
  if (serialized.includes(forbidden)) {
    throw new Error("raw finance PII leaked in output");
  }
}

console.log("safe:", out.data);
console.log("report_summary:", {
  transforms: out.report.transform_count,
  safe: out.report.safe_for_packetization,
});
console.log("verify:", verifyPrivacyResult(out));

createPIIPacket(raw, policy, {
  tokenSecret: TOK,
  hmacSecret: HMK,
  packetOptions: { disableCompression: true },
});
console.log("createPIIPacket: ok");
