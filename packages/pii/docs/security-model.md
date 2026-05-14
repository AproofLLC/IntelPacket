# IntelPacket security and safety model

This document describes how `@intelpacket/pii` ships **IntelPacket Core**: fail-closed handling of bad inputs, resource limits, and deterministic hashing. It is not a formal audit report.

The package also includes the **IntelPacketPII** privacy module (see [privacy-policy.md](./privacy-policy.md) and [industry-usage.md](./industry-usage.md)) for **industry-agnostic** preprocessing of structured data containing PII or sensitive fields **before** packetization.

## Deterministic hashing

- `packet_hash` is SHA-256 (hex) over the canonical JSON of the inner logical envelope: `{ ip_version, encoding, root, refs, delta }` (see `createPacket` / `hashPacket`).
- `packet_id` is always the first 16 hex characters of `packet_hash`; both are enforced by `intelPacketSchema`.
- `created_at`, outer `compression` metadata, `payload` encoding, and `metadata` are **not** included in that hash unless you change the hashing contract in code.

## Replay verification

- `replayPacket(packet)` defaults to **`verifyHash: true`**: the decompressed inner envelope must match `packet_hash` or replay throws (`IntelPacket: packet hash verification failed`). This avoids silent corruption when payloads or refs are tampered with.
- **Replay expands dedupe refs using only `inner.refs` from the decompressed envelope** (the hashed surface). Outer `packet.refs` is not authoritative and must not influence expansion.
- `verifyHash: false` is only for trusted offline inspection of broken or experimental packets; it is unsafe on untrusted input.
- `verifyIntelPacket` returns `false` on any parse/decompress/hash mismatch (no throw). It does not re-check that outer `refs` matches inner `refs`; callers should treat the inner envelope as the integrity boundary.

## Unsafe key rejection (prototype pollution)

Own keys `__proto__`, `constructor`, and `prototype` are rejected during normalization, canonicalization, compaction, dedupe, delta apply/diff, and packet validation paths.

**Note:** In plain JavaScript, `{ __proto__: x }` in an object literal sets `[[Prototype]]` instead of creating an own property `__proto__`. Callers should not rely on that as a security boundary; IntelPacket only enumerates **own** keys via `Object.keys`. Supplying dangerous names as real own keys (for example on a null-prototype object) is rejected.

Traversal does not use `for...in` for user-controlled maps, avoiding accidental inherited properties in typical plain-object inputs.

## Compression and decompression limits

Constants from **`@intelpacket/core`** (re-exported by `@intelpacket/pii` for convenience) cap:

- UTF-8 size before compression (`MAX_PACKET_BYTES`).
- Base64 payload character length (`MAX_BASE64_PAYLOAD_CHARS`).
- Decoded compressed binary size (`MAX_COMPRESSED_BUFFER_BYTES`).
- Decompressed UTF-8 output (`MAX_DECOMPRESSED_BYTES`), enforced via codec `maxOutputLength` where supported and post-checks.

`decompressPacket` requires consistent `CompressionMetadata` (method, byte lengths, nonnegative clamped `reduction_ratio`) and valid base64; tampered metadata or corrupted buffers fail with deterministic `IntelPacket: …` errors.

## Traversal and structure limits

`validatePacketInput` (alias `assertTraversalLimits`) enforces maximum nesting depth, array length, keys per object, UTF-8 length per string, safe keys, and cycle detection on the DFS path. It rejects non-plain objects (`Date`, `Map`, `Set`, `RegExp`, class instances, etc.).

`expandRefs` caps chaining with `MAX_REF_EXPANSION_DEPTH` and detects reference cycles.

`assertJsonCompatible` applies the same bounds but disallows `bigint` (strict JSON subset).

## Unsupported and ambiguous types

- `undefined` is elided during normalization; functions and symbols are rejected.
- `bigint` is allowed at the normalize boundary and converted to a number or string before JSON; JSON replay paths never produce `bigint`.
- Non-finite numbers become `null` in canonical JSON.
- Date-like strings follow strict calendar checks in `normalize.ts`; invalid calendar dates remain ordinary strings.

## Packet shell validation

`intelPacketSchema` is strict for the outer packet: unknown top-level fields are rejected. `metadataSchema` only allows `title`, `labels`, and `compaction_dictionary`. Compression metadata must match byte-count invariants.

## Privacy and tokenization (IntelPacketPII)

The **`@intelpacket/pii`** package includes IntelPacketPII privacy helpers (`protectPII`, `detectPII`, `createPIIPacket`, …) for **industry-agnostic** field policy (redact, mask, tokenize, HMAC, remove, allow/deny) **before** calling `createPacket`.

Privacy transforms are **not** proof of regulatory compliance. They reduce accidental raw PII in packet payloads when policies and secrets are configured correctly. Errors intentionally avoid echoing raw sensitive values.

For positioning language, see [compliance-positioning.md](./compliance-positioning.md).

## Clean release checklist

See **[release-checklist.md](./docs/release-checklist.md)** for publish gates. Quick reminders:

- Do **not** commit `node_modules/`.
- Do **not** commit `dist/` unless you intentionally vendor build artifacts (default is build-at-publish).
- Run `npm pack --dry-run` and inspect the file list before publishing.
- Prefer `pnpm run typecheck`, `pnpm test`, `pnpm run test:pii`, and `pnpm run build` before release.

## Known limitations

- Protection assumes **own** enumerable keys and **plain** JSON-style object graphs.
- Limits are finite constants; callers with legitimate larger payloads must fork or raise caps deliberately.
- `replayPacket` with `verifyHash: false` will expand attacker-controlled graphs: pair with separate trust boundaries only.
- The repository ships **no** first-party CLI; path-traversal or file-overwrite issues are out of scope unless a CLI is added.

## Reporting security issues

Please open unknown security issues privately with the maintainers of your fork or organization until a dedicated security contact is published in the upstream repository.
