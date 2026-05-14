# IntelPacket pipeline

Stages applied by `createPacket` (see `src/packet.ts`):

1. **Normalize** (`normalize.ts`) — scalars, NFC strings, UTC timestamps, drop `undefined`, preserve `null`.
2. **Canonicalize** (`canonicalize.ts`) — deterministic nested key ordering; `canonicalStringify` for hashing.
3. **Compact** (`compact.ts`) — optional verbose→short field mapping; reversible via `expandSchema` during replay.
4. **Dedupe** (`dedupe.ts`) — repeated subtrees become `{ "__ip_ref": "rK" }` with a parallel ref table.
5. **Delta** (`delta.ts`) — when `options.base` is supplied, an auxiliary patch is stored alongside the full next state (numeric patches may use `{ "__ip_num_add": n }`; deletions use `__intelpacket__:delete`).
6. **Compress** (`compress.ts`) — Brotli with zlib fallback; metadata records byte metrics.
7. **Hash** (`hash.ts`) — SHA-256 over the canonical inner envelope JSON string.
8. **Packet** — outer shell with `payload` (base64), `refs` mirror, `delta`, and `metadata`.
9. **Replay** (`replay.ts`) — inverse of compression + ref expansion (**inner `refs` only**) + schema expansion.

Integrity check: `verifyIntelPacket` recomputes the hash from the decompressed inner envelope.

More detail: [determinism.md](./determinism.md), [replay-guarantees.md](./replay-guarantees.md), [packet-structure.md](./packet-structure.md), [benchmark-methodology.md](./benchmark-methodology.md).
