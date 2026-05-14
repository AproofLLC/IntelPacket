# IntelPacket Core

Package: `@intelpacket/core`

**Deterministic structured-data packetization for Node.js:** normalize → canonicalize → compact → dedupe → optional delta metadata → compress → SHA-256 hash → versioned packet shell → verified replay.

IntelPacket is an embeddable library: it turns JSON-compatible trees into canonical, hashed, compressible packets with lossless replay. It does **not** define a transport protocol, binary wire interchange standard, or semantic analysis of payload content.

**Formal spec:** [IntelPacket Specification v1](./docs/intelpacket-spec-v1.md)  
**Suite limitations:** [Limitations & Non-Goals](https://github.com/AproofLLC/IntelPacket/blob/main/docs/LIMITATIONS.md)

## Integrity Hardening

Core integrity tests cover golden vectors, tamper/corruption matrices, seeded fuzz and malformed input, schema drift, version compatibility, concurrency, soak smoke cycles, npm pack smoke checks, and a CI-sized benchmark smoke gate.

Run from the repo root:

```bash
pnpm run test:integrity
pnpm run verify:integrity
```

Strict 100k benchmarks are manual only and are not run by CI.

## Install

```bash
npm install @intelpacket/core
```

Optional pnpm/yarn equivalents: `pnpm add @intelpacket/core` or `yarn add @intelpacket/core`.

Requires **Node.js 18+**.

## What the engine does

- **Deterministic canonicalization** — Lexicographic object key order; stable UTF-8 serialization for the inner hashing body.
- **Compaction** — Optional short-key dictionary merged with defaults; expanded on replay using `metadata.compaction_dictionary` plus defaults.
- **Dedupe** — Repeated subtrees become stable `__ip_ref` pointers; inner `refs` table is authoritative for replay.
- **Delta metadata** — When `createPacket(input, { base })` is used, a deterministic patch map is stored alongside the **full** next `root` (not delta-only storage).
- **Compression** — Brotli preferred, zlib fallback, or `none` when disabled.
- **Hashing** — SHA-256 over the canonical inner hashing body (`ip_version`, `encoding`, `root`, `refs`, `delta`). `created_at` and outer compression metadata are not hashed.
- **Replay verification** — `verifyIntelPacket` (boolean, fail-closed) and `replayPacket` (throws on hash mismatch by default) decompress, validate, expand inner refs only, then expand compaction.

## Examples (repository)

From the monorepo root after `pnpm install`:

```bash
pnpm exec tsx examples/core/basic-packet.ts
pnpm exec tsx examples/core/replay-verify.ts
pnpm exec tsx examples/core/canonicalization.ts
pnpm exec tsx examples/core/dedupe.ts
```

### `createPacket` / `replayPacket` / `verifyIntelPacket`

```typescript
import { createPacket, replayPacket, verifyIntelPacket } from "@intelpacket/core";

const packet = createPacket({ a: 1, z: 2 }, { disableCompression: true });
if (!verifyIntelPacket(packet)) throw new Error("bad packet");
const { expanded } = replayPacket(packet);
```

### Canonicalization

```typescript
import { canonicalize, canonicalStringify } from "@intelpacket/core";

const c = canonicalize({ z: 1, a: { m: 2, b: 3 } });
console.log(canonicalStringify(c));
```

### Compaction helpers

```typescript
import { compactSchema, expandSchema } from "@intelpacket/core";

const dict = { timestamp: "ts" };
const compacted = compactSchema({ timestamp: "2020-01-01T00:00:00.000Z" }, { dictionary: dict });
const round = expandSchema(compacted, { dictionary: dict });
```

### Dedupe

```typescript
import { dedupeStructures, expandRefs } from "@intelpacket/core";

const shared = { k: 1, j: 2 };
const d = dedupeStructures({ a: shared, b: shared });
expandRefs(d.value, d.refs);
```

## Deterministic guarantees

- Same logical input and equivalent options ⇒ same inner hashing body and `packet_hash` (subject to documented normalization rules; see [docs/determinism.md](./docs/determinism.md)).
- Dedupe ref identifiers are stable for identical structural fingerprints.
- Outer `refs` mirrors inner refs for convenience; **replay MUST use inner `refs` only** (see spec §7).

## Replay guarantees

- Default `replayPacket` verifies `packet_hash` before expansion.
- Expansion is depth-first and deterministic; missing refs or cycles beyond limits throw.

## Versioning

- `assertSupportedIntelPacketVersion`, `INTELPACKET_SPEC_VERSION`, and related constants are exported for tooling.
- Unknown `spec_version` values (when present) are rejected.

## Non-goals

- Not machine learning, knowledge graphs, ledgers, hosted observability products, or shared storage.
- Not field-level privacy transforms (use `@intelpacket/pii` upstream if needed).

## Benchmarking

- **Throughput:** `pnpm run bench` (compression bench), `pnpm run bench:50x`.
- **Realistic proof run:** `pnpm run bench:realistic` — loads `benchmarks/datasets/realistic/*.json`, checks five-run `packet_hash` equality, `verifyIntelPacket`, and **replay round-trip** (`createPacket(replay.normalized)` matches original hash). Writes [benchmark-results.json](./benchmarks/benchmark-results.json) and [BENCHMARK_REPORT.md](./benchmarks/BENCHMARK_REPORT.md).
- **Advanced stress bench:** `pnpm run bench:advanced` — entropy-class synthetic payloads, gzip/brotli baselines, percentiles, memory deltas; JSON + [CORE_ADVANCED_REPORT.md](./benchmarks/advanced/outputs/CORE_ADVANCED_REPORT.md). Large `--scale=100k` / `1m` runs use a **soft row cap** unless you pass `--strict-scale` (see report / JSON `cli`).

### Dataset methodology

Fixtures are **synthetic** (SaaS-style APIs, logs, traces, configs, audits, transactions, telemetry). Regenerate with `pnpm run datasets:realistic`. See [benchmarks/datasets/realistic/README.md](./benchmarks/datasets/realistic/README.md).

### Determinism & replay validation

Documented in [benchmarks/README.md](./benchmarks/README.md). The realistic runner **fails closed** if determinism, verify, or replay round-trip breaks.

## Further reading

- [docs/security-model.md](./docs/security-model.md)
- [docs/replay-guarantees.md](./docs/replay-guarantees.md)
- [docs/packet-structure.md](./docs/packet-structure.md)
- [docs/API_REFERENCE.md](../../docs/API_REFERENCE.md)

## License

MIT — see [LICENSE](./LICENSE).
