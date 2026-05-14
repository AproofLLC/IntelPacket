# IntelPacket PII Benchmark Report

Machine-generated from **synthetic** JSON under `benchmarks/datasets/realistic/`. For regression visibility only.

## Methodology

- Policies are defined in `pii-realistic-bench.ts` (tokenize / mask / hmac paths aligned to each fixture).
- **Transform speed:** mean `protectPII` time over repeated runs.
- **Packet create speed:** mean `createPacket(protectedData)` (post-transform payload only).
- **Replay speed:** mean `replayPacket` on the produced IntelPacket.
- **Determinism:** two `protectPII` runs compared with `deepEqual` on transformed data.
- **Secrets:** fixed benchmark strings must not appear in serialized packet, report, or transformed payload strings.
- **Raw literals:** email-like substrings from the raw fixture text must not appear in those sinks after protection.
- **Replay integrity:** `createPacket(replay.normalized)` must reproduce the original `packet_hash`.

## Environment

| Field | Value |
| --- | --- |
| generatedAt | 2026-05-14T15:03:56.159Z |
| piiSpecVersion | 1 |
| node | v22.22.0 |
| platform | win32 |
| package | @intelpacket/pii 0.1.0 |

## Policy examples

Each dataset uses a **fail-closed** `PrivacyPolicyV1` with explicit `allow` paths covering transformed fields. See `policyFor()` in `pii-realistic-bench.ts`.

## Transform summaries

| dataset | transformMs | packetCreateMs | replayMs | reduction% | redact | mask | tok | hmac | tokStable | hmacStable | replay | secretLeak |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pii-api-responses | 3.547 | 1.591 | 0.687 | 83.9008 | 0 | 40 | 40 | 40 | true | true | true | false |
| pii-audit-events | 4.51 | 1.198 | 0.52 | 85.6598 | 0 | 70 | 140 | 0 | true | true | true | false |
| pii-telemetry-users | 10.348 | 2.329 | 1.04 | 83.422 | 0 | 0 | 180 | 180 | true | true | true | false |
| pii-transactions | 2.584 | 0.978 | 0.289 | 83.4103 | 0 | 50 | 50 | 50 | true | true | true | false |
| pii-user-records | 7.739 | 1.506 | 0.716 | 85.6279 | 0 | 60 | 120 | 60 | true | true | true | false |

## Deterministic token / HMAC validation

Two consecutive `protectPII` runs produced identical transformed payloads (`deterministicTokensStable` / `deterministicHmacStable` true for all rows).

## Replay verification

Round-trip `packet_hash` after `replayPacket` succeeded for all datasets.

## Compression summaries

`reduction%` is taken from the IntelPacket shell’s `compression.reduction_ratio` after `createPIIPacket`. High-entropy payloads may show low reduction.

## Security notes (benchmark scope only)

- Fixtures use obvious fake emails/phones/IDs; **no real PII**.
- Benchmark secrets are **synthetic** and must not appear in outputs (checked programmatically).
- This is **not** a penetration test or compliance assessment.

## Limitations

- Heuristic `detectPII` is not exercised exhaustively here.
- Timings vary by hardware and Node version.

## Non-goals

- **Not legal compliance**, **not encryption**, **not access control** — see product specs and `SECURITY.md`.

---
*Regenerate with `pnpm run bench:realistic` from `packages/pii`.*
