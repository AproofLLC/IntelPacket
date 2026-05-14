# PII benchmarks

| Script | Purpose |
|--------|---------|
| `pnpm run bench:pii` | Multi-industry synthetic row throughput (`pii-bench.ts`). |
| `pnpm run bench:realistic` | **Synthetic PII-shaped JSON** → `protectPII` + `createPIIPacket` + replay round-trip → leak checks → `pii-benchmark-results.json`, `PII_BENCHMARK_REPORT.md`, and copies under `outputs/`. |
| `pnpm run bench:advanced` | Advanced CLI bench: percentiles, memory, leak scans, token/HMAC stability → `advanced/outputs/pii-advanced-results.json`, `PII_ADVANCED_REPORT.md`. Flags: `--scale=10k\|100k\|1m`, `--iterations=N`, `--strict-scale`. |
| `pnpm run datasets:realistic` | Regenerate fixtures in `datasets/realistic/` (fake emails, phones, IDs only). |

## Reports

- [PII_BENCHMARK_REPORT.md](./PII_BENCHMARK_REPORT.md)
- [pii-benchmark-results.json](./pii-benchmark-results.json)
- [advanced/outputs/PII_ADVANCED_REPORT.md](./advanced/outputs/PII_ADVANCED_REPORT.md)

## Validation

`bench:realistic` fails if benchmark secrets appear in serialized outputs, if raw email literals from fixtures survive protection, if `protectPII` is unstable across two runs, or if replay `packet_hash` round-trip fails.

## Non-goals

Not compliance certification, encryption review, or access-control testing.
