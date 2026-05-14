/**
 * Advanced PII benchmark: synthetic users, percentiles, memory, leak scans, replay/verify.
 * CLI: --scale=10k|100k|1m --iterations=N [--strict-scale]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import {
  createPIIPacket,
  protectPII,
  replayPacket,
  validatePrivacyPolicy,
  verifyIntelPacket,
  createPacket,
  INTELPACKET_PII_SPEC_VERSION,
} from "../../src/index.js";
import { buildPiiUsers, ENTROPY_ORDER, type EntropyClass } from "./pii-entropy-datasets.js";
import { buildPIIPublicRealDatasets } from "./pii-public-real-datasets.js";
import {
  collectKnownSyntheticPIIValues,
  collectKnownSyntheticSecrets,
  scanForLeaks,
  verifyHmacStability,
  verifyTokenStability,
} from "./pii-security.js";
import {
  defaultIterationsForScale,
  effectiveRecordCount,
  parseIterationsArg,
  parseScaleArg,
  parseStrictScale,
  scaleToCount,
  type ScaleName,
} from "./pii-stress.js";
import { stableJsonStringify, summarizeTimingMs } from "./pii-stats.js";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, "outputs");

const TOKEN_SECRET = "bench-adv-pii-token-secret-32bytes-min!!";
const HMAC_SECRET = "bench-adv-pii-hmac-secret-32bytes-min!!!";

const fixedCreatedAt = "2026-01-01T00:00:00.000Z";
/** Compression dominates wall time on large payloads; disabled here for feasible advanced runs (hash/replay unchanged). */
const packOpts = { createdAt: fixedCreatedAt, disableCompression: true } as const;
type DatasetSet = "synthetic" | "public-real" | "all";
type DatasetSource = "synthetic" | "public-real";
type DatasetCategory = "api" | "telemetry" | "audit" | "config" | "webhook" | "transaction" | "trace";

const piiOpts = { tokenSecret: TOKEN_SECRET, hmacSecret: HMAC_SECRET };

function policy() {
  return validatePrivacyPolicy({
    version: "v1",
    mode: "fail-closed",
    tokenize: ["users[].email", "users[].national_id"],
    mask: ["users[].phone"],
    hmac: ["users[].legal_name"],
    allow: [
      "users[].idx",
      "users[].email",
      "users[].phone",
      "users[].national_id",
      "users[].legal_name",
      "users[].addr_line",
      "users[].tier",
    ],
  });
}

function seedFor(entropy: EntropyClass): number {
  const m: Record<EntropyClass, number> = {
    low: 11_101,
    medium: 22_202,
    high: 33_303,
    "nested-low": 44_404,
    "nested-high": 55_505,
  };
  return m[entropy];
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
  if (entropy === "nested-low" || entropy === "nested-high") return "trace";
  if (entropy === "high") return "transaction";
  return "api";
}

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
  const { recordCount, capped: recordCapCapped, capReason: recordCapReason } = effectiveRecordCount(
    scaleRequested,
    strict,
  );
  const iterations = parseIterationsArg(argv) ?? defaultIterationsForScale(scaleName);
  const protectIters = Math.min(iterations, recordCount <= 10_000 ? 5 : recordCount <= 100_000 ? 4 : 3);
  const packetIters = Math.min(iterations, 2);
  const replayIters = Math.min(iterations, recordCount <= 10_000 ? 8 : 5);
  const pol = policy();

  const rows: unknown[] = [];

  const workloads: Array<{
    dataset: string;
    users: Record<string, unknown>[];
    bannedLiterals: string[];
    datasetSource: DatasetSource;
    datasetCategory: DatasetCategory;
  }> = [];

  if (datasetSet === "synthetic" || datasetSet === "all") {
    for (const entropy of ENTROPY_ORDER) {
      const { users, bannedLiterals } = buildPiiUsers(entropy, recordCount, seedFor(entropy));
      workloads.push({
        dataset: entropy,
        users,
        bannedLiterals,
        datasetSource: "synthetic",
        datasetCategory: categoryForSynthetic(entropy),
      });
    }
  }

  if (datasetSet === "public-real" || datasetSet === "all") {
    for (const dataset of buildPIIPublicRealDatasets(recordCount)) {
      workloads.push({
        dataset: dataset.name,
        users: dataset.users,
        bannedLiterals: dataset.bannedLiterals,
        datasetSource: "public-real",
        datasetCategory: dataset.category,
      });
    }
  }

  for (const workload of workloads) {
    const { users, bannedLiterals, dataset, datasetSource, datasetCategory } = workload;
    const data = { users };
    const rawJson = JSON.stringify(data);
    const rawBytes = Buffer.byteLength(rawJson, "utf8");

    const p1 = protectPII(data, pol, piiOpts);
    const p2 = protectPII(data, pol, piiOpts);
    const deterministicTokensStable = verifyTokenStability(p1.data, p2.data);
    const deterministicHmacStable = verifyHmacStability(p1.data, p2.data);
    if (!deterministicTokensStable || !deterministicHmacStable) {
      throw new Error(`[${dataset}] protectPII stability failed`);
    }

    const { packet, privacy } = createPIIPacket(data, pol, {
      ...piiOpts,
      packetOptions: packOpts,
    });

    const secrets = collectKnownSyntheticSecrets(TOKEN_SECRET, HMAC_SECRET);
    const piiVals =
      datasetSource === "public-real"
        ? [...new Set([...collectKnownSyntheticPIIValues(users), ...bannedLiterals])]
        : collectKnownSyntheticPIIValues(users);
    const sink =
      JSON.stringify(packet) + JSON.stringify(privacy) + JSON.stringify(p1.data) + JSON.stringify(p1.report);

    const secretHits = scanForLeaks(sink, secrets);
    const rawHits = scanForLeaks(sink, piiVals);
    const secretLeakDetected = secretHits.length > 0;
    const rawPIILeakDetected = rawHits.length > 0;
    if (secretLeakDetected) {
      throw new Error(`[${dataset}] secret leak: ${secretHits.join(", ")}`);
    }
    if (rawPIILeakDetected) {
      throw new Error(`[${dataset}] raw PII leak: ${rawHits.slice(0, 5).join("; ")}`);
    }

    const verifySuccess = verifyIntelPacket(packet);
    if (!verifySuccess) throw new Error(`[${dataset}] verifyIntelPacket failed`);

    const replay = replayPacket(packet);
    const repacked = createPacket(replay.normalized, packOpts);
    const replaySuccess = repacked.packet_hash === packet.packet_hash;
    if (!replaySuccess) throw new Error(`[${dataset}] replay round-trip failed`);

    const transformedJson = JSON.stringify(p1.data);
    const transformedBytes = Buffer.byteLength(transformedJson, "utf8");
    const packetBytes = Buffer.byteLength(JSON.stringify(packet), "utf8");
    const compressedPayloadBytes = packet.compression.compressed_bytes;
    const reductionPercent = Math.round(packet.compression.reduction_ratio * 1e6) / 1e4;

    const protectSamples: number[] = [];
    const fullSamples: number[] = [];
    const replaySamples: number[] = [];

    for (let i = 0; i < protectIters; i++) {
      const t0 = performance.now();
      protectPII(data, pol, piiOpts);
      protectSamples.push(performance.now() - t0);
    }
    for (let i = 0; i < packetIters; i++) {
      const t0 = performance.now();
      createPIIPacket(data, pol, { ...piiOpts, packetOptions: packOpts });
      fullSamples.push(performance.now() - t0);
    }
    for (let i = 0; i < replayIters; i++) {
      const t0 = performance.now();
      replayPacket(packet);
      replaySamples.push(performance.now() - t0);
    }

    const m0 = memorySnapshot();
    for (let i = 0; i < Math.min(2, packetIters); i++) {
      createPIIPacket(data, pol, { ...piiOpts, packetOptions: packOpts });
    }
    const m1 = memorySnapshot();

    rows.push({
      dataset,
      datasetSource,
      datasetCategory,
      scale: scaleName,
      iterations,
      timingSamples: { protectPII: protectIters, createPIIPacket: packetIters, replayPacket: replayIters },
      rawBytes,
      transformedBytes,
      packetBytes,
      compressedPayloadBytes,
      reductionPercent,
      protectPII: summarizeTimingMs(protectSamples),
      createPIIPacket: summarizeTimingMs(fullSamples),
      replayPacket: summarizeTimingMs(replaySamples),
      memory: {
        beforeHeapUsed: m0.heapUsed,
        afterHeapUsed: m1.heapUsed,
        heapDelta: m1.heapUsed - m0.heapUsed,
        beforeRss: m0.rss,
        afterRss: m1.rss,
        rssDelta: m1.rss - m0.rss,
      },
      redactCount: p1.report.fields_redacted.length,
      maskCount: p1.report.fields_masked.length,
      tokenizeCount: p1.report.fields_tokenized.length,
      hmacCount: p1.report.fields_hmac.length,
      deterministicTokensStable,
      deterministicHmacStable,
      replaySuccess,
      verifySuccess,
      secretLeakDetected,
      rawPIILeakDetected,
    });
  }

  const jsonOut = {
    piiSpecVersion: INTELPACKET_PII_SPEC_VERSION,
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
      timingSamples: { protectPII: protectIters, createPIIPacket: packetIters, replayPacket: replayIters },
      totalRuntimeMs: Math.round((performance.now() - benchmarkStarted) * 100) / 100,
    },
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    policyNote:
      "fail-closed v1; tokenize users[].email + users[].national_id; mask users[].phone; hmac users[].legal_name; synthetic secrets only",
    datasets: rows,
  };

  writeFileSync(join(outDir, "pii-advanced-results.json"), stableJsonStringify(jsonOut) + "\n", "utf8");
  writeFileSync(
    join(outDir, "PII_ADVANCED_REPORT.md"),
    buildMarkdown(
      jsonOut,
      rows as Row[],
      scaleName,
      scaleRequested,
      recordCount,
      recordCapCapped,
      recordCapReason,
      datasetSet,
      jsonOut.cli.totalRuntimeMs,
    ),
    "utf8",
  );

  console.log("Wrote pii-advanced-results.json and PII_ADVANCED_REPORT.md");
}

type Row = {
  dataset: string;
  datasetSource: DatasetSource;
  datasetCategory: DatasetCategory;
  protectPII: ReturnType<typeof summarizeTimingMs>;
  createPIIPacket: ReturnType<typeof summarizeTimingMs>;
  replayPacket: ReturnType<typeof summarizeTimingMs>;
  reductionPercent: number;
  memory: { heapDelta: number; rssDelta: number };
  deterministicTokensStable: boolean;
  deterministicHmacStable: boolean;
  replaySuccess: boolean;
  verifySuccess: boolean;
  secretLeakDetected: boolean;
  rawPIILeakDetected: boolean;
};

function buildMarkdown(
  jsonOut: {
    generatedAt: string;
    policyNote: string;
    cli: {
      iterationsRequested: number;
      timingSamples: Record<string, number>;
      scaleRequested: number;
      recordCount: number;
      recordCapCapped: boolean;
      recordCapReason: string | null;
      strictScale: boolean;
      totalRuntimeMs: number;
    };
  },
  rows: Row[],
  scaleName: ScaleName,
  scaleRequested: number,
  recordCount: number,
  recordCapCapped: boolean,
  recordCapReason: string | undefined,
  datasetSet: DatasetSet,
  totalRuntimeMs: number,
): string {
  const ts = jsonOut.cli.timingSamples;
  const publicRealRows = rows
    .filter((r) => r.datasetSource === "public-real")
    .map((r) => [
      r.dataset,
      r.datasetCategory,
      r.protectPII.p95Ms,
      r.createPIIPacket.p95Ms,
      r.replayPacket.p95Ms,
      r.deterministicTokensStable,
      r.deterministicHmacStable,
      r.rawPIILeakDetected,
      r.secretLeakDetected,
    ]);
  const strictRows = rows.map((r) => [
    r.dataset,
    r.datasetSource,
    r.datasetCategory,
    r.protectPII.opsPerSec,
    r.createPIIPacket.opsPerSec,
    r.replayPacket.opsPerSec,
    r.deterministicTokensStable,
    r.deterministicHmacStable,
    r.replaySuccess,
    r.verifySuccess,
    r.rawPIILeakDetected,
    r.secretLeakDetected,
  ]);
  return `# IntelPacket PII — Advanced Benchmark Report

Generated: **${jsonOut.generatedAt}**

## Methodology

- **Synthetic fake PII only** (\`@example.invalid\`, \`555-*\` phones, synthetic IDs) — see \`pii-entropy-datasets.ts\`.
- Same **entropy classes** as core advanced bench for comparability.
- **Scale:** \`--scale\` selects a *stress class* (10k / 100k / 1m nominal users). Unless \`--strict-scale\` is set, the runner may use fewer users so the suite completes — see Environment table and JSON \`cli.scaleRequested\` vs \`cli.recordCount\`.
- Timing sample counts (capped for very large payloads): protect=${ts.protectPII}, createPIIPacket=${ts.createPIIPacket}, replay=${ts.replayPacket} (requested iterations: ${jsonOut.cli.iterationsRequested}). **p50/p95/p99** via linear interpolation on sorted samples.
- **Leak scan:** benchmark secrets + raw field literals from generated rows must not appear in serialized packet, privacy report, or transformed payload strings.
- **Stability:** two \`protectPII\` runs must yield identical transformed JSON.
- **Replay:** \`createPacket(replay.normalized)\` must match original \`packet_hash\`.

## Policy

${jsonOut.policyNote}

## Environment & CLI

| Field | Value |
| --- | --- |
| scale mode | ${scaleName} |
| dataset set | ${datasetSet} |
| users requested | ${scaleRequested.toLocaleString()} |
| users used | ${recordCount.toLocaleString()} |
| strict-scale | ${jsonOut.cli.strictScale} |
| iterations (requested) | ${jsonOut.cli.iterationsRequested} |
| timing samples (protect / packet / replay) | ${ts.protectPII} / ${ts.createPIIPacket} / ${ts.replayPacket} |
| Node | ${process.version} |
| total runtime ms | ${totalRuntimeMs} |

${recordCapCapped && recordCapReason ? `> **Soft cap:** ${recordCapReason} Use \`--strict-scale\` for the full requested user count (may be very slow).\n\n` : ""}
## Public-real safe datasets

Public-real safe PII datasets exercise generated profile, webhook, support-ticket, and audit-user shapes with fake identities only. They help catch policy and leak-scan behavior that pure entropy classes can miss, while remaining public-safe and free of private or sensitive user data. They still are not identical to private production traffic; performance and transform counts remain policy-dependent.

| dataset | category | protect p95 | createPIIPacket p95 | replay p95 | token stable | hmac stable | raw leak | secret leak |
| --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
${publicRealRows.length > 0 ? publicRealRows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} | ${r[4]} | ${r[5]} | ${r[6]} | ${r[7]} | ${r[8]} |`).join("\n") : "| _none selected_ | - | - | - | - | - | - | - | - |"}

## Transform counts (first run sample)

| dataset | redact | mask | tok | hmac |
| --- | ---: | ---: | ---: | ---: |
${rows.map((r) => `| ${r.dataset} | ${(r as { redactCount: number }).redactCount} | ${(r as { maskCount: number }).maskCount} | ${(r as { tokenizeCount: number }).tokenizeCount} | ${(r as { hmacCount: number }).hmacCount} |`).join("\n")}

## Timing p50 / p95 / p99 (ms)

| dataset | protect | createPIIPacket | replay |
| --- | --- | --- | --- |
${rows
  .map(
    (r) =>
      `| ${r.dataset} | ${r.protectPII.p50Ms}/${r.protectPII.p95Ms}/${r.protectPII.p99Ms} | ${r.createPIIPacket.p50Ms}/${r.createPIIPacket.p95Ms}/${r.createPIIPacket.p99Ms} | ${r.replayPacket.p50Ms}/${r.replayPacket.p95Ms}/${r.replayPacket.p99Ms} |`,
  )
  .join("\n")}

## ops/sec (avg)

| dataset | protect | createPIIPacket | replay |
| --- | ---: | ---: | ---: |
${rows.map((r) => `| ${r.dataset} | ${r.protectPII.opsPerSec} | ${r.createPIIPacket.opsPerSec} | ${r.replayPacket.opsPerSec} |`).join("\n")}

## Reduction % (IntelPacket inner)

| dataset | reduction% |
| --- | ---: |
${rows.map((r) => `| ${r.dataset} | ${r.reductionPercent} |`).join("\n")}

## Memory Δ (approx, bytes)

| dataset | heapΔ | rssΔ |
| --- | ---: | ---: |
${rows.map((r) => `| ${r.dataset} | ${r.memory.heapDelta} | ${r.memory.rssDelta} |`).join("\n")}

## Leak & stability

All datasets: **secretLeakDetected=false**, **rawPIILeakDetected=false**, token/HMAC stability **true**, **verifySuccess**, **replaySuccess**.

${jsonOut.cli.strictScale ? `## Strict 100k validation

Strict scale was enabled for this run. The runner used **${recordCount.toLocaleString()}** users for each selected dataset with no soft cap.

| dataset | source | category | protect ops/sec | createPIIPacket ops/sec | replay ops/sec | token stable | hmac stable | replay | verify | raw leak | secret leak |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- |
${strictRows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} | ${r[4]} | ${r[5]} | ${r[6]} | ${r[7]} | ${r[8]} | ${r[9]} | ${r[10]} | ${r[11]} |`).join("\n")}

Total runtime: **${totalRuntimeMs} ms**. Throughput is expected to vary by dataset shape and transform count; token/HMAC stability, replay, verify, and leak checks are enforced by the runner.
` : ""}

## Limitations & non-goals

- **Not legal compliance**, **not encryption**, **not access control**.
- Heuristic detection is not exhaustive; this bench only checks **literal** reappearance of generated values.
- Timings vary by CPU and Node version.

---
*Regenerate: \`pnpm run bench:pii:advanced\` or root \`pnpm run bench:advanced\`.*
`;
}

try {
  run();
} catch (e) {
  console.error(e);
  process.exitCode = 1;
}
