/**
 * Realistic dataset benchmark: loads synthetic JSON, runs full IntelPacket pipeline,
 * validates determinism + replay + verify, writes JSON + Markdown reports.
 *
 * Run from packages/core: pnpm run bench:realistic
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPacket,
  decompressPacket,
  replayPacket,
  verifyIntelPacket,
  INTELPACKET_SPEC_VERSION,
} from "../src/index.js";
import {
  assertRoundTripPacketHash,
  assertSameHash,
  getEnvironment,
  markdownTable,
  meanMs,
  utf8Bytes,
} from "./benchmark-utils.js";

const root = dirname(fileURLToPath(import.meta.url));
const datasetsDir = join(root, "datasets", "realistic");
const outDir = join(root, "outputs");

function listDatasets(): string[] {
  return readdirSync(datasetsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

type Row = {
  dataset: string;
  rawBytes: number;
  canonicalBytes: number;
  packetBytes: number;
  compressedPayloadBytes: number;
  reductionPercent: number;
  createMs: number;
  replayMs: number;
  verifyMs: number;
  deterministicStable: boolean;
  replaySuccess: boolean;
  verifySuccess: boolean;
};

function run(): void {
  mkdirSync(outDir, { recursive: true });
  const names = listDatasets();
  if (names.length === 0) {
    throw new Error(`No JSON datasets in ${datasetsDir}`);
  }

  const rows: Row[] = [];
  const fixedCreatedAt = "2026-01-01T00:00:00.000Z";
  const packOpts = { createdAt: fixedCreatedAt } as const;

  for (const file of names) {
    const dataset = file.replace(/\.json$/i, "");
    const rawText = readFileSync(join(datasetsDir, file), "utf8");
    const data: unknown = JSON.parse(rawText);
    const rawBytes = utf8Bytes(rawText);

    const hashes: string[] = [];
    for (let i = 0; i < 5; i++) {
      const p = createPacket(data, packOpts);
      hashes.push(p.packet_hash);
    }
    assertSameHash(hashes, dataset);

    const packet = createPacket(data, packOpts);
    const innerUtf8 = decompressPacket(packet.payload, packet.compression);
    const innerBytesMetric = utf8Bytes(innerUtf8);

    const verifySuccess = verifyIntelPacket(packet);
    if (!verifySuccess) {
      throw new Error(`[${dataset}] verifyIntelPacket returned false`);
    }

    const replay = replayPacket(packet);
    assertRoundTripPacketHash(packet, replay.normalized, dataset, packOpts);

    const createMs = meanMs(() => {
      createPacket(data, packOpts);
    }, 20);
    const replayMs = meanMs(() => {
      replayPacket(packet);
    }, 25);
    const verifyMs = meanMs(() => {
      if (!verifyIntelPacket(packet)) throw new Error("verify");
    }, 40);

    const packetBytes = utf8Bytes(JSON.stringify(packet));
    const compressedPayloadBytes = packet.compression.compressed_bytes;
    const reductionPercent = Math.round(packet.compression.reduction_ratio * 1e6) / 1e4;

    rows.push({
      dataset,
      rawBytes,
      canonicalBytes: innerBytesMetric,
      packetBytes,
      compressedPayloadBytes,
      reductionPercent,
      createMs: Math.round(createMs * 1000) / 1000,
      replayMs: Math.round(replayMs * 1000) / 1000,
      verifyMs: Math.round(verifyMs * 1000) / 1000,
      deterministicStable: true,
      replaySuccess: true,
      verifySuccess: true,
    });
  }

  const env = getEnvironment();
  const generatedAt = new Date().toISOString();
  const jsonOut = {
    specVersion: INTELPACKET_SPEC_VERSION,
    generatedAt,
    environment: env,
    datasets: rows.sort((a, b) => a.dataset.localeCompare(b.dataset)),
  };

  const jsonPath = join(root, "benchmark-results.json");
  const jsonPathCopy = join(outDir, "benchmark-results.json");
  const text = JSON.stringify(jsonOut, null, 2) + "\n";
  writeFileSync(jsonPath, text, "utf8");
  writeFileSync(jsonPathCopy, text, "utf8");

  const md = buildMarkdown(jsonOut, rows);
  const mdPath = join(root, "BENCHMARK_REPORT.md");
  const mdPathCopy = join(outDir, "BENCHMARK_REPORT.md");
  writeFileSync(mdPath, md, "utf8");
  writeFileSync(mdPathCopy, md, "utf8");

  console.log(`Wrote ${jsonPath}, ${mdPath}`);
}

function buildMarkdown(
  jsonOut: { specVersion: string; generatedAt: string; environment: Record<string, string> },
  rows: Row[],
): string {
  const env = jsonOut.environment;
  const table = markdownTable(
    [
      "dataset",
      "rawBytes",
      "canonical(inner)Bytes",
      "packetBytes",
      "compressedPayloadBytes",
      "reduction%",
      "createMs",
      "replayMs",
      "verifyMs",
      "determinism",
      "replay",
      "verify",
    ],
    rows.map((r) => [
      r.dataset,
      r.rawBytes,
      r.canonicalBytes,
      r.packetBytes,
      r.compressedPayloadBytes,
      r.reductionPercent,
      r.createMs,
      r.replayMs,
      r.verifyMs,
      r.deterministicStable ? "ok" : "FAIL",
      r.replaySuccess ? "ok" : "FAIL",
      r.verifySuccess ? "ok" : "FAIL",
    ]),
  );

  return `# IntelPacket Core Benchmark Report

This report is **machine-generated** from synthetic fixtures under \`benchmarks/datasets/realistic/\`.
It is intended for **reproducible regression tracking**, not competitive marketing claims.

## Methodology

- Each dataset is loaded as JSON, then processed with \`createPacket\` (full pipeline: normalize → canonicalize → compact → dedupe → compress → hash).
- **Determinism:** five consecutive \`createPacket\` calls with a fixed \`createdAt\` must yield identical \`packet_hash\` values.
- **Replay:** \`replayPacket\` must succeed; **round-trip integrity:** \`createPacket(replay.normalized, same options)\` reproduces the original \`packet_hash\`.
- **Verify:** \`verifyIntelPacket\` must return \`true\` for the produced packet.
- **Timing:** mean milliseconds over multiple iterations after warm-up (\`performance.now\`).

## Environment

| Field | Value |
| --- | --- |
| generatedAt | ${jsonOut.generatedAt} |
| specVersion | ${jsonOut.specVersion} |
| node | ${env.node} |
| platform | ${env.platform} |
| arch | ${env.arch} |
| package | ${env.packageName} ${env.packageVersion} |

## Dataset descriptions

| File | Theme |
| --- | --- |
| api-responses.json | Paginated SaaS-style REST payloads with repeated item shapes |
| app-logs.json | Repeated structured application logs |
| otel-traces.json | OpenTelemetry-like nested traces/spans |
| config-snapshots.json | Versioned configuration snapshots |
| audit-trails.json | Synthetic enterprise audit events |
| transactions.json | Synthetic transaction rows with repeated merchants |
| telemetry.json | Repeated IoT-style metric readings |

All values are **synthetic** and contain no real customer or healthcare data.

## Results table

${table}

## Reduction summaries

- **reduction%** comes from the packet’s own \`compression.reduction_ratio\` (documented semantics in IntelPacket Spec v1).
- Results **vary strongly with dataset entropy**. Highly repetitive structured JSON tends to compress well; random or already-compressed payloads compress poorly.
- IntelPacket improves compressibility through **deterministic structural normalization** (canonical key order, optional compaction/dedupe) before compression — not through semantic intelligence.

## Replay verification

All listed datasets: **replay = ok** (\`createPacket(replay.normalized)\` matched original \`packet_hash\`).

## Determinism validation

All listed datasets: **determinism = ok** (five consecutive hashes matched).

## Important notes

- Timings are environment-dependent (CPU, Node version, OS).
- This benchmark does **not** include network, disk I/O, or transport overhead.
- \`packetBytes\` is the UTF-8 size of \`JSON.stringify(packet)\` as a coarse outer-size proxy.

## Limitations

- Datasets are moderate size to keep CI/dev loops fast.
- No GPU or WASM codecs are involved (Node zlib/brotli only).

## Non-goals

- Not a compliance, security certification, or penetration test.
- Not a guarantee of production latency or throughput.

---
*Regenerate with \`pnpm run bench:realistic\` from \`packages/core\`.*
`;
}

try {
  run();
} catch (e) {
  console.error(e);
  process.exitCode = 1;
}
