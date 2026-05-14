# IntelPacket Core — Advanced Benchmark Report

Generated: **2026-05-14T17:38:43.367Z**

## Methodology

- Synthetic **entropy-class** datasets at fixed scales (see `entropy-datasets.ts`), seeded deterministic PRNG for high-entropy payloads.
- **Scale:** `--scale` names a stress tier (10k / 100k / 1m requested records). Without `--strict-scale`, large tiers use a **soft row cap** so runs stay feasible — JSON `cli` reports `scaleRequested` vs `recordCount`.
- Timings collected over **10** timed iterations per operation (requested: **10**; capped for large payloads). After implicit warm-up on first `createPacket` in determinism block.
- Percentiles (**p50 / p95 / p99**) use **linear interpolation** on sorted samples (`stats.ts`).
- **gzip / brotli** baselines: Node `zlib.gzipSync` / `zlib.brotliCompressSync` on the **same raw JSON UTF-8** string as IntelPacket input (best-effort comparison, not a wire-format contest).
- **IntelPacket reduction%** is the packet’s own `compression.reduction_ratio` (inner canonical UTF-8 vs compressed payload).
- **intelPacketVsGzipPercent** / **intelPacketVsBrotliPercent**: (100 \times (1 - \frac{\text{IntelPacket compressed payload}}{\text{gzip/brotli bytes}})\). Positive means the **compressed inner payload** is smaller than raw-json gzip/brotli.
- **Full packet** JSON size often exceeds gzip/brotli of raw JSON because of metadata, base64, refs mirrors — see JSON fields `intelPacketPacketVsGzipPercent` / `intelPacketPacketVsBrotliPercent` (often negative; that is expected and not a failure).

## Environment & CLI

| Field | Value |
| --- | --- |
| scale mode | 100k |
| dataset set | all |
| records requested | 100,000 |
| records used | 100,000 |
| iterations (requested) | 10 |
| timing samples / op | 10 |
| Node | v22.22.2 |
| platform | win32 |
| total runtime ms | 989745.03 |


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
| github-api | api | public-real | 99.1884 | 2560.8025 | 1744.2681 | 466.0309 |
| kubernetes-events | telemetry | public-real | 98.9035 | 1315.4064 | 964.2199 | 321.6763 |
| otel-public-traces | trace | public-real | 98.6623 | 1795.6329 | 1361.0593 | 413.4644 |
| cloud-audit-samples | audit | public-real | 99.0713 | 1591.4341 | 1226.8327 | 350.003 |
| webhook-events | webhook | public-real | 99.0461 | 1905.689 | 1272.9789 | 406.1551 |
| blockchain-transactions | transaction | public-real | 98.5988 | 1978.8553 | 1356.325 | 428.7328 |
| config-snapshots-public | config | public-real | 99.238 | 3786.6869 | 2679.9831 | 534.9129 |

## Reduction & baseline comparison (%)

| entropy | intel inner % | gzip raw % | brotli raw % | payload vs gzip | payload vs brotli |
| --- | ---: | ---: | ---: | ---: | ---: |
| low | 99.9682 | 98.3708 | 99.9976 | 99.501 | -233.3333 |
| medium | 92.5423 | 83.9462 | 96.7532 | 52.3714 | -135.4975 |
| high | 56.5143 | 54.4459 | 64.9351 | 4.5399 | -24.0157 |
| nested-low | 99.9803 | 98.9304 | 99.9981 | 99.4466 | -213.7931 |
| nested-high | 69.4765 | 66.3986 | 77.9625 | 9.1593 | -38.508 |
| public-real | 99.1884 | 98.3284 | 99.2561 | 59.8722 | 9.8252 |
| public-real | 98.9035 | 97.3497 | 98.9785 | 58.626 | -7.3469 |
| public-real | 98.6623 | 95.8371 | 98.6185 | 67.8667 | 3.1718 |
| public-real | 99.0713 | 97.6041 | 99.1177 | 61.2367 | -5.2568 |
| public-real | 99.0461 | 97.8224 | 99.078 | 56.194 | -3.4633 |
| public-real | 98.5988 | 96.5229 | 98.1979 | 59.7008 | 22.2455 |
| public-real | 99.238 | 98.6059 | 99.3361 | 59.9678 | 15.9416 |

## Timing ms — p50 / p95 / p99

| entropy | create p50/p95/p99 | replay p50/p95/p99 | verify p50/p95/p99 |
| --- | --- | --- | --- |
| low | 1049.6382/1330.298/1333.6082 | 1021.3136/1194.4361/1225.1204 | 70.0055/85.9449/86.1559 |
| medium | 1572.2154/1916.9476/2048.2306 | 1002.0168/1077.8672/1084.9394 | 236.8806/342.0174/361.0048 |
| high | 2023.4868/2376.2948/2507.6461 | 1000.7495/1157.0809/1218.2394 | 365.1816/525.04/601.9106 |
| nested-low | 1488.3868/1811.3873/1928.9284 | 1244.5161/1430.2096/1475.5682 | 50.4204/77.6119/83.7994 |
| nested-high | 3821.3578/4148.2836/4276.5239 | 2070.4321/2532.346/2612.9297 | 597.6702/727.6298/793.5288 |
| public-real | 2255.8669/2560.8025/2644.0019 | 1574.2009/1744.2681/1755.6177 | 294.8058/466.0309/552.6827 |
| public-real | 1077.2937/1315.4064/1338.7797 | 761.0809/964.2199/1048.8 | 260.5053/321.6763/323.9724 |
| public-real | 1713.6718/1795.6329/1837.228 | 1213.3342/1361.0593/1439.9349 | 323.5689/413.4644/453.8079 |
| public-real | 1494.3505/1591.4341/1632.9009 | 1067.9637/1226.8327/1278.4193 | 270.7585/350.003/384.4985 |
| public-real | 1608.3059/1905.689/2035.8164 | 1152.9646/1272.9789/1325.5715 | 323.1457/406.1551/435.7826 |
| public-real | 1793.7006/1978.8553/2083.8609 | 1271.1983/1356.325/1358.1512 | 334.5912/428.7328/467.2878 |
| public-real | 3330.9578/3786.6869/3889.9805 | 2390.9439/2679.9831/2806.838 | 507.0383/534.9129/538.7482 |

## ops/sec (from avg ms)

| entropy | create | replay | verify | canonicalize |
| --- | ---: | ---: | ---: | ---: |
| low | 0.8952 | 0.9611 | 13.6082 | 12.8444 |
| medium | 0.6187 | 0.986 | 4.0857 | 14.4613 |
| high | 0.4831 | 0.9708 | 2.6558 | 23.5987 |
| nested-low | 0.6504 | 0.8083 | 17.2902 | 6.308 |
| nested-high | 0.2632 | 0.4567 | 1.669 | 9.311 |
| public-real | 0.4345 | 0.6221 | 3.2428 | 10.4513 |
| public-real | 0.9027 | 1.2867 | 3.8943 | 9.2204 |
| public-real | 0.5839 | 0.8068 | 2.9722 | 14.3435 |
| public-real | 0.6671 | 0.9197 | 3.5014 | 15.4845 |
| public-real | 0.603 | 0.8524 | 3.005 | 14.666 |
| public-real | 0.55 | 0.7802 | 2.8532 | 12.3455 |
| public-real | 0.2963 | 0.4111 | 1.9691 | 6.0528 |

## Memory (approximate; kB delta after short burst)

| entropy | heapΔ kB | rssΔ kB |
| --- | ---: | ---: |
| low | -37608 | 127864 |
| medium | 207274 | 68728 |
| high | 146912 | 104112 |
| nested-low | 372382 | 108272 |
| nested-high | 1072915 | 347564 |
| public-real | 470067 | 197920 |
| public-real | 781090 | 233924 |
| public-real | -111816 | 8616 |
| public-real | -120066 | 13208 |
| public-real | -99048 | 25804 |
| public-real | -6183 | 53980 |
| public-real | 750666 | 274544 |

## Determinism & replay

All rows: **deterministicStable**, **replaySuccess**, **verifySuccess** — benchmark **fails** if any are false (enforced in runner).

## Strict 100k validation

Strict scale was enabled for this run. The runner used **100,000** records for each selected dataset with no soft cap.

| dataset | source | category | create ops/sec | replay ops/sec | verify ops/sec | heap delta kB | deterministic | replay | verify |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| low | synthetic | telemetry | 0.8952 | 0.9611 | 13.6082 | -37608 | true | true | true |
| medium | synthetic | telemetry | 0.6187 | 0.986 | 4.0857 | 207274 | true | true | true |
| high | synthetic | transaction | 0.4831 | 0.9708 | 2.6558 | 146912 | true | true | true |
| nested-low | synthetic | config | 0.6504 | 0.8083 | 17.2902 | 372382 | true | true | true |
| nested-high | synthetic | trace | 0.2632 | 0.4567 | 1.669 | 1072915 | true | true | true |
| github-api | public-real | api | 0.4345 | 0.6221 | 3.2428 | 470067 | true | true | true |
| kubernetes-events | public-real | telemetry | 0.9027 | 1.2867 | 3.8943 | 781090 | true | true | true |
| otel-public-traces | public-real | trace | 0.5839 | 0.8068 | 2.9722 | -111816 | true | true | true |
| cloud-audit-samples | public-real | audit | 0.6671 | 0.9197 | 3.5014 | -120066 | true | true | true |
| webhook-events | public-real | webhook | 0.603 | 0.8524 | 3.005 | -99048 | true | true | true |
| blockchain-transactions | public-real | transaction | 0.55 | 0.7802 | 2.8532 | -6183 | true | true | true |
| config-snapshots-public | public-real | config | 0.2963 | 0.4111 | 1.9691 | 750666 | true | true | true |

Total runtime: **989745.03 ms**. Throughput varies by dataset shape and entropy; high-cardinality transaction/trace-like workloads are expected to show less compression and lower throughput than repetitive telemetry/config workloads.


## Limitations & non-goals

- Compression **varies strongly by entropy**; random-looking JSON may barely compress.
- IntelPacket is **structure-aware packetization** (canonical form, dedupe, compaction, hashing, replay) — **not magic compression**.
- Not a load test SLA, not security certification, not production tuning advice.

---
*Regenerate: `pnpm run bench:advanced` (root) or `pnpm run bench:advanced` in `packages/core`.*
