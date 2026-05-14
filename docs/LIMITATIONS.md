# IntelPacket Suite — Limitations & Non-Goals

## Overview

IntelPacket Suite is deterministic structured-data packetization infrastructure. It focuses on canonicalization, replay verification, integrity checks, deduplication, compaction, deterministic hashing, compression-aware packet construction, and optional privacy preprocessing for JSON-like structured systems.

It is not universal compression magic. IntelPacket improves the structure and determinism of packetized data before traditional compression, but it cannot defeat entropy or make every payload smaller than every baseline.

## Compression Limitations

Compression results vary by entropy, schema shape, repeated structure, and payload size. Repetitive structured systems usually benefit most because compaction and deduplication can expose repeated keys and repeated subtrees before byte-level compression.

Encrypted, already-compressed, random-looking, or high-cardinality data may compress poorly. Some full packet JSON representations can exceed raw gzip or brotli sizes because the packet includes metadata, base64 payload encoding, hash fields, mirrors, and version information.

IntelPacket should be understood as structure-aware packetization that can improve structural compressibility before traditional compression, not as a replacement for entropy limits.

## Performance Limitations

Deterministic processing costs CPU. Normalization, canonicalization, compaction, deduplication, hashing, compression, validation, and replay all do real work.

Nested and high-cardinality workloads can consume more memory and run more slowly than repetitive flat workloads. TypeScript and Node.js runtime overhead also exists, especially for large object graphs.

Strict 100k validation succeeded for `@intelpacket/core`, but throughput varied significantly by workload. PII strict 100k is not yet fully validated locally and should be treated as a dedicated-host validation item.

## Replay Limitations

Replay preserves the logical canonical structure for supported JSON-like inputs. It does not preserve original source formatting, whitespace, comments, object insertion order, or non-JSON presentation details.

Canonical replay is not byte-for-byte source reproduction. It is deterministic reconstruction of the normalized/canonical structured state represented by the packet.

## Structured Data Scope

IntelPacket is optimized for JSON-like structured systems: events, telemetry, audit records, configuration snapshots, API payloads, traces, transaction-shaped records, and similar data.

It is not designed for arbitrary binary blobs, media files, video, images, or opaque byte streams. It is also not a database, storage engine, query system, or replacement for durable persistence.

## PII Limitations

`@intelpacket/pii` is a policy-driven privacy preprocessing layer. It can redact, mask, tokenize, HMAC, remove, allow, or deny configured fields before packetization.

It is not compliance certification, not encryption, not IAM, not access control, and not a consent or governance platform. Organizational compliance depends on deployment, key management, contracts, audit logging, access controls, legal review, and operational process.

The strongest guarantees apply to fields covered by the configured policy. Detection is conservative and heuristic; it is not AI omniscience and does not promise perfect discovery of every sensitive value in arbitrary input.

## Benchmark Limitations

Benchmark results are workload-dependent. Throughput and reduction vary significantly by schema shape, entropy, record count, nesting, repeated structures, and transform policy.

Public-real datasets in this repository are public-safe generated subsets inspired by public documentation shapes. They are useful for exercising infrastructure-like payload patterns, but they are not private production traffic and should not be treated as a substitute for deployment-specific benchmarking.

## Runtime / Infrastructure Limitations

IntelPacket Suite is currently validated primarily as backend deterministic engine infrastructure.

There is no distributed runtime layer, packet streaming protocol, sync protocol, binary wire protocol, hosted service, or transport system in this v1 release.

## Explicit Non-Goals

IntelPacket is NOT:

- universal magic compression
- encryption
- access control
- compliance certification
- semantic AI
- ontology engine
- transport protocol
- distributed database
- blockchain runtime
- media compression engine

## Future Work

Potential future work includes binary protocol research, runtime and transport experimentation, native acceleration, distributed validation, and larger-scale benchmark hosts.

These are research and engineering directions, not promises for any specific release.
