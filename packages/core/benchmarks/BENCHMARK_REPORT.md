# IntelPacket Core Benchmark Report

This report is **machine-generated** from synthetic fixtures under `benchmarks/datasets/realistic/`.
It is intended for **reproducible regression tracking**, not competitive marketing claims.

## Methodology

- Each dataset is loaded as JSON, then processed with `createPacket` (full pipeline: normalize → canonicalize → compact → dedupe → compress → hash).
- **Determinism:** five consecutive `createPacket` calls with a fixed `createdAt` must yield identical `packet_hash` values.
- **Replay:** `replayPacket` must succeed; **round-trip integrity:** `createPacket(replay.normalized, same options)` reproduces the original `packet_hash`.
- **Verify:** `verifyIntelPacket` must return `true` for the produced packet.
- **Timing:** mean milliseconds over multiple iterations after warm-up (`performance.now`).

## Environment

| Field | Value |
| --- | --- |
| generatedAt | 2026-05-14T15:03:54.418Z |
| specVersion | 1 |
| node | v22.22.0 |
| platform | win32 |
| arch | x64 |
| package | @intelpacket/core 0.1.0 |

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

| dataset | rawBytes | canonical(inner)Bytes | packetBytes | compressedPayloadBytes | reduction% | createMs | replayMs | verifyMs | determinism | replay | verify |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| api-responses | 30797 | 10212 | 3712 | 900 | 91.1868 | 2.373 | 1.331 | 0.279 | ok | ok | ok |
| app-logs | 44755 | 30959 | 2196 | 1361 | 95.6039 | 2.876 | 1.708 | 0.405 | ok | ok | ok |
| audit-trails | 33880 | 20161 | 1955 | 1112 | 94.4844 | 2.069 | 1.343 | 0.304 | ok | ok | ok |
| config-snapshots | 13843 | 6664 | 1280 | 525 | 92.1218 | 1.209 | 0.623 | 0.145 | ok | ok | ok |
| otel-traces | 97662 | 33986 | 5502 | 1430 | 95.7924 | 5.102 | 3.042 | 0.627 | ok | ok | ok |
| telemetry | 36318 | 23582 | 2492 | 1584 | 93.283 | 2.272 | 1.433 | 0.335 | ok | ok | ok |
| transactions | 35024 | 14269 | 2330 | 1018 | 92.8657 | 1.992 | 1.051 | 0.212 | ok | ok | ok |

## Reduction summaries

- **reduction%** comes from the packet’s own `compression.reduction_ratio` (documented semantics in IntelPacket Spec v1).
- Results **vary strongly with dataset entropy**. Highly repetitive structured JSON tends to compress well; random or already-compressed payloads compress poorly.
- IntelPacket improves compressibility through **deterministic structural normalization** (canonical key order, optional compaction/dedupe) before compression — not through semantic intelligence.

## Replay verification

All listed datasets: **replay = ok** (`createPacket(replay.normalized)` matched original `packet_hash`).

## Determinism validation

All listed datasets: **determinism = ok** (five consecutive hashes matched).

## Important notes

- Timings are environment-dependent (CPU, Node version, OS).
- This benchmark does **not** include network, disk I/O, or transport overhead.
- `packetBytes` is the UTF-8 size of `JSON.stringify(packet)` as a coarse outer-size proxy.

## Limitations

- Datasets are moderate size to keep CI/dev loops fast.
- No GPU or WASM codecs are involved (Node zlib/brotli only).

## Non-goals

- Not a compliance, security certification, or penetration test.
- Not a guarantee of production latency or throughput.

---
*Regenerate with `pnpm run bench:realistic` from `packages/core`.*
