# IntelPacket Specification v1

This document formalizes the deterministic structured-data packet format implemented by **`@intelpacket/core`** as of Spec **v1**. It describes the **current engine behavior**; it is not a separate binary wire standard or transport protocol.

## Document conventions

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are to be interpreted as described in [BCP 14](https://datatracker.ietf.org/doc/html/rfc2119) \[[RFC2119](https://datatracker.ietf.org/doc/html/rfc2119)\] when, and only when, they appear in all capitals in this document.

### Terminology

- **IntelPacket** — The outer packet object (`IntelPacket`) produced by `createPacket`, including compression metadata and base64 `payload`, as validated by `intelPacketSchema`.
- **Inner envelope** — The JSON object carried inside the compressed `payload` (`InnerEnvelope`): canonical `root`, dedupe `refs`, optional `delta`, plus `ip_version` and `encoding`.
- **Hashing body** — The canonical object `{ ip_version, encoding, root, refs, delta }` whose serialization is input to **SHA-256** for `packet_hash`.
- **Replay** — Decompress `payload`, validate inner JSON, optionally verify `packet_hash`, expand **inner** `refs` only, then expand compaction keys using merged metadata dictionaries.
- **Caller** — Software that invokes `@intelpacket/core` APIs and supplies options such as `metadata`, `base`, and timestamps.

### Canonical definitions

- **Deterministic output** — For the same logical input tree and equivalent options, the engine MUST produce the same inner hashing body and thus the same `packet_hash`, modulo explicitly documented normalization edge cases covered by tests.
- **Supported protocol version** — `ip_version` and inner `ip_version` MUST be the literal `"1"` for Spec v1 implementations in this repository.

**Normative sources:** `packages/core/src/types.ts`, `packages/core/src/schemas.ts`, `packages/core/src/constants.ts`, `packages/core/src/spec.ts`, and the implementation modules referenced in the compliance checklist (Section 15).

---

## 1. Purpose

IntelPacket is a **deterministic structured-data compression and integrity packet format** for JSON-like trees in Node.js.

The engine:

- **Normalizes** input scalars and timestamps (`normalize.ts`).
- **Canonicalizes** key order and stable JSON serialization (`canonicalize.ts`).
- **Compacts** verbose keys using an optional dictionary (`compact.ts`).
- **Deduplicates** repeated subtrees into structural refs (`dedupe.ts`).
- **Optionally records delta metadata** between a caller-supplied base and the next state (`delta.ts`) — full next state is always retained in the inner envelope; delta is auxiliary metadata, not delta-only storage.
- **Compresses** the inner canonical UTF-8 string (`compress.ts`).
- **Hashes** the canonical inner envelope with **SHA-256** (`hash.ts`).
- **Verifies** and **replays** packets losslessly for supported versions (`packet.ts`, `replay.ts`).

IntelPacket does **not** claim semantic understanding, behavioral analysis, or entropy-breaking compression beyond deterministic structural and byte-level transforms.

---

## 2. Packet envelope

The public type **`IntelPacket`** (`types.ts`) is the **outer packet shell** produced by **`createPacket`** (not `createIntelPacket` — the API name is `createPacket`).

| Field | Required | Description |
|--------|-----------|-------------|
| `ip_version` | Yes | Protocol version; **literal `"1"`** for Spec v1 (`IP_VERSION` / `schemas.ts`). |
| `spec_version` | No* | Document spec revision; **literal `"1"`** when present (`INTELPACKET_SPEC_VERSION`). New packets from `createPacket` **set** `spec_version: "1"`. Legacy packets may omit it. |
| `packet_id` | Yes | First **16** hex characters of `packet_hash`. |
| `packet_hash` | Yes | **64**-char hex **SHA-256** of the canonical inner envelope (see §6). |
| `created_at` | Yes | ISO-8601 string; **provenance/display** — excluded from the hashed inner envelope by construction (see `packet.ts`). |
| `encoding` | Yes | **Literal `"canonical-json"`** (`IP_ENCODING`). |
| `compression` | Yes | Metadata: `method`, `raw_bytes`, `compressed_bytes`, `reduction_ratio` (`CompressionMetadata`, `compressionSchema`). |
| `payload` | Yes | **Base64** of compressed UTF-8 bytes of the **inner envelope** JSON. |
| `refs` | Yes | Mirror of inner dedupe ref table for transport/debug; **replay MUST use inner `refs` only** (`replay.ts`). |
| `delta` | Yes | Outer mirror of inner delta; may be `null`. |
| `metadata` | Yes | `PacketMetadata` — optional `title`, `labels`, `compaction_dictionary` (`metadataSchema`). |

**Inner envelope** (compressed inside `payload`), type shape **`InnerEnvelope`**:

- `ip_version`: literal `"1"`.
- `encoding`: literal `"canonical-json"`.
- `root`: normalized + compacted + deduped value.
- `refs`: record of `rN` → subtree payloads.
- `delta`: patch map or `null`.

---

## 3. Field guarantees

- **Required / optional:** As in §2 and Zod **`intelPacketSchema`** / **`innerEnvelopeSchema`** (`schemas.ts`).
- **Reserved keys:** `__ip_ref`, `__ip_num_add`, `__intelpacket__:delete`, compaction tokens — see `constants.ts` and compaction/delta modules.
- **Forbidden prototype pollution keys:** `__proto__`, `constructor`, `prototype` rejected in schema-safe keys (`SAFE_KEY` in `schemas.ts`).
- **Maximum sizes / depth:** `MAX_DEPTH`, `MAX_KEYS_PER_OBJECT`, `MAX_ARRAY_LENGTH`, `MAX_STRING_BYTES`, `MAX_PACKET_BYTES`, `MAX_DECOMPRESSED_BYTES`, `MAX_COMPRESSED_BUFFER_BYTES`, `MAX_BASE64_PAYLOAD_CHARS`, `MAX_REF_EXPANSION_DEPTH` (`constants.ts`, enforced via `validatePacketInput` / traversal limits in `utils.ts` and pipeline).
- **Supported JSON-like values:** JSON-compatible trees after normalization (no `undefined` in output; `undefined` inputs dropped where applicable).
- **Unsupported / cycles:** Non-plain objects rejected; circular structures rejected (`utils.ts`, `normalize.ts`).

---

## 4. Canonical ordering laws

- **Object keys** MUST be sorted **lexicographically** for canonical output (`canonicalize.ts`).
- **Arrays** preserve **source order** after normalization.
- **Equivalent objects** differing only in key insertion order MUST yield **identical** canonical serialization and thus identical hashes (when inner content matches).
- **Canonicalization** is stable across runs for the same logical input.
- **Unsafe keys** (prototype pollution) MUST be rejected where schema / validation applies.

---

## 5. Deterministic encoding rules

- **Character encoding:** Inner JSON is **UTF-8** bytes before compression (`INTELPACKET_CANONICAL_ENCODING` in `spec.ts` describes the byte layer).
- **Canonical JSON:** `canonicalStringify` / `canonicalize` define the exact serialized form used for hashing (`canonicalize.ts`).
- **Payload:** Compressed inner UTF-8 is **base64**-encoded in `payload` (`INTELPACKET_PAYLOAD_ENCODING`).
- **Compression:** Brotli preferred, zlib fallback, or `none` when disabled (`compress.ts`); `compression.method` and byte counts MUST match actual bytes (`compressionSchema` superRefine).
- **Normalize:** See `normalize.ts` (NFC strings, UTC timestamps, `undefined` handling).
- **Compact dictionary:** Caller metadata merges with defaults; reverse expansion on replay (`compact.ts`).

---

## 6. Hash guarantees

- **Algorithm:** **SHA-256** hex (`INTELPACKET_HASH_ALGORITHM`, `hash.ts`).
- **Input:** Canonical serialized **inner hashing body** (see `packet.ts` `hashingEnvelope` — `ip_version`, `encoding`, `root`, `refs`, `delta`).
- **Determinism:** Same logical inner content ⇒ same `packet_hash` (same `packet_id` prefix).
- **Sensitivity:** Different logical inner content ⇒ different hash except negligible collision probability.
- **Verification:** `verifyIntelPacket` recomputes hash from decompressed inner JSON; mismatch ⇒ **false** (no silent pass).

---

## 7. Replay guarantees

- **Decompress** `payload` using `compression` metadata.
- **Parse** inner envelope; validate against **`innerEnvelopeSchema`**.
- **Verify hash** when `verifyHash !== false` (default): mismatch ⇒ throw (`replay.ts`).
- **Expand dedupe refs** from **inner `refs` only**; outer `refs` MUST NOT drive expansion.
- **Expand compaction** using `metadata.compaction_dictionary` merged with defaults.
- **Malformed refs** (missing id, cycles beyond limits) ⇒ throw.
- **Corrupted payload** (invalid base64, decompress failure, invalid JSON) ⇒ throw or verify **false** as appropriate.
- **Unsupported `ip_version`** on outer/inner ⇒ schema / runtime rejection (currently **only `"1"`** accepted).

---

## 8. Version rules

- **Spec document revision:** `INTELPACKET_SPEC_VERSION === "1"` (`constants.ts`).
- **Protocol / inner `ip_version`:** `IP_VERSION === "1"` (`constants.ts`).
- **Supported major:** `INTELPACKET_SUPPORTED_MAJOR_VERSION === "1"` (`spec.ts`).
- **Major version breaks** compatibility; engines MUST reject unknown majors (enforced via Zod literals today).
- **Minor/patch** documentation or non-breaking implementation refinements MUST NOT change replay outputs for the same inputs (regression-tested).

---

## 9. Compression metadata guarantees

- **`method`:** `"brotli" | "zlib" | "none"` — must match how `payload` was produced.
- **`raw_bytes` / `compressed_bytes`:** Non-negative integers; for `none`, `raw_bytes === compressed_bytes` and `reduction_ratio === 0`.
- **`reduction_ratio`:** For non-`none`, consistent with byte counts within tolerance (`compressionSchema`).
- Metadata MUST match actual decode behavior (`decompressPacket`).

---

## 10. Dedupe / reference guarantees

- Ref ids match **`^r\d+$`** (`schemas.ts`).
- Refs resolve **deterministically** depth-first (`replay.ts` `expandRefs`).
- **Missing** ref target ⇒ throw.
- **Cycles** along ref chain ⇒ throw.
- **Dedupe table** in inner envelope is authoritative for replay integrity.

---

## 11. Delta metadata guarantees

- When `options.base` is set, **`delta`** holds a **deterministic** patch map between compacted base and compacted next (`delta.ts`).
- **Full next `root` + inner `refs`** are always stored — replay does **not** depend on external base state for reconstructing expanded output from the packet alone.
- Delta is **metadata / audit / patch description** in v1; **not** delta-only wire storage.

---

## 12. Error guarantees

- Invalid input at pipeline stages throws **`intelPacketError`**-prefixed errors where applicable (`utils.ts`, modules).
- **`verifyIntelPacket`** returns **boolean** — **false** on structural/hash/decompress failures (no silent pass).
- **`replayPacket`** throws on invalid packet, hash mismatch (when verification on), malformed refs, etc.

---

## 13. Security considerations

Implementations and callers MUST treat untrusted packets as hostile: verify hashes before replay, respect size and depth limits, and reject unsafe keys. This specification does **not** define encryption, authentication, or transport security.

- **No prototype pollution** via rejected keys in schemas and traversal checks.
- **No circular** input structures in packetization path.
- **Resource limits** on depth, keys, string sizes, ref expansion (`constants.ts`, `utils.ts`).
- **Deterministic validation** via schemas + `validatePacketInput`.

---

## 14. Non-goals (v1)

- **Not** a general standalone binary interchange format beyond JSON + compression + base64 shell described here.
- **Not** a network transport or session protocol.
- **Not** a database or storage engine.
- **Not** “magic” compression that violates stated deterministic rules.
- **Not** semantic or behavioral analysis of payload content.
- **Not** encryption, authentication, or compliance certification.

---

## 15. Compliance checklist

| Spec section | Primary source files | Tests (examples) |
|--------------|----------------------|------------------|
| §2 Envelope | `types.ts`, `schemas.ts`, `packet.ts` | `packet.test.ts`, `spec-v1.test.ts` |
| §3 Fields / limits | `constants.ts`, `utils.ts` | `security-resource-limits.test.ts`, `malformed-inputs.test.ts` |
| §4 Canonical | `canonicalize.ts` | `canonicalize.test.ts`, `determinism.test.ts` |
| §5 Encode / normalize | `normalize.ts`, `compact.ts`, `compress.ts` | `normalize.test.ts`, `compress.test.ts`, `compact.test.ts` |
| §6 Hash | `hash.ts`, `packet.ts` | `hash.test.ts`, `security-hash.test.ts` |
| §7 Replay | `replay.ts` | `replay.test.ts`, `replay-integrity.test.ts`, `replay-50x.test.ts` |
| §8 Version | `constants.ts`, `spec.ts`, `schemas.ts` | `spec-v1.test.ts` |
| §9 Compression meta | `schemas.ts`, `compress.ts` | `compress.test.ts`, `spec-v1.test.ts` |
| §10 Dedupe | `dedupe.ts`, `replay.ts` | `dedupe.test.ts`, `enterprise-inner-refs.test.ts`, `spec-v1.test.ts` |
| §11 Delta | `delta.ts`, `packet.ts` | `delta.test.ts`, `security-delta.test.ts`, `spec-v1.test.ts` |
| §12 Errors | `packet.ts`, `utils.ts` | `malformed-inputs.test.ts`, `security-*.test.ts` |
| §13 Security | `utils.ts`, `schemas.ts` | `security-prototype-pollution.test.ts` |

---

*End of IntelPacket Specification v1.*
