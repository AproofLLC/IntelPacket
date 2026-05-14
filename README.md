# IntelPacket Suite

[![CI](https://github.com/AproofLLC/IntelPacket/actions/workflows/ci.yml/badge.svg)](https://github.com/AproofLLC/IntelPacket/actions/workflows/ci.yml)

Deterministic structured-data packetization and integrity tooling for Node.js. Optional privacy preprocessing (`@intelpacket/pii`) runs **before** the core engine (`@intelpacket/core`) so packets stay canonical, hashed, and replay-verifiable without coupling the layers.

```text
raw data
  → optional @intelpacket/pii
  → @intelpacket/core
  → deterministic IntelPacket
```

## Packages

| Package | Install | Purpose |
|---|---|---|
| [`@intelpacket/core`](./packages/core/) | `npm install @intelpacket/core` | Deterministic packetization, canonicalization, replay verification, deduplication, compaction, hashing, and integrity engine |
| [`@intelpacket/pii`](./packages/pii/) | `npm install @intelpacket/pii` | Policy-driven privacy preprocessing layer built on top of `@intelpacket/core` |

`@intelpacket/pii` depends on `@intelpacket/core`.
`@intelpacket/core` does not depend on `@intelpacket/pii`.

## Features

- **Deterministic** canonical JSON-like processing and stable hashes for supported inputs.
- **Lossless replay** for full inner envelopes (refs expanded from inner `refs` only).
- **Resource limits** and fail-closed verification helpers.
- **Optional PII layer** with explicit secrets for token/HMAC transforms (never written into reports).

## Integrity Hardening

The backend hardening suite locks deterministic golden vectors and stresses tamper handling, malformed JSON-like inputs, schema drift, version compatibility, concurrency, soak smoke behavior, npm pack smoke checks, and benchmark smoke gates. The PII package adds leak matrices, policy fuzzing, nested attack coverage, secret leak checks, concurrency, and soak smoke tests using fake data only.

Run:

```bash
pnpm run test:integrity
pnpm run verify:integrity
```

Strict 100k advanced benchmarks are manual only:

```bash
pnpm run bench:advanced:strict:100k
```

## Spec v1

- Limitations & non-goals: [docs/LIMITATIONS.md](./docs/LIMITATIONS.md)
- Index: [docs/SPEC_INDEX.md](./docs/SPEC_INDEX.md)
- Core: [packages/core/docs/intelpacket-spec-v1.md](./packages/core/docs/intelpacket-spec-v1.md)
- PII: [packages/pii/docs/intelpacket-pii-spec-v1.md](./packages/pii/docs/intelpacket-pii-spec-v1.md)
- Public API summary: [docs/API_REFERENCE.md](./docs/API_REFERENCE.md)

## Installation

```bash
npm install @intelpacket/core
npm install @intelpacket/pii
```

Optional pnpm/yarn equivalents:

```bash
pnpm add @intelpacket/core
pnpm add @intelpacket/pii
yarn add @intelpacket/core
yarn add @intelpacket/pii
```

Requires **Node.js 18+** (CI exercises Node 20).

## Quick start

```typescript
import { createPacket, replayPacket, verifyIntelPacket } from "@intelpacket/core";

const packet = createPacket({ id: 1, name: "alpha" }, { disableCompression: true });
if (!verifyIntelPacket(packet)) throw new Error("invalid packet");
const { expanded } = replayPacket(packet);
```

With PII:

```typescript
import { createPIIPacket, validatePrivacyPolicy } from "@intelpacket/pii";

const policy = validatePrivacyPolicy({
  version: "v1",
  redact: ["secret"],
  allow: ["id", "secret"],
});

const { packet } = createPIIPacket(
  { id: 1, secret: "hunter2" },
  policy,
  { packetOptions: { disableCompression: true } },
);
```

Runnable monorepo examples (from repo root, after `pnpm install`):

```bash
pnpm exec tsx examples/core/basic-packet.ts
pnpm exec tsx examples/pii/create-pii-packet.ts
```

## Verification

```bash
pnpm install
pnpm run verify:structure
pnpm run verify
pnpm run pack:dry
```

Per-package release dry-run:

```bash
cd packages/core && npm pack --dry-run
cd ../pii && npm pack --dry-run
```

## Benchmarks

**Dataset throughput (existing):**

```bash
pnpm run bench:core
pnpm run bench:core:50x
pnpm run bench:pii
```

**Realistic synthetic fixtures + proof reports** (determinism, verify, replay round-trip; PII leak checks):

```bash
pnpm run bench:realistic
```

Outputs:

- Core: [packages/core/benchmarks/BENCHMARK_REPORT.md](./packages/core/benchmarks/BENCHMARK_REPORT.md) · [benchmark-results.json](./packages/core/benchmarks/benchmark-results.json)
- PII: [packages/pii/benchmarks/PII_BENCHMARK_REPORT.md](./packages/pii/benchmarks/PII_BENCHMARK_REPORT.md) · [pii-benchmark-results.json](./packages/pii/benchmarks/pii-benchmark-results.json)

Regenerate JSON fixtures (still synthetic-only):

```bash
pnpm --filter @intelpacket/core run datasets:realistic
pnpm --filter @intelpacket/pii run datasets:realistic
```

See [packages/core/benchmarks/README.md](./packages/core/benchmarks/README.md) and [packages/pii/benchmarks/README.md](./packages/pii/benchmarks/README.md) for methodology, determinism validation, and replay validation rules.

**Advanced CLI benchmarks** (p50/p95/p99, ops/sec, heap/RSS deltas, entropy-class synthetic data, gzip/brotli baselines on core; PII leak + token/HMAC stability):

```bash
pnpm run bench:advanced
pnpm run bench:advanced:100k
```

For the full row count implied by `--scale=10k` / `100k` / `1m` (can be very slow), pass `--strict-scale` through the package filter, e.g. `pnpm run bench:core:advanced -- --scale=10k --strict-scale`.

- Core report: [packages/core/benchmarks/advanced/outputs/CORE_ADVANCED_REPORT.md](./packages/core/benchmarks/advanced/outputs/CORE_ADVANCED_REPORT.md)
- PII report: [packages/pii/benchmarks/advanced/outputs/PII_ADVANCED_REPORT.md](./packages/pii/benchmarks/advanced/outputs/PII_ADVANCED_REPORT.md)

## Repository structure

```text
packages/core/     @intelpacket/core — engine + IntelPacket Spec v1
packages/pii/      @intelpacket/pii — preprocessing + PII Spec v1
docs/              Suite-level docs (SPEC_INDEX, API reference)
examples/          Runnable examples (core/, pii/)
packages/*/benchmarks/datasets/realistic/   Synthetic JSON for realistic benches
scripts/           verify-monorepo.mjs and helpers
tests/             (package-local tests under packages/*/tests)
```

## Release philosophy

- **Manual publishing** to npm; no automated publish or registry secrets in this repository.
- Publish **`@intelpacket/core` before `@intelpacket/pii`** when both change.
- Use `pnpm run verify:release` and the GitHub **Release check** workflow before tagging.
- Semantic versioning per package; spec or breaking pipeline changes require tests and documentation updates together.
- npm package pages: [`@intelpacket/core`](https://www.npmjs.com/package/@intelpacket/core) and [`@intelpacket/pii`](https://www.npmjs.com/package/@intelpacket/pii).

Manual publish commands:

```bash
cd packages/core
npm publish --access public

cd ../pii
npm publish --access public
```

## Non-goals

- No transport protocol, binary wire format, or hosted ingestion pipeline.
- No semantic / behavioral “intelligence”, ontology, or ML classification inside the engine.
- No blockchain, ledger, or compliance certification claims.
- PII is **not** legal advice, encryption-at-rest, or access control.

## License

MIT — see [LICENSE](./LICENSE).
