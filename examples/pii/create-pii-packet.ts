/**
 * Run from repository root: pnpm exec tsx examples/pii/create-pii-packet.ts
 */
import { createPIIPacket, validatePrivacyPolicy, verifyIntelPacket } from "@intelpacket/pii";

const demoToken = "example-token-secret-do-not-ship";
const demoHmac = "example-hmac-secret-do-not-ship";

const policy = validatePrivacyPolicy({
  version: "v1",
  mode: "fail-closed",
  redact: ["comment"],
  tokenize: ["account_ref"],
  allow: ["account_ref", "status"],
});

const record = {
  status: "open",
  account_ref: "acct-5544",
  comment: "Customer narrative",
};

const { packet, privacy } = createPIIPacket(record, policy, {
  tokenSecret: demoToken,
  hmacSecret: demoHmac,
  packetOptions: { disableCompression: true },
});

console.log("pii_spec_version:", privacy.pii_spec_version);
console.log("spec_version:", packet.spec_version);
console.log("verifyIntelPacket:", verifyIntelPacket(packet));
