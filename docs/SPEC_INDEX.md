# IntelPacket Suite Specifications

Formal specifications and API summaries for the IntelPacket monorepo:

| Document | Package | Description |
|----------|---------|-------------|
| [IntelPacket Suite Limitations & Non-Goals](./LIMITATIONS.md) | suite | Compression, performance, replay, PII, benchmark, runtime, and non-goal boundaries. |
| [IntelPacket Specification v1](../packages/core/docs/intelpacket-spec-v1.md) | `@intelpacket/core` | Deterministic packet structure, canonicalization, hashing, compression metadata, dedupe, delta metadata, replay, verification, and error behavior. |
| [IntelPacket PII Specification v1](../packages/pii/docs/intelpacket-pii-spec-v1.md) | `@intelpacket/pii` | Privacy preprocessing: policy shape, field actions, detection, tokenization/HMAC, privacy reports, adapter pipeline, and security posture **before** core packetization. |
| [API reference](./API_REFERENCE.md) | suite | Public exports of `@intelpacket/core` and `@intelpacket/pii` (concise). |

**IntelPacket Spec v1** defines the deterministic packet shell and integrity behavior of `@intelpacket/core`.

**IntelPacket PII Spec v1** defines privacy preprocessing guarantees for `@intelpacket/pii` **before** data is passed to `@intelpacket/core`.

Neither document defines a standalone binary transport protocol or a hosted compliance product; see each spec’s **Non-goals** section.
