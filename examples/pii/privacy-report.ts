/**
 * Run from repository root: pnpm exec tsx examples/pii/privacy-report.ts
 */
import { createPrivacyReport, validatePrivacyPolicy } from "@intelpacket/pii";

const policy = validatePrivacyPolicy({
  version: "v1",
  mode: "permissive",
  allow: ["email", "status"],
});

const input = { status: "active", email: "user@example.com" };
const transformed = { status: "active", email: "[REDACTED]" };

const report = createPrivacyReport(input, transformed, policy);
console.log("pii_spec_version:", report.pii_spec_version);
console.log("fields_redacted:", report.fields_redacted);
