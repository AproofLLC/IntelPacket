/**
 * Regenerates synthetic benchmark fixtures (public-safe, no real PII).
 * Run: node benchmarks/datasets/realistic/generate-fixtures.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function write(name, data) {
  writeFileSync(join(here, name), JSON.stringify(data, null, 2) + "\n", "utf8");
}

const svc = ["api-gateway", "billing-svc", "auth-svc", "search-svc", "notify-svc"];

// 1. api-responses.json
const apiResponses = {
  meta: { api_version: "v2", tenant: "bench-tenant-alpha" },
  pages: [],
};
for (let p = 0; p < 5; p++) {
  const items = [];
  for (let i = 0; i < 12; i++) {
    const id = p * 12 + i;
    items.push({
      id: `item-${id}`,
      type: "resource",
      attributes: {
        status: i % 3 === 0 ? "active" : "pending",
        score: 0.42 + (i % 10) * 0.01,
        tags: ["alpha", "beta", "gamma"].slice(0, (i % 3) + 1),
        nested: { revision: i % 7, flags: { a: true, b: i % 2 === 0 } },
      },
      links: { self: `/v2/items/item-${id}` },
    });
  }
  apiResponses.pages.push({
    page: p + 1,
    page_size: 12,
    total_pages: 5,
    items,
    rate_limit: { remaining: 900 - p * 10, reset_at: "2026-01-15T12:00:00.000Z" },
  });
}
write("api-responses.json", apiResponses);

// 2. app-logs.json
const appLogs = { service: "edge-router", entries: [] };
for (let i = 0; i < 180; i++) {
  appLogs.entries.push({
    ts: `2026-01-10T${String(10 + (i % 8)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00.000Z`,
    level: ["info", "warn", "error", "debug"][i % 4],
    service: svc[i % svc.length],
    msg: `request_completed path=/api/v1/${i % 5}/action status=${200 + (i % 3)}`,
    ctx: { trace_id: `tr-${(i * 7919) % 100000}`, shard: i % 4 },
  });
}
write("app-logs.json", appLogs);

// 3. otel-traces.json
const traces = { resource: { service_name: "checkout-api" }, traces: [] };
for (let t = 0; t < 25; t++) {
  const spans = [];
  for (let s = 0; s < 8; s++) {
    spans.push({
      span_id: `sp-${t}-${s}`,
      name: s === 0 ? "POST /orders" : `child-${s}`,
      start_ns: 1700000000000000 + t * 1e9 + s * 1e7,
      duration_ms: 2 + (s * 3) % 40,
      attributes: {
        "http.method": "POST",
        "http.route": "/orders",
        "db.system": "postgresql",
        "peer.service": svc[s % svc.length],
      },
      events: [{ name: "checkpoint", ts_ns: 1700000000000000 + t * 1e9 }],
    });
  }
  traces.traces.push({ trace_id: `trc-${t}`, spans });
}
write("otel-traces.json", traces);

// 4. config-snapshots.json
const configSnapshots = { app: "payments-worker", snapshots: [] };
for (let v = 0; v < 35; v++) {
  configSnapshots.snapshots.push({
    version: v + 1,
    deployed_at: `2026-01-${String(1 + (v % 28)).padStart(2, "0")}T00:00:00.000Z`,
    config: {
      workers: 4 + (v % 3),
      queue: { name: "jobs-main", prefetch: 32 },
      features: { dark_mode: v % 2 === 0, beta_api: v % 5 === 0 },
      limits: { max_batch: 100 + v, timeout_ms: 5000 },
    },
  });
}
write("config-snapshots.json", configSnapshots);

// 5. audit-trails.json
const audit = { domain: "corp-bench", events: [] };
const actors = ["svc-principal-1", "svc-principal-2", "batch-job"];
const actions = ["READ", "WRITE", "DELETE", "EXPORT"];
for (let i = 0; i < 120; i++) {
  audit.events.push({
    event_id: `aud-${i}`,
    at: `2026-02-01T${String(i % 24).padStart(2, "0")}:00:00.000Z`,
    actor: actors[i % actors.length],
    action: actions[i % actions.length],
    resource: `/records/${(i * 17) % 500}`,
    outcome: i % 7 === 0 ? "denied" : "allowed",
    meta: { ip_prefix: "10.0.", region: ["us-east", "eu-west"][i % 2] },
  });
}
write("audit-trails.json", audit);

// 6. transactions.json
const tx = { currency: "USD", records: [] };
for (let i = 0; i < 90; i++) {
  tx.records.push({
    tx_id: `txn-synth-${i}`,
    merchant_id: `mer-${i % 12}`,
    account_token: `acct-synth-${(i * 31) % 200}`,
    amount_cents: 100 + (i * 13) % 50000,
    status: ["captured", "voided", "pending"][i % 3],
    line_items: [
      { sku: "SKU-A", qty: 1 + (i % 4), unit_cents: 500 },
      { sku: "SKU-B", qty: 2, unit_cents: 1200 },
    ],
  });
}
write("transactions.json", tx);

// 7. telemetry.json
const telem = { site: "bench-site-7", readings: [] };
for (let i = 0; i < 200; i++) {
  telem.readings.push({
    device_id: `dev-${i % 25}`,
    sensor: ["temp_c", "pressure_kpa", "humidity_pct"][i % 3],
    value: 20 + (i * 0.07) % 15 + (i % 5) * 0.01,
    unit: "si",
    ts: `2026-03-01T00:${String(i % 60).padStart(2, "0")}:00.000Z`,
    quality: i % 11 === 0 ? "bad" : "good",
  });
}
write("telemetry.json", telem);

console.log("Wrote 7 realistic JSON fixtures to", here);
