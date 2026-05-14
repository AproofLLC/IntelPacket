import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import {
  canonicalize,
  canonicalStringify,
  compactSchema,
  compressPacket,
  createPacket,
  dedupeStructures,
  decompressPacket,
  diffPackets,
  hashPacket,
  innerEnvelopeSchema,
  IP_ENCODING,
  IP_VERSION,
  normalizeTypes,
  replayPacket,
} from "../src/index.js";

const root = dirname(fileURLToPath(import.meta.url));
const datasetsDir = join(root, "datasets");

function byteLen(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

function memoryHint(serializedTotal: number): string {
  return `~${(serializedTotal / (1024 * 1024)).toFixed(2)} MiB (sum of stage UTF-8 sizes, not RSS)`;
}

function runCase(name: string, data: unknown, previous?: unknown): void {
  const wall0 = performance.now();

  const rawJson = JSON.stringify(data);
  const rawBytes = byteLen(rawJson);

  const t0 = performance.now();
  const n = normalizeTypes(data);
  const normMs = performance.now() - t0;

  const canon = canonicalStringify(n);
  const canonBytes = byteLen(canon);

  const t1 = performance.now();
  const compactedVal = compactSchema(n);
  const compactMs = performance.now() - t1;
  const compacted = canonicalStringify(compactedVal);
  const compactBytes = byteLen(compacted);

  const t2 = performance.now();
  const deduped = dedupeStructures(compactedVal);
  const dedupMs = performance.now() - t2;
  const dedupCanon = canonicalStringify({
    root: deduped.value,
    refs: deduped.refs,
  });
  const dedupBytes = byteLen(dedupCanon);

  let deltaBytes = 0;
  let deltaMs = 0;
  if (previous !== undefined) {
    const td0 = performance.now();
    deltaBytes = byteLen(
      canonicalStringify(diffPackets(normalizeTypes(previous), n)),
    );
    deltaMs = performance.now() - td0;
  }

  const t3 = performance.now();
  const packet = createPacket(data, { base: previous });
  const packMs = performance.now() - t3;

  const t4 = performance.now();
  const utf8 = decompressPacket(packet.payload, packet.compression);
  const parsed: unknown = JSON.parse(utf8);
  const inner = innerEnvelopeSchema.parse(parsed);
  const hashedBody = canonicalize({
    ip_version: IP_VERSION,
    encoding: IP_ENCODING,
    root: inner.root,
    refs: inner.refs,
    delta: inner.delta,
  });
  hashPacket(hashedBody);
  const hashMs = performance.now() - t4;

  const compressedCanon = compressPacket(canon);
  const compressedDedup = compressPacket(dedupCanon);

  const t5 = performance.now();
  replayPacket(packet);
  const replayMs = performance.now() - t5;

  const serializedSum = rawBytes + canonBytes + compactBytes + dedupBytes;

  console.log(`\n=== ${name} ===`);
  console.log("raw JSON bytes           ", rawBytes);
  console.log("canonical bytes          ", canonBytes);
  console.log("normalize ms             ", normMs.toFixed(3));
  console.log("compacted bytes          ", compactBytes, `(${compactMs.toFixed(3)} ms)`);
  console.log("dedup envelope bytes     ", dedupBytes, `(${dedupMs.toFixed(3)} ms)`);
  if (previous !== undefined) {
    console.log("delta bytes              ", deltaBytes, `(${deltaMs.toFixed(3)} ms)`);
  }
  console.log(
    "compress(canonical)      ",
    compressedCanon.metadata.compressed_bytes,
    `${(compressedCanon.metadata.reduction_ratio * 100).toFixed(2)}% vs canonical body`,
  );
  console.log(
    "compress(dedup env)      ",
    compressedDedup.metadata.compressed_bytes,
    `${(compressedDedup.metadata.reduction_ratio * 100).toFixed(2)}% vs dedup envelope`,
  );
  console.log("createPacket ms          ", packMs.toFixed(3));
  console.log("hash inner envelope ms   ", hashMs.toFixed(3));
  console.log("replay ms                ", replayMs.toFixed(3));
  console.log("wall clock ms            ", (performance.now() - wall0).toFixed(3));
  console.log("memory hint              ", memoryHint(serializedSum));

  console.log("throughput notes         create_packet=", (rawBytes / packMs / 1024).toFixed(1), " KiB raw input / ms (approx)");
}

function load(name: string): unknown {
  return JSON.parse(readFileSync(join(datasetsDir, name), "utf8")) as unknown;
}

console.log("IntelPacket benchmark — datasets:", datasetsDir);

runCase("telemetry-large.json", load("telemetry-large.json"));
runCase("api-events.json", load("api-events.json"));
runCase("repeated-transactions.json", load("repeated-transactions.json"));
runCase("nested-state-snapshots.json", load("nested-state-snapshots.json"));
runCase("repeated-logs.json", load("repeated-logs.json"));

const telemetry = Array.from({ length: 500 }, (_, i) => ({
  event_type: i % 2 === 0 ? "tick" : "tock",
  device_id: `dev-${i % 20}`,
  temperature: 18 + (i % 7),
  timestamp: `2026-05-13T12:${String(i % 60).padStart(2, "0")}:00.000Z`,
}));

const nested = {
  a: { b: { c: { d: { e: telemetry.slice(0, 50) } } } },
  z: telemetry.slice(0, 50),
};

const prev = { cpu: 40, mem: 128 };
const next = { cpu: 55, mem: 160 };

runCase("synthetic: repeated telemetry (500)", telemetry);
runCase("synthetic: nested structures", nested);
runCase("synthetic: state delta", next, prev);

console.log("\nDone.");
