/**
 * Synthetic SaaS user profile — not production data.
 * Run: pnpm exec tsx examples/saas-user.ts
 */
import { createPIIPacket, protectPII, validatePrivacyPolicy, verifyPrivacyResult } from "@intelpacket/pii";

const TOK = process.env.TOKEN_SECRET ?? "dev-32-byte-saas-placeholder-key!";
const HMK = process.env.HMAC_SECRET ?? "dev-32-byte-saas-hmac-placeholder!!";

const policy = validatePrivacyPolicy({
  version: "v1",
  mode: "fail-closed",
  tokenize: ["email", "full_name"],
  mask: ["phone"],
  remove: ["mailing_address"],
  allow: ["user_id", "plan", "email", "phone", "full_name"],
});

const raw = {
  user_id: "usr_syn_901",
  plan: "pro",
  email: "user@example.com",
  phone: "555-0177",
  full_name: "Sam Sample",
  mailing_address: "123 Synthetic Ave, Springfield",
};

const out = protectPII(raw, policy, { tokenSecret: TOK, hmacSecret: HMK });
console.log("safe:", out.data);
console.log("verify:", verifyPrivacyResult(out));

createPIIPacket(raw, policy, {
  tokenSecret: TOK,
  hmacSecret: HMK,
  packetOptions: { disableCompression: true },
});
console.log("packet: ok");
