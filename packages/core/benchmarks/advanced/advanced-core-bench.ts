/**
 * Advanced core benchmark: entropy-class datasets, percentiles, gzip/brotli baselines,
 * memory hints, determinism + replay round-trip. CLI: --scale=10k|100k|1m --iterations=N [--strict-scale]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import {
  canonicalize,
  createPacket,
  normalizeTypes,
  replayPacket,
  verifyIntelPacket,
  INTELPACKET_SPEC_VERSION,
} from "../../src/index.js";
import { computeBaselines } from "./baselines.js";
import { buildEntropyDataset, ENTROPY_ORDER, type EntropyClass } from "./entropy-datasets.js";
import {
  buildPublicRealCoreDatasets,
  type DatasetCategory,
  type PublicRealDataset,
} from "./public-real-datasets.js";
import {
  defaultIterationsForScale,
  effectiveRecordCountCore,
  parseIterationsArg,
  parseScaleArg,
  parseStrictScale,
  scaleToCount,
  type ScaleName,
} from "./stress.js";
import { stableJsonStringify, summarizeTimingMs } from "./stats.js";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, "outputs");

const fixedCreatedAt = "2026-01-01T00:00:00.000Z";
const packOpts = { createdAt: fixedCreatedAt } as const;
type DatasetSet = "synthetic" | "public-real" | "all";
type DatasetSource = "synthetic" | "public-real";

function seedFor(entropy: EntropyClass): number {
  const base: Record<EntropyClass, number> = {
    low: 1001,
    medium: 2002,
    high: 3003,
    "nested-low": 4004,
    "nested-high": 5005,
  };
  return base[entropy];
}

function parseDatasetSet(argv: readonly string[]): DatasetSet {
  for (const a of argv) {
    if (a.startsWith("--dataset-set=")) {
      const v = a.slice("--dataset-set=".length);
      if (v === "synthetic" || v === "public-real" || v === "all") return v;
      throw new Error(`Invalid --dataset-set (use synthetic, public-real, or all): ${a}`);
    }
  }
  return "all";
}

function categoryForSynthetic(entropy: EntropyClass): DatasetCategory {
  if (entropy === "nested-high") return "trace";
  if (entropy === "nested-low") return "config";
  if (entropy === "high") return "transaction";
  return "telemetry";
}

function intelVsBaseline(intelBytes: number, baselineBytes: number): number {
  if (baselineBytes <= 0) return 0;
  return Math.round((1 - intelBytes / baselineBytes) * 1e6) / 1e4;
}

type MemorySnap = {
  beforeHeapUsed: number;
  afterHeapUsed: number;
  heapDelta: number;
  beforeRss: number;
  afterRss: number;
  rssDelta: number;
};

function memorySnapshot(): { heapUsed: number; rss: number } {
  const m = process.memoryUsage();
  return { heapUsed: m.heapUsed, rss: m.rss };
}

function run(): void {
  const benchmarkStarted = performance.now();
  mkdirSync(outDir, { recursive: true });
  const argvRaw = process.argv.slice(2);
  const argv = argvRaw[0] === "--" ? argvRaw.slice(1) : argvRaw;
  const scaleName = parseScaleArg(argv);
  const datasetSet = parseDatasetSet(argv);
  const scaleRequested = scaleToCount(scaleName);
  const strict = parseStrictScale(argv);
  const { recordCount, capped: recordCapCapped, capReason: recordCapReason } =
    effectiveRecordCountCore(scaleRequested, strict);
  const iterations = parseIterationsArg(argv) ?? defaultIterationsForScale(scaleName);
  const timingIters = Math.min(
    iterations,
    recordCount <= 10_000 ? iterations : recordCount <= 100_000 ? Math.min(iterations, 12) : Math.min(iterations, 5),
  );

  const rows: unknown[] = [];

  const workloads: Array<{
    dataset: string;
    entropyClass: string;
    data: unknown;
    datasetSource: DatasetSource;
    datasetCategory: DatasetCategory;
  }> = [];

  if (datasetSet === "synthetic" || datasetSet === "all") {
    for (const entropy of ENTROPY_ORDER) {
      const { data, entropyClass } = buildEntropyDataset(entropy, recordCount, seedFor(entropy));
      workloads.push({
        dataset: entropyClass,
        entropyClass,
        data,
        datasetSource: "synthetic",
        datasetCategory: categoryForSynthetic(entropy),
      });
    }
  }

  if (datasetSet === "public-real" || datasetSet === "all") {
    for (const dataset of buildPublicRealCoreDatasets(recordCount)) {
      workloads.push({
        dataset: dataset.name,
        entropyClass: "public-real",
        data: dataset.data,
        datasetSource: "public-real",
        datasetCategory: dataset.category,
      });
    }
  }

  for (const workload of workloads) {
    const { data, entropyClass, dataset, datasetSource, datasetCategory } = workload;
    const jsonUtf8 = JSON.stringify(data);
    const rawBytes = Buffer.byteLength(jsonUtf8, "utf8");
    const baseline = computeBaselines(jsonUtf8);

    const hashes: string[] = [];
    for (let i = 0; i < 3; i++) {
      hashes.push(createPacket(data, packOpts).packet_hash);
    }
    const deterministicStable = new Set(hashes).size === 1;
    if (!deterministicStable) {
      throw new Error(`[${dataset}] determinism failed`);
    }

    const packet = createPacket(data, packOpts);
    const verifySuccess = verifyIntelPacket(packet);
    if (!verifySuccess) {
      throw new Error(`[${dataset}] verifyIntelPacket failed`);
    }
    const replay = replayPacket(packet);
    const repacked = createPacket(replay.normalized, packOpts);
    const replaySuccess = repacked.packet_hash === packet.packet_hash;
    if (!replaySuccess) {
      throw new Error(`[${dataset}] replay round-trip hash mismatch`);
    }

    const compressedPayloadBytes = packet.compression.compressed_bytes;
    const packetBytes = Buffer.byteLength(JSON.stringify(packet), "utf8");
    const innerUtf8Len = packet.compression.raw_bytes;

    const intelPacketReductionPercent =
      Math.round(packet.compression.reduction_ratio * 1e6) / 1e4;

    const gzipReductionPercent = baseline.gzipReductionPercent;
    const brotliReductionPercent = baseline.brotliReductionPercent;

    const intelPacketVsGzipPercent = intelVsBaseline(compressedPayloadBytes, baseline.gzipBytes);
    const intelPacketVsBrotliPercent = intelVsBaseline(compressedPayloadBytes, baseline.brotliBytes);
    const intelPacketPacketVsGzipPercent = intelVsBaseline(packetBytes, baseline.gzipBytes);
    const intelPacketPacketVsBrotliPercent = intelVsBaseline(packetBytes, baseline.brotliBytes);

    const createSamples: number[] = [];
    const replaySamples: number[] = [];
    const verifySamples: number[] = [];
    const canonSamples: number[] = [];

    const norm = normalizeTypes(data);
    for (let i = 0; i < timingIters; i++) {
      const t0 = performance.now();
      createPacket(data, packOpts);
      createSamples.push(performance.now() - t0);
    }
    for (let i = 0; i < timingIters; i++) {
      const t0 = performance.now();
      replayPacket(packet);
      replaySamples.push(performance.now() - t0);
    }
    for (let i = 0; i < timingIters; i++) {
      const t0 = performance.now();
      if (!verifyIntelPacket(packet)) throw new Error("verify");
      verifySamples.push(performance.now() - t0);
    }
    for (let i = 0; i < timingIters; i++) {
      const t0 = performance.now();
      canonicalize(norm);
      canonSamples.push(performance.now() - t0);
    }

    const m0 = memorySnapshot();
    for (let i = 0; i < Math.min(5, timingIters); i++) {
      createPacket(data, packOpts);
    }
    const m1 = memorySnapshot();

    rows.push({
      dataset,
      scale: scaleName,
      entropyClass,
      datasetSource,
      datasetCategory,
      iterationsRequested: iterations,
      timingSamples: timingIters,
      rawBytes,
      canonicalBytes: innerUtf8Len,
      packetBytes,
      compressedPayloadBytes,
      gzipRawBytes: baseline.gzipBytes,
      brotliRawBytes: baseline.brotliBytes,
      intelPacketReductionPercent,
      gzipReductionPercent,
      brotliReductionPercent,
      intelPacketVsGzipPercent,
      intelPacketVsBrotliPercent,
      intelPacketPacketVsGzipPercent,
      intelPacketPacketVsBrotliPercent,
      createPacket: summarizeTimingMs(createSamples),
      replayPacket: summarizeTimingMs(replaySamples),
      verifyIntelPacket: summarizeTimingMs(verifySamples),
      canonicalize: summarizeTimingMs(canonSamples),
      memory: {
        beforeHeapUsed: m0.heapUsed,
        afterHeapUsed: m1.heapUsed,
        heapDelta: m1.heapUsed - m0.heapUsed,
        beforeRss: m0.rss,
        afterRss: m1.rss,
        rssDelta: m1.rss - m0.rss,
      } satisfies MemorySnap,
      deterministicStable,
      replaySuccess,
      verifySuccess,
    });
  }

  const jsonOut = {
    specVersion: INTELPACKET_SPEC_VERSION,
    generatedAt: new Date().toISOString(),
    cli: {
      argv,
      scale: scaleName,
      datasetSet,
      scaleRequested,
      recordCount,
      recordCapCapped,
      recordCapReason: recordCapReason ?? null,
      strictScale: strict,
      iterationsRequested: iterations,
      timingSamplesPerOp: timingIters,
      totalRuntimeMs: Math.round((performance.now() - benchmarkStarted) * 100) / 100,
    },
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    datasets: rows,
  };

  const jsonPath = join(outDir, "core-advanced-results.json");
  writeFileSync(jsonPath, stableJsonStringify(jsonOut) + "\n", "utf8");

  const md = buildMarkdown(
    scaleName,
    scaleRequested,
    recordCount,
    recordCapCapped,
    recordCapReason,
    iterations,
    timingIters,
    rows as Row[],
    jsonOut.generatedAt,
    datasetSet,
    jsonOut.cli.totalRuntimeMs,
    strict,
  );
  writeFileSync(join(outDir, "CORE_ADVANCED_REPORT.md"), md, "utf8");

  console.log(`Wrote ${jsonPath} and CORE_ADVANCED_REPORT.md`);
}

type Row = {
  dataset: string;
  scale: ScaleName;
  entropyClass: string;
  datasetSource: DatasetSource;
  datasetCategory: DatasetCategory;
  iterationsRequested: number;
  timingSamples: number;
  createPacket: ReturnType<typeof summarizeTimingMs>;
  replayPacket: ReturnType<typeof summarizeTimingMs>;
  verifyIntelPacket: ReturnType<typeof summarizeTimingMs>;
  canonicalize: ReturnType<typeof summarizeTimingMs>;
  intelPacketReductionPercent: number;
  gzipReductionPercent: number;
  brotliReductionPercent: number;
  intelPacketVsGzipPercent: number;
  intelPacketVsBrotliPercent: number;
  memory: MemorySnap;
  deterministicStable: boolean;
  replaySuccess: boolean;
  verifySuccess: boolean;
};

function buildMarkdown(
  scaleName: ScaleName,
  scaleRequested: number,
  recordCount: number,
  recordCapCapped: boolean,
  recordCapReason: string | undefined,
  iterationsRequested: number,
  timingSamples: number,
  rows: Row[],
  generatedAt: string,
  datasetSet: DatasetSet,
  totalRuntimeMs: number,
  strictScale: boolean,
): string {
  const timingRows = rows.map((r) => [
    r.entropyClass,
    r.createPacket.p50Ms,
    r.createPacket.p95Ms,
    r.createPacket.p99Ms,
    r.replayPacket.p50Ms,
    r.replayPacket.p95Ms,
    r.replayPacket.p99Ms,
    r.verifyIntelPacket.p50Ms,
    r.verifyIntelPacket.p95Ms,
    r.verifyIntelPacket.p99Ms,
  ]);

  const opsRows = rows.map((r) => [
    r.entropyClass,
    r.createPacket.opsPerSec,
    r.replayPacket.opsPerSec,
    r.verifyIntelPacket.opsPerSec,
    r.canonicalize.opsPerSec,
  ]);

  const redRows = rows.map((r) => [
    r.entropyClass,
    r.intelPacketReductionPercent,
    r.gzipReductionPercent,
    r.brotliReductionPercent,
    r.intelPacketVsGzipPercent,
    r.intelPacketVsBrotliPercent,
  ]);

  const memRows = rows.map((r) => [
    r.entropyClass,
    Math.round(r.memory.heapDelta / 1024),
    Math.round(r.memory.rssDelta / 1024),
  ]);
  const publicRealRows = rows
    .filter((r) => r.datasetSource === "public-real")
    .map((r) => [
      r.dataset,
      r.datasetCategory,
      r.entropyClass,
      r.intelPacketReductionPercent,
      r.createPacket.p95Ms,
      r.replayPacket.p95Ms,
      r.verifyIntelPacket.p95Ms,
    ]);

  const strictRows = rows.map((r) => [
    r.dataset,
    r.datasetSource,
    r.datasetCategory,
    r.createPacket.opsPerSec,
    r.replayPacket.opsPerSec,
    r.verifyIntelPacket.opsPerSec,
    Math.round(r.memory.heapDelta / 1024),
    r.deterministicStable,
    r.replaySuccess,
    r.verifySuccess,
  ]);

  return `# IntelPacket Core — Advanced Benchmark Report

Generated: **${generatedAt}**

## Methodology

- Synthetic **entropy-class** datasets at fixed scales (see \`entropy-datasets.ts\`), seeded deterministic PRNG for high-entropy payloads.
- **Scale:** \`--scale\` names a stress tier (10k / 100k / 1m requested records). Without \`--strict-scale\`, large tiers use a **soft row cap** so runs stay feasible — JSON \`cli\` reports \`scaleRequested\` vs \`recordCount\`.
- Timings collected over **${timingSamples}** timed iterations per operation (requested: **${iterationsRequested}**; capped for large payloads). After implicit warm-up on first \`createPacket\` in determinism block.
- Percentiles (**p50 / p95 / p99**) use **linear interpolation** on sorted samples (\`stats.ts\`).
- **gzip / brotli** baselines: Node \`zlib.gzipSync\` / \`zlib.brotliCompressSync\` on the **same raw JSON UTF-8** string as IntelPacket input (best-effort comparison, not a wire-format contest).
- **IntelPacket reduction%** is the packet’s own \`compression.reduction_ratio\` (inner canonical UTF-8 vs compressed payload).
- **intelPacketVsGzipPercent** / **intelPacketVsBrotliPercent**: \(100 \\times (1 - \\frac{\\text{IntelPacket compressed payload}}{\\text{gzip/brotli bytes}})\\). Positive means the **compressed inner payload** is smaller than raw-json gzip/brotli.
- **Full packet** JSON size often exceeds gzip/brotli of raw JSON because of metadata, base64, refs mirrors — see JSON fields \`intelPacketPacketVsGzipPercent\` / \`intelPacketPacketVsBrotliPercent\` (often negative; that is expected and not a failure).

## Environment & CLI

| Field | Value |
| --- | --- |
| scale mode | ${scaleName} |
| dataset set | ${datasetSet} |
| records requested | ${scaleRequested.toLocaleString()} |
| records used | ${recordCount.toLocaleString()} |
| iterations (requested) | ${iterationsRequested} |
| timing samples / op | ${timingSamples} |
| Node | ${process.version} |
| platform | ${process.platform} |
| total runtime ms | ${totalRuntimeMs} |

${recordCapCapped && recordCapReason ? `> **Soft cap:** ${recordCapReason} Use \`--strict-scale\` for the full requested row count (may be slow / memory-heavy).\n\n` : ""}
## Dataset / entropy classes

| Class | Description |
| --- | --- |
| low | Highly repetitive flat records |
| medium | Shared schema, mixed categorical values |
| high | Pseudo-random unique strings |
| nested-low | Repeated deep subtree |
| nested-high | Unique nested shapes per row |

## Public-real datasets

Public-real datasets exercise realistic infrastructure patterns: API envelopes, Kubernetes-style operational events, OpenTelemetry-like traces, audit logs, webhook deliveries, transaction-shaped records, and nested configuration snapshots. They matter because synthetic entropy classes are good at isolating compression and replay behavior, but they do not capture the mixture of stable keys, nested envelopes, repeated metadata, and high-cardinality identifiers seen in infrastructure payloads.

Limitations remain: public-real data is still not identical to private production traffic, and benchmark behavior is workload-dependent. These fixtures are public-safe generated subsets inspired by public documentation shapes, not copied production dumps.

| dataset | source | entropy | reduction | create p95 | replay p95 | verify p95 |
| --- | --- | --- | ---: | ---: | ---: | ---: |
${publicRealRows.length > 0 ? publicRealRows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} | ${r[4]} | ${r[5]} | ${r[6]} |`).join("\n") : "| _none selected_ | - | - | - | - | - | - |"}

## Reduction & baseline comparison (%)

| entropy | intel inner % | gzip raw % | brotli raw % | payload vs gzip | payload vs brotli |
| --- | ---: | ---: | ---: | ---: | ---: |
${redRows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} | ${r[4]} | ${r[5]} |`).join("\n")}

## Timing ms — p50 / p95 / p99

| entropy | create p50/p95/p99 | replay p50/p95/p99 | verify p50/p95/p99 |
| --- | --- | --- | --- |
${timingRows
  .map(
    (r) =>
      `| ${r[0]} | ${r[1]}/${r[2]}/${r[3]} | ${r[4]}/${r[5]}/${r[6]} | ${r[7]}/${r[8]}/${r[9]} |`,
  )
  .join("\n")}

## ops/sec (from avg ms)

| entropy | create | replay | verify | canonicalize |
| --- | ---: | ---: | ---: | ---: |
${opsRows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} | ${r[4]} |`).join("\n")}

## Memory (approximate; kB delta after short burst)

| entropy | heapΔ kB | rssΔ kB |
| --- | ---: | ---: |
${memRows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} |`).join("\n")}

## Determinism & replay

All rows: **deterministicStable**, **replaySuccess**, **verifySuccess** — benchmark **fails** if any are false (enforced in runner).

${strictScale ? `## Strict 100k validation

Strict scale was enabled for this run. The runner used **${recordCount.toLocaleString()}** records for each selected dataset with no soft cap.

| dataset | source | category | create ops/sec | replay ops/sec | verify ops/sec | heap delta kB | deterministic | replay | verify |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
${strictRows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} | ${r[4]} | ${r[5]} | ${r[6]} | ${r[7]} | ${r[8]} | ${r[9]} |`).join("\n")}

Total runtime: **${totalRuntimeMs} ms**. Throughput varies by dataset shape and entropy; high-cardinality transaction/trace-like workloads are expected to show less compression and lower throughput than repetitive telemetry/config workloads.
` : ""}

## Limitations & non-goals

- Compression **varies strongly by entropy**; random-looking JSON may barely compress.
- IntelPacket is **structure-aware packetization** (canonical form, dedupe, compaction, hashing, replay) — **not magic compression**.
- Not a load test SLA, not security certification, not production tuning advice.

---
*Regenerate: \`pnpm run bench:advanced\` (root) or \`pnpm run bench:advanced\` in \`packages/core\`.*
`;
}

try {
  run();
} catch (e) {
  console.error(e);
  process.exitCode = 1;
}
