import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import {
  canonicalize,
  createPacket,
  decompressPacket,
  hashPacket,
  innerEnvelopeSchema,
  IP_ENCODING,
  IP_VERSION,
  replayPacket,
} from "../src/index.js";

const ROUNDS = 50;
const root = dirname(fileURLToPath(import.meta.url));
const datasetsDir = join(root, "datasets");

const DATASETS = [
  "telemetry-large.json",
  "api-events.json",
  "repeated-transactions.json",
  "nested-state-snapshots.json",
  "repeated-logs.json",
] as const;

function byteLen(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

function load(name: (typeof DATASETS)[number]): unknown {
  return JSON.parse(readFileSync(join(datasetsDir, name), "utf8"));
}

function stats(values: number[]): {
  min: number;
  max: number;
  avg: number;
} {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return { min, max, avg };
}

console.log("IntelPacket engine 50× benchmark — datasets:", datasetsDir);
console.log(`Iterations per dataset: ${ROUNDS}\n`);

for (const file of DATASETS) {
  const data = load(file);
  const rawJson = JSON.stringify(data);
  const rawBytes = byteLen(rawJson);

  const createMs: number[] = [];
  const replayMs: number[] = [];
  const hashMs: number[] = [];
  const packetBytes: number[] = [];
  const reduction: number[] = [];

  for (let i = 0; i < ROUNDS; i++) {
    void i;
    const t0 = performance.now();
    const packet = createPacket(data, { createdAt: `BENCH50-${file}-${i}` });
    createMs.push(performance.now() - t0);

    packetBytes.push(
      byteLen(packet.payload) +
        byteLen(JSON.stringify(packet.refs)) +
        byteLen(JSON.stringify(packet.delta ?? null)),
    );
    reduction.push(packet.compression.reduction_ratio);

    const utf8 = decompressPacket(packet.payload, packet.compression);
    const inner = innerEnvelopeSchema.parse(JSON.parse(utf8));
    const body = canonicalize({
      ip_version: IP_VERSION,
      encoding: IP_ENCODING,
      root: inner.root,
      refs: inner.refs,
      delta: inner.delta,
    });

    const th0 = performance.now();
    hashPacket(body);
    hashMs.push(performance.now() - th0);

    const tr0 = performance.now();
    replayPacket(packet);
    replayMs.push(performance.now() - tr0);
  }

  const c = stats(createMs);
  const r = stats(replayMs);
  const h = stats(hashMs);
  const pb = stats(packetBytes);
  const red = stats(reduction);

  console.log(`=== ${file} ===`);
  console.log(`raw JSON bytes (input):     ${rawBytes}`);
  console.log(
    `createPacket ms:           avg ${c.avg.toFixed(3)}  min ${c.min.toFixed(3)}  max ${c.max.toFixed(3)}`,
  );
  console.log(
    `replayPacket ms:           avg ${r.avg.toFixed(3)}  min ${r.min.toFixed(3)}  max ${r.max.toFixed(3)}`,
  );
  console.log(
    `hash inner envelope ms:    avg ${h.avg.toFixed(3)}  min ${h.min.toFixed(3)}  max ${h.max.toFixed(3)}`,
  );
  console.log(
    `approx wire bytes (payload+refs+delta): avg ${pb.avg.toFixed(0)}  min ${pb.min.toFixed(0)}  max ${pb.max.toFixed(0)}`,
  );
  console.log(
    `compression reduction_ratio: avg ${(red.avg * 100).toFixed(2)}%  min ${(red.min * 100).toFixed(2)}%  max ${(red.max * 100).toFixed(2)}%`,
  );
  console.log("");
}

console.log("Done.");
