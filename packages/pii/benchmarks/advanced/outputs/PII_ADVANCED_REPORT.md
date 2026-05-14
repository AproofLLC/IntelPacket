# IntelPacket PII — Advanced Benchmark Report

Generated: **2026-05-14T18:58:00.784Z**

## Methodology

- **Synthetic fake PII only** (`@example.invalid`, `555-*` phones, synthetic IDs) — see `pii-entropy-datasets.ts`.
- Same **entropy classes** as core advanced bench for comparability.
- **Scale:** `--scale` selects a *stress class* (10k / 100k / 1m nominal users). Unless `--strict-scale` is set, the runner may use fewer users so the suite completes — see Environment table and JSON `cli.scaleRequested` vs `cli.recordCount`.
- Timing sample counts (capped for very large payloads): protect=1, createPIIPacket=1, replay=1 (requested iterations: 1). **p50/p95/p99** via linear interpolation on sorted samples.
- **Leak scan:** benchmark secrets + raw field literals from generated rows must not appear in serialized packet, privacy report, or transformed payload strings.
- **Stability:** two `protectPII` runs must yield identical transformed JSON.
- **Replay:** `createPacket(replay.normalized)` must match original `packet_hash`.

## Policy

fail-closed v1; tokenize users[].email + users[].national_id; mask users[].phone; hmac users[].legal_name; synthetic secrets only

## Environment & CLI

| Field | Value |
| --- | --- |
| scale mode | 10k |
| dataset set | all |
| users requested | 10,000 |
| users used | 2,500 |
| strict-scale | false |
| iterations (requested) | 1 |
| timing samples (protect / packet / replay) | 1 / 1 / 1 |
| Node | v22.22.2 |
| total runtime ms | 231120.1 |

> **Soft cap:** Soft-cap: 2,500 rows for 10k-class scale unless --strict-scale (full 10,000). Use `--strict-scale` for the full requested user count (may be very slow).


## Public-real safe datasets

Public-real safe PII datasets exercise generated profile, webhook, support-ticket, and audit-user shapes with fake identities only. They help catch policy and leak-scan behavior that pure entropy classes can miss, while remaining public-safe and free of private or sensitive user data. They still are not identical to private production traffic; performance and transform counts remain policy-dependent.

| dataset | category | protect p95 | createPIIPacket p95 | replay p95 | token stable | hmac stable | raw leak | secret leak |
| --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| sanitized-user-records | api | 4490.0752 | 4546.9481 | 35.4255 | true | true | false | false |
| public-webhook-users | webhook | 4566.0882 | 4537.2875 | 31.3275 | true | true | false | false |
| fake-support-tickets | api | 4609.7611 | 4697.0006 | 40.2711 | true | true | false | false |
| synthetic-audit-users | audit | 4570.7174 | 4594.0973 | 37.0657 | true | true | false | false |

## Transform counts (first run sample)

| dataset | redact | mask | tok | hmac |
| --- | ---: | ---: | ---: | ---: |
| low | 0 | 2500 | 5000 | 2500 |
| medium | 0 | 2500 | 5000 | 2500 |
| high | 0 | 2500 | 5000 | 2500 |
| nested-low | 0 | 2500 | 5000 | 2500 |
| nested-high | 0 | 2500 | 5000 | 2500 |
| sanitized-user-records | 0 | 2500 | 5000 | 2500 |
| public-webhook-users | 0 | 2500 | 5000 | 2500 |
| fake-support-tickets | 0 | 2500 | 5000 | 2500 |
| synthetic-audit-users | 0 | 2500 | 5000 | 2500 |

## Timing p50 / p95 / p99 (ms)

| dataset | protect | createPIIPacket | replay |
| --- | --- | --- | --- |
| low | 2535.5682/2535.5682/2535.5682 | 2436.2745/2436.2745/2436.2745 | 32.5857/32.5857/32.5857 |
| medium | 2334.9072/2334.9072/2334.9072 | 2369.3517/2369.3517/2369.3517 | 27.9097/27.9097/27.9097 |
| high | 2427.3783/2427.3783/2427.3783 | 2462.7774/2462.7774/2462.7774 | 28.0077/28.0077/28.0077 |
| nested-low | 2345.6167/2345.6167/2345.6167 | 2406.9987/2406.9987/2406.9987 | 28.2268/28.2268/28.2268 |
| nested-high | 2334.9931/2334.9931/2334.9931 | 2344.3978/2344.3978/2344.3978 | 31.0038/31.0038/31.0038 |
| sanitized-user-records | 4490.0752/4490.0752/4490.0752 | 4546.9481/4546.9481/4546.9481 | 35.4255/35.4255/35.4255 |
| public-webhook-users | 4566.0882/4566.0882/4566.0882 | 4537.2875/4537.2875/4537.2875 | 31.3275/31.3275/31.3275 |
| fake-support-tickets | 4609.7611/4609.7611/4609.7611 | 4697.0006/4697.0006/4697.0006 | 40.2711/40.2711/40.2711 |
| synthetic-audit-users | 4570.7174/4570.7174/4570.7174 | 4594.0973/4594.0973/4594.0973 | 37.0657/37.0657/37.0657 |

## ops/sec (avg)

| dataset | protect | createPIIPacket | replay |
| --- | ---: | ---: | ---: |
| low | 0.3944 | 0.4105 | 30.6883 |
| medium | 0.4283 | 0.4221 | 35.8298 |
| high | 0.412 | 0.406 | 35.7045 |
| nested-low | 0.4263 | 0.4155 | 35.4273 |
| nested-high | 0.4283 | 0.4265 | 32.2541 |
| sanitized-user-records | 0.2227 | 0.2199 | 28.2283 |
| public-webhook-users | 0.219 | 0.2204 | 31.9208 |
| fake-support-tickets | 0.2169 | 0.2129 | 24.8317 |
| synthetic-audit-users | 0.2188 | 0.2177 | 26.9791 |

## Reduction % (IntelPacket inner)

| dataset | reduction% |
| --- | ---: |
| low | 0 |
| medium | 0 |
| high | 0 |
| nested-low | 0 |
| nested-high | 0 |
| sanitized-user-records | 0 |
| public-webhook-users | 0 |
| fake-support-tickets | 0 |
| synthetic-audit-users | 0 |

## Memory Δ (approx, bytes)

| dataset | heapΔ | rssΔ |
| --- | ---: | ---: |
| low | 17127136 | 15020032 |
| medium | -13036648 | -1159168 |
| high | 3942616 | 12750848 |
| nested-low | -128261232 | -28753920 |
| nested-high | 11479888 | 5234688 |
| sanitized-user-records | -120902736 | -27848704 |
| public-webhook-users | 20076240 | 3604480 |
| fake-support-tickets | -17405000 | -1015808 |
| synthetic-audit-users | 3550144 | 3809280 |

## Leak & stability

All datasets: **secretLeakDetected=false**, **rawPIILeakDetected=false**, token/HMAC stability **true**, **verifySuccess**, **replaySuccess**.



## Limitations & non-goals

- **Not legal compliance**, **not encryption**, **not access control**.
- Heuristic detection is not exhaustive; this bench only checks **literal** reappearance of generated values.
- Timings vary by CPU and Node version.

---
*Regenerate: `pnpm run bench:pii:advanced` or root `pnpm run bench:advanced`.*
