/**
 * Run from repository root: pnpm exec tsx examples/pii/redact.ts
 */
import { protectPII, validatePrivacyPolicy } from "@intelpacket/pii";

const policy = validatePrivacyPolicy({
  version: "v1",
  mode: "permissive",
  redact: ["internal_note"],
  allow: ["record_id"],
});

const input = {
  record_id: "rec-1",
  internal_note: "Operator comment",
};

const out = protectPII(input, policy, {});
console.log("transformed:", JSON.stringify(out.data, null, 2));
console.log("safe_for_packetization:", out.report.safe_for_packetization);
