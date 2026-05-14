# Replay guarantees

## Lossless path

For payloads that round-trip through the library pipeline:

1. `createPacket(input)` runs: normalize → canonicalize → compact → dedupe → (optional delta metadata when `base` is provided) → compress.
2. `replayPacket(packet)` runs: decompress → validate inner envelope → expand refs using **`inner.refs` only** → expand schema (reverse compaction) → canonicalize.

The replayed verbose structure satisfies:

`canonicalStringify(replayPacket(packet).canonical) === canonicalStringify(canonicalize(normalizeTypes(input)))`

when the same default (and metadata) compaction dictionary applies and **input keys are not compact alias tokens used for a different meaning** (see below).

## Ref tables

- The inner envelope carries `refs` used to expand `{ "__ip_ref": "rN" }` nodes. **Only these inner `refs` are used for replay** (they are part of `packet_hash`).
- Outer `packet.refs` is a non-authoritative mirror for transport or debugging; tampering it must not change replay output. Integrity comes from the hashed inner envelope.

## Compression

- Brotli or zlib is used for the inner UTF-8 JSON string. Decompression is lossless for that string; a wrong `method` in metadata will fail decompression deterministically.

## Verification

- `verifyIntelPacket` recomputes the hash from the decompressed canonical inner envelope and compares it to `packet_hash`.

## Limitations

- **Compaction aliases**: `expandSchema` maps any key that equals a compact **value** in the dictionary (e.g. `ts` → `timestamp`). Raw data must not use `ts`, `uid`, etc. as unrelated field names unless you override the dictionary.
- **Circular structures** in the input are not supported; processing may throw or overflow the stack.
- **Mutation** of objects after fingerprinting in dedupe can break invariants; treat inputs as immutable logical values.
