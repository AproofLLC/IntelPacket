/**
 * Run from repository root: pnpm exec tsx examples/pii/tokenize.ts
 *
 * Uses fixed demo secrets for local illustration only — use managed secrets in production.
 */
import { protectPII, validatePrivacyPolicy } from "@intelpacket/pii";

const demoSecret = "example-token-secret-do-not-ship";

const policy = validatePrivacyPolicy({
  version: "v1",
  mode: "fail-closed",
  tokenize: ["external_id"],
  allow: ["external_id", "label"],
});

const input = { label: "invoice", external_id: "partner-991" };

const a = protectPII(input, policy, { tokenSecret: demoSecret });
const b = protectPII(input, policy, { tokenSecret: demoSecret });

console.log(
  "deterministic tokens:",
  JSON.stringify(a.data) === JSON.stringify(b.data),
  JSON.stringify(a.data),
);
