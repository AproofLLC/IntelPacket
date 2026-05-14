# IntelPacket PII (`@intelpacket/pii`)

**Optional privacy preprocessing** for JSON-like structured data **before** `@intelpacket/core` packetization (`createPacket`, hash, compress, replay).

The package **re-exports** selected `@intelpacket/core` APIs for a single import surface; implementations for core algorithms live only in `@intelpacket/core`.

IntelPacket PII applies to **any system** that processes sensitive structured data — **across industries**, **not a single industry**. Examples include healthcare records, financial records, employee and HR data, SaaS user profiles, student and education records, legal and client-matter data, government and citizen-facing records, and customer-support payloads. **Compliance depends on deployment, legal review, contracts, access controls, audit logging, and key management** — this package **does not make an organization compliant** by itself.

**Formal spec:** [IntelPacket PII Specification v1](./docs/intelpacket-pii-spec-v1.md)  
**Core spec:** [IntelPacket Specification v1](../core/docs/intelpacket-spec-v1.md)  
**Suite limitations:** [Limitations & Non-Goals](https://github.com/intelpacket/intelpacket/blob/main/docs/LIMITATIONS.md)

## Integrity Hardening

PII integrity tests use fake data only and cover leak matrices, policy fuzzing, nested attack cases, token/HMAC secret leakage checks, concurrency, soak smoke cycles, and packet replay/verification after protection.

Run from the repo root:

```bash
pnpm run test:integrity
pnpm run verify:integrity
```

Strict 100k benchmarks are manual only and are not run by CI.

## Capabilities

- **Redact** — Replace matched paths with a stable redaction literal.
- **Mask** — Partially obscure string values by mask kind.
- **Tokenize** — Deterministic opaque tokens per `(path, value, tokenSecret)`.
- **HMAC** — Deterministic digests per `(path, value, hmacSecret)`.
- **Privacy reports** — Paths, flags, and aggregate counts; **not** raw secrets.
- **`createPIIPacket`** — `protectPII` → validated report → `createPacket`, with version assertions on both layers.

## Explicit non-claims

- **Not legal compliance** — Organizational obligations remain with deployers and counsel.
- **Not encryption** — No at-rest or in-transit encryption is provided by this library.
- **Not access control** — No IAM, RBAC, or consent orchestration.

## Install

```bash
pnpm add @intelpacket/pii
# or
npm install @intelpacket/pii
```

Requires **Node.js 18+**. In this monorepo, `@intelpacket/core` is linked via `workspace:*`.

## Policy example

```typescript
import { validatePrivacyPolicy } from "@intelpacket/pii";

export const policy = validatePrivacyPolicy({
  version: "v1",
  mode: "fail-closed",
  redact: ["notes"],
  tokenize: ["external_id"],
  allow: ["external_id", "status", "notes"],
});
```

## Privacy transform example

```typescript
import { protectPII, validatePrivacyPolicy } from "@intelpacket/pii";

const policy = validatePrivacyPolicy({
  version: "v1",
  mode: "fail-closed",
  mask: ["phone"],
  allow: ["phone", "status"],
});

const out = protectPII({ status: "ok", phone: "555-0100" }, policy, {});
console.log(out.data, out.report.fields_masked);
```

## Packet adapter example

```typescript
import { createPIIPacket, validatePrivacyPolicy, verifyIntelPacket } from "@intelpacket/pii";

const policy = validatePrivacyPolicy({
  version: "v1",
  redact: ["comment"],
  tokenize: ["ref"],
  allow: ["ref", "status"],
});

const demoToken = "example-token-secret-do-not-ship";
const demoHmac = "example-hmac-secret-do-not-ship";

const { packet, privacy } = createPIIPacket(
  { status: "open", ref: "partner-22", comment: "narrative" },
  policy,
  { tokenSecret: demoToken, hmacSecret: demoHmac, packetOptions: { disableCompression: true } },
);

console.log(privacy.pii_spec_version, verifyIntelPacket(packet));
```

## Runnable examples (monorepo root)

```bash
pnpm exec tsx examples/pii/redact.ts
pnpm exec tsx examples/pii/tokenize.ts
pnpm exec tsx examples/pii/create-pii-packet.ts
pnpm exec tsx examples/pii/privacy-report.ts
```

Additional domain-style demos live under `packages/pii/examples/` (synthetic data only).

## Documentation

- [docs/privacy-policy.md](./docs/privacy-policy.md)
- [docs/privacy-report.md](./docs/privacy-report.md)
- [docs/security-model.md](./docs/security-model.md)
- [docs/API_REFERENCE.md](../../docs/API_REFERENCE.md)

## Benchmarks

**Throughput:** `pnpm run bench:pii`, `pnpm run bench`, `pnpm run bench:50x` (from this package / re-exported core benches).

**Realistic proof run:** `pnpm run bench:realistic` — synthetic PII-shaped JSON, policy transforms, `createPIIPacket`, replay round-trip hash match, **secret leak** and **raw email literal** scans. Outputs:

- [PII_BENCHMARK_REPORT.md](./benchmarks/PII_BENCHMARK_REPORT.md)
- [pii-benchmark-results.json](./benchmarks/pii-benchmark-results.json)

Regenerate fixtures: `pnpm run datasets:realistic`. Methodology: [benchmarks/README.md](./benchmarks/README.md).

**Advanced bench:** `pnpm run bench:advanced` — percentiles, throughput, memory, leak scans, token/HMAC stability. Human report: [PII_ADVANCED_REPORT.md](./benchmarks/advanced/outputs/PII_ADVANCED_REPORT.md). Default runs may use fewer than the nominal `--scale` user rows (see JSON `cli`); use `--strict-scale` for the full count.

## License

MIT — see [LICENSE](./LICENSE).
