/**
 * Regenerates deterministic JSON fixtures for benchmarks (no network).
 * Run: node benchmarks/datasets/build.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const schemaRow = { schema_ref: "api_v1", request_id: "req", method: "GET", status: 200 };

const telemetryLarge = Array.from({ length: 2500 }, (_, i) => ({
  event_type: i % 3 === 0 ? "cpu" : i % 3 === 1 ? "mem" : "io",
  device_id: `dev-${i % 80}`,
  temperature: 15 + (i % 12),
  timestamp: `2026-06-01T${String(Math.floor(i / 60) % 24).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00.000Z`,
}));

const apiEvents = Array.from({ length: 800 }, (_, i) => ({
  ...schemaRow,
  request_id: `req-${i}`,
  path: i % 2 === 0 ? "/v1/items" : "/v1/users",
  duration_ms: 5 + (i % 120),
  timestamp: `2026-06-02T10:${String(i % 60).padStart(2, "0")}:00.000Z`,
}));

const txnTemplate = { currency: "USD", schema_ref: "txn_v2" };
const repeatedTransactions = Array.from({ length: 600 }, (_, i) => ({
  amount: 10 + (i % 50),
  user_id: `u-${i % 40}`,
  ...txnTemplate,
}));

const nestedStateSnapshots = {
  config: {
    schema_ref: "nested_cfg",
    regions: ["us-east", "eu-west", "ap-south"],
    flags: { a: true, b: false },
  },
  services: Array.from({ length: 30 }, (_, s) => ({
    service_id: `svc-${s}`,
    instances: Array.from({ length: 4 }, (_, j) => ({
      host: `h-${s}-${j}`,
      port: 8000 + j,
      metadata: { schema_ref: "inst_v1", region: s % 2 === 0 ? "a" : "b" },
    })),
  })),
};

const logLine = { schema_ref: "log_v1", level: "info", msg: "dispatch" };
const repeatedLogs = Array.from({ length: 1200 }, (_, i) => ({
  ...logLine,
  request_id: `r-${i % 200}`,
  line: i,
  timestamp: `2026-06-03T12:${String(i % 60).padStart(2, "0")}:00.000Z`,
}));

const out = (name, data) => {
  writeFileSync(join(__dirname, name), JSON.stringify(data));
};

out("telemetry-large.json", telemetryLarge);
out("api-events.json", apiEvents);
out("repeated-transactions.json", repeatedTransactions);
out("nested-state-snapshots.json", nestedStateSnapshots);
out("repeated-logs.json", repeatedLogs);

console.log("Wrote benchmarks/datasets/*.json");
