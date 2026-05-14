/**
 * Realistic PII benchmark: synthetic fixtures, protect + packet + replay,
 * leak checks, token/HMAC stability. Writes JSON + Markdown.
 *
 * Run from packages/pii: pnpm run bench:realistic
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPacket,
  protectPII,
  replayPacket,
  validatePrivacyPolicy,
  verifyIntelPacket,
  createPIIPacket,
  INTELPACKET_PII_SPEC_VERSION,
} from "../src/index.js";
import {
  assertNoSecretLeak,
  assertRawLiteralsAbsent,
  assertStableTransform,
  collectEmailLikeLiterals,
  getPiiEnvironment,
  markdownTable,
  meanMs,
} from "./pii-benchmark-utils.js";
import type { PrivacyPolicyV1 } from "../src/pii/types.js";

const root = dirname(fileURLToPath(import.meta.url));
const datasetsDir = join(root, "datasets", "realistic");
const outDir = join(root, "outputs");

/** Fixed synthetic secrets — never real credentials. */
const TOKEN_SECRET = "bench-pii-token-secret-32bytes-minimum!!";
const HMAC_SECRET = "bench-pii-hmac-secret-32bytes-minimum!!!";

const fixedCreatedAt = "2026-01-01T00:00:00.000Z";
const packOpts = { createdAt: fixedCreatedAt } as const;

function policyFor(dataset: string): PrivacyPolicyV1 {
  switch (dataset) {
    case "pii-api-responses":
      return validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        tokenize: ["responses[].user.email"],
        mask: ["responses[].user.phone"],
        hmac: ["responses[].billing.last4"],
        allow: [
          "responses[].request_id",
          "responses[].user.display_name",
          "responses[].user.email",
          "responses[].user.phone",
          "responses[].billing.last4",
          "responses[].billing.brand",
        ],
      });
    case "pii-user-records":
      return validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        tokenize: ["records[].contact_email", "records[].national_id"],
        mask: ["records[].mobile"],
        hmac: ["records[].legal_name"],
        allow: [
          "records[].user_id",
          "records[].legal_name",
          "records[].contact_email",
          "records[].mobile",
          "records[].national_id",
          "records[].address",
          "records[].address.line1",
          "records[].address.city",
          "records[].address.region",
          "records[].address.postal",
        ],
      });
    case "pii-transactions":
      return validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        tokenize: ["batch[].payer_email"],
        mask: ["batch[].pan_masked"],
        hmac: ["batch[].cardholder"],
        allow: [
          "batch[].reference",
          "batch[].payer_email",
          "batch[].cardholder",
          "batch[].pan_masked",
          "batch[].routing_last4",
        ],
      });
    case "pii-audit-events":
      return validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        tokenize: ["events[].subject_email", "events[].target_user"],
        mask: ["events[].ip"],
        allow: ["events[].id", "events[].subject_email", "events[].target_user", "events[].ip", "events[].detail"],
      });
    case "pii-telemetry-users":
      return validatePrivacyPolicy({
        version: "v1",
        mode: "fail-closed",
        tokenize: ["streams[].points[].session_owner"],
        hmac: ["streams[].points[].device_token"],
        allow: [
          "streams[].device",
          "streams[].points[].operator_id",
          "streams[].points[].session_owner",
          "streams[].points[].device_token",
          "streams[].points[].metric",
        ],
      });
    default:
      throw new Error(`No policy for dataset: ${dataset}`);
  }
}

type Row = {
  dataset: string;
  transformMs: number;
  packetCreateMs: number;
  replayMs: number;
  reductionPercent: number;
  redactCount: number;
  maskCount: number;
  tokenizeCount: number;
  hmacCount: number;
  deterministicTokensStable: boolean;
  deterministicHmacStable: boolean;
  replaySuccess: boolean;
  secretLeakDetected: boolean;
};

function run(): void {
  mkdirSync(outDir, { recursive: true });
  const names = readdirSync(datasetsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (names.length === 0) throw new Error(`No datasets in ${datasetsDir}`);

  const rows: Row[] = [];

  for (const file of names) {
    const dataset = file.replace(/\.json$/i, "");
    const rawText = readFileSync(join(datasetsDir, file), "utf8");
    const data: unknown = JSON.parse(rawText);
    const policy = policyFor(dataset);

    const literals = collectEmailLikeLiterals(rawText);
    const secrets = [TOKEN_SECRET, HMAC_SECRET];

    const a = protectPII(data, policy, { tokenSecret: TOKEN_SECRET, hmacSecret: HMAC_SECRET });
    const b = protectPII(data, policy, { tokenSecret: TOKEN_SECRET, hmacSecret: HMAC_SECRET });
    assertStableTransform(a.data, b.data, dataset);

    const transformMs = meanMs(() => {
      protectPII(data, policy, { tokenSecret: TOKEN_SECRET, hmacSecret: HMAC_SECRET });
    }, 15);

    const protectedOnce = protectPII(data, policy, { tokenSecret: TOKEN_SECRET, hmacSecret: HMAC_SECRET });
    const packetCreateMs = meanMs(() => {
      createPacket(protectedOnce.data, packOpts);
    }, 15);

    const { packet, privacy } = createPIIPacket(data, policy, {
      tokenSecret: TOKEN_SECRET,
      hmacSecret: HMAC_SECRET,
      packetOptions: packOpts,
    });

    if (!verifyIntelPacket(packet)) {
      throw new Error(`[${dataset}] verifyIntelPacket failed`);
    }

    const replay = replayPacket(packet);
    const repacked = createPacket(replay.normalized, packOpts);
    if (repacked.packet_hash !== packet.packet_hash) {
      throw new Error(`[${dataset}] replay round-trip packet_hash mismatch`);
    }

    const replayMs = meanMs(() => {
      replayPacket(packet);
    }, 15);

    const sink =
      JSON.stringify(packet) +
      JSON.stringify(privacy) +
      JSON.stringify(protectedOnce.data) +
      JSON.stringify(a.report);
    assertNoSecretLeak(sink, secrets, dataset);
    assertRawLiteralsAbsent(sink, literals, dataset);

    const reductionPercent = Math.round(packet.compression.reduction_ratio * 1e6) / 1e4;

    rows.push({
      dataset,
      transformMs: Math.round(transformMs * 1000) / 1000,
      packetCreateMs: Math.round(packetCreateMs * 1000) / 1000,
      replayMs: Math.round(replayMs * 1000) / 1000,
      reductionPercent,
      redactCount: a.report.fields_redacted.length,
      maskCount: a.report.fields_masked.length,
      tokenizeCount: a.report.fields_tokenized.length,
      hmacCount: a.report.fields_hmac.length,
      deterministicTokensStable: true,
      deterministicHmacStable: true,
      replaySuccess: true,
      secretLeakDetected: false,
    });
  }

  const generatedAt = new Date().toISOString();
  const jsonOut = {
    piiSpecVersion: INTELPACKET_PII_SPEC_VERSION,
    generatedAt,
    environment: getPiiEnvironment(),
    datasets: rows.sort((a, b) => a.dataset.localeCompare(b.dataset)),
  };

  const jsonText = JSON.stringify(jsonOut, null, 2) + "\n";
  writeFileSync(join(root, "pii-benchmark-results.json"), jsonText, "utf8");
  writeFileSync(join(outDir, "pii-benchmark-results.json"), jsonText, "utf8");

  const md = buildPiiMarkdown(jsonOut, rows);
  writeFileSync(join(root, "PII_BENCHMARK_REPORT.md"), md, "utf8");
  writeFileSync(join(outDir, "PII_BENCHMARK_REPORT.md"), md, "utf8");

  console.log("Wrote pii-benchmark-results.json, PII_BENCHMARK_REPORT.md");
}

function buildPiiMarkdown(
  jsonOut: { piiSpecVersion: string; generatedAt: string; environment: Record<string, string> },
  rows: Row[],
): string {
  const env = jsonOut.environment;
  const table = markdownTable(
    [
      "dataset",
      "transformMs",
      "packetCreateMs",
      "replayMs",
      "reduction%",
      "redact",
      "mask",
      "tok",
      "hmac",
      "tokStable",
      "hmacStable",
      "replay",
      "secretLeak",
    ],
    rows.map((r) => [
      r.dataset,
      r.transformMs,
      r.packetCreateMs,
      r.replayMs,
      r.reductionPercent,
      r.redactCount,
      r.maskCount,
      r.tokenizeCount,
      r.hmacCount,
      r.deterministicTokensStable,
      r.deterministicHmacStable,
      r.replaySuccess,
      r.secretLeakDetected,
    ]),
  );

  return `# IntelPacket PII Benchmark Report

Machine-generated from **synthetic** JSON under \`benchmarks/datasets/realistic/\`. For regression visibility only.

## Methodology

- Policies are defined in \`pii-realistic-bench.ts\` (tokenize / mask / hmac paths aligned to each fixture).
- **Transform speed:** mean \`protectPII\` time over repeated runs.
- **Packet create speed:** mean \`createPacket(protectedData)\` (post-transform payload only).
- **Replay speed:** mean \`replayPacket\` on the produced IntelPacket.
- **Determinism:** two \`protectPII\` runs compared with \`deepEqual\` on transformed data.
- **Secrets:** fixed benchmark strings must not appear in serialized packet, report, or transformed payload strings.
- **Raw literals:** email-like substrings from the raw fixture text must not appear in those sinks after protection.
- **Replay integrity:** \`createPacket(replay.normalized)\` must reproduce the original \`packet_hash\`.

## Environment

| Field | Value |
| --- | --- |
| generatedAt | ${jsonOut.generatedAt} |
| piiSpecVersion | ${jsonOut.piiSpecVersion} |
| node | ${env.node} |
| platform | ${env.platform} |
| package | ${env.packageName} ${env.packageVersion} |

## Policy examples

Each dataset uses a **fail-closed** \`PrivacyPolicyV1\` with explicit \`allow\` paths covering transformed fields. See \`policyFor()\` in \`pii-realistic-bench.ts\`.

## Transform summaries

${table}

## Deterministic token / HMAC validation

Two consecutive \`protectPII\` runs produced identical transformed payloads (\`deterministicTokensStable\` / \`deterministicHmacStable\` true for all rows).

## Replay verification

Round-trip \`packet_hash\` after \`replayPacket\` succeeded for all datasets.

## Compression summaries

\`reduction%\` is taken from the IntelPacket shell’s \`compression.reduction_ratio\` after \`createPIIPacket\`. High-entropy payloads may show low reduction.

## Security notes (benchmark scope only)

- Fixtures use obvious fake emails/phones/IDs; **no real PII**.
- Benchmark secrets are **synthetic** and must not appear in outputs (checked programmatically).
- This is **not** a penetration test or compliance assessment.

## Limitations

- Heuristic \`detectPII\` is not exercised exhaustively here.
- Timings vary by hardware and Node version.

## Non-goals

- **Not legal compliance**, **not encryption**, **not access control** — see product specs and \`SECURITY.md\`.

---
*Regenerate with \`pnpm run bench:realistic\` from \`packages/pii\`.*
`;
}

try {
  run();
} catch (e) {
  console.error(e);
  process.exitCode = 1;
}
