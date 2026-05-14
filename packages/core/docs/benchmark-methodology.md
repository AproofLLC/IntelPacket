# Benchmark methodology

Benchmarks live in `benchmarks/compression-bench.ts` and optionally use JSON fixtures under `benchmarks/datasets/` (regenerate with `node benchmarks/datasets/build.mjs`).

## What is measured

- **raw JSON bytes**: UTF-8 length of `JSON.stringify(data)`.
- **canonical bytes**: UTF-8 length after `normalizeTypes` then `canonicalStringify`.
- **compacted / deduped**: UTF-8 length of canonical forms after `compactSchema` and dedupe envelope `{ root, refs }`.
- **delta bytes**: when a `previous` snapshot is provided, UTF-8 length of `canonicalStringify(diffPackets(...))` (patch metadata size for comparison — v0.1 still encodes the **full** next state in the packet, not a delta-only payload).
- **compressed sizes**: Brotli/zlib via `compressPacket` on canonical and dedupe-envelope strings.
- **Timings**: `performance.now()` around normalize/compact/dedupe, `createPacket`, hashing the inner envelope, and `replayPacket`.
- **Memory hint**: sum of stage UTF-8 sizes only — **not** RSS; useful for relative comparison only.

## Datasets

Fixtures approximate repeated telemetry, API-style events, transactions with shared schema fragments, nested configuration, and repeated log lines. They are synthetic and deterministic.

## Reproducibility

Run on a quiet machine; timings vary by CPU and Node version. Byte counts and hashes are stable for a given `ip_version` and library version.
