/**
 * Synthetic PII-shaped fixtures for benchmarks only (fake data).
 * Run: node benchmarks/datasets/realistic/generate-pii-fixtures.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function write(name, data) {
  writeFileSync(join(here, name), JSON.stringify(data, null, 2) + "\n", "utf8");
}

// 1. pii-api-responses.json
const piiApi = { responses: [] };
for (let i = 0; i < 40; i++) {
  piiApi.responses.push({
    request_id: `req-${i}`,
    user: {
      display_name: `Bench User ${i % 20}`,
      email: `bench.user.${i}@example.invalid`,
      phone: `555-01${String(i % 100).padStart(2, "0")}-${String(1000 + i).padStart(4, "0")}`,
    },
    billing: { last4: String(1000 + (i % 9000)).padStart(4, "0"), brand: "FAKE" },
  });
}
write("pii-api-responses.json", piiApi);

// 2. pii-user-records.json
const users = { records: [] };
for (let i = 0; i < 60; i++) {
  users.records.push({
    user_id: `usr-synth-${i}`,
    legal_name: `Synthetic Person ${i}`,
    contact_email: `person${i}@test.invalid`,
    mobile: `555-200-${String(i % 10000).padStart(4, "0")}`,
    national_id: `SYN-ID-${String(100000 + i)}`,
    address: {
      line1: `${100 + (i % 50)} Fictional Ave`,
      city: "Sampletown",
      region: "EX",
      postal: `${10000 + (i % 999)}`,
    },
  });
}
write("pii-user-records.json", users);

// 3. pii-transactions.json
const piiTx = { batch: [] };
for (let i = 0; i < 50; i++) {
  piiTx.batch.push({
    reference: `REF-${i}`,
    payer_email: `payer${i % 15}@pay.invalid`,
    cardholder: `HOLDER ${i % 10}`,
    pan_masked: `411111******${String(i % 1000).padStart(4, "0")}`,
    routing_last4: String(2000 + (i % 100)),
  });
}
write("pii-transactions.json", piiTx);

// 4. pii-audit-events.json
const piiAudit = { events: [] };
for (let i = 0; i < 70; i++) {
  piiAudit.events.push({
    id: `evt-${i}`,
    subject_email: `actor${i % 12}@corp.invalid`,
    target_user: `target-${(i * 7) % 40}@users.invalid`,
    ip: `192.0.2.${i % 250}`,
    detail: `Synthetic audit line ${i % 5} for resource /r/${i % 30}`,
  });
}
write("pii-audit-events.json", piiAudit);

// 5. pii-telemetry-users.json
const telUsers = { streams: [] };
for (let d = 0; d < 15; d++) {
  const points = [];
  for (let j = 0; j < 12; j++) {
    points.push({
      operator_id: `op-${(d + j) % 8}`,
      session_owner: `session.user.${d}@iot.invalid`,
      device_token: `dtok-synth-${d}-${j}-${(d * 17 + j) % 1000}`,
      metric: 0.5 + (j * 0.02),
    });
  }
  telUsers.streams.push({ device: `iot-dev-${d}`, points });
}
write("pii-telemetry-users.json", telUsers);

console.log("Wrote 5 PII-shaped JSON fixtures to", here);
