/**
 * Synthetic healthcare-shaped record — not real PHI.
 * Run: pnpm exec tsx examples/healthcare.ts
 * Use TOKEN_SECRET / HMAC_SECRET from your environment in production.
 */
import {
  createPIIPacket,
  protectPII,
  replayPacket,
  validatePrivacyPolicy,
  verifyPrivacyResult,
} from "../src/index.js";

const TOK = process.env.TOKEN_SECRET ?? "dev-32-byte-health-placeholder!!!";
const HMK = process.env.HMAC_SECRET ?? "dev-32-byte-health-hmac-placeholder!";

const policy = validatePrivacyPolicy({
  version: "v1",
  mode: "fail-closed",
  tokenize: ["mrn", "patient_name"],
  hmac: ["dob"],
  mask: ["phone"],
  redact: ["ssn"],
  remove: ["raw_notes"],
  allow: [
    "encounter_id",
    "heart_rate",
    "event_ts",
    "mrn",
    "patient_name",
    "dob",
    "phone",
    "ssn",
    "member_id",
  ],
});

const raw = {
  encounter_id: "enc-syn-001",
  heart_rate: 88,
  event_ts: "2026-05-13T14:00:00Z",
  mrn: "MRN-SYN-9001",
  patient_name: "Synthetic Patient",
  dob: "1972-06-01",
  phone: "555-0199",
  ssn: "123-45-6789",
  member_id: "INS-M-771",
  raw_notes: "Synthetic free-text — never pass raw downstream.",
};

const out = protectPII(raw, policy, { tokenSecret: TOK, hmacSecret: HMK });
const safeJson = JSON.stringify(out.data);
if (safeJson.includes("123-45-6789")) {
  throw new Error("unexpected raw SSN in output");
}

console.log("safe_data_keys:", Object.keys(out.data as object).sort());
console.log("report:", {
  safe_for_packetization: out.report.safe_for_packetization,
  redacted: out.report.fields_redacted,
  tokenized: out.report.fields_tokenized,
});
console.log("verify:", verifyPrivacyResult(out));

const { packet } = createPIIPacket(raw, policy, {
  tokenSecret: TOK,
  hmacSecret: HMK,
  packetOptions: { disableCompression: true, createdAt: "2026-01-01T00:00:00.000Z" },
});
const replayed = replayPacket(packet, { disableCompression: true });
console.log("replay_includes_raw_ssn:", JSON.stringify(replayed.expanded).includes("123-45-6789"));
