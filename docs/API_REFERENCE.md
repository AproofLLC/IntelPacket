# IntelPacket Suite — public API reference

This document describes **exported public APIs** of `@intelpacket/core` and `@intelpacket/pii`. Behavior matches the implementations in this repository; for normative prose, see [SPEC_INDEX.md](./SPEC_INDEX.md) and the linked specifications.

---

## `@intelpacket/core`

### `createPacket(input, options?)`

**Purpose:** Run the full pipeline (normalize → canonicalize → compact → dedupe → optional delta metadata → compress → hash) and return an `IntelPacket` outer shell.

**Parameters**

- `input` — JSON-like structured value to packetize.
- `options` — `CreatePacketOptions`: optional `metadata`, `base` (for delta metadata), `createdAt`, `preferZlib`, `disableCompression`, etc.

**Returns:** `IntelPacket`.

**Determinism:** For the same `input` and equivalent `options` (including stable `metadata.compaction_dictionary` merge semantics), the implementation produces the same logical inner envelope and thus the same `packet_hash` (subject to documented normalization rules in the spec).

**Failure behavior:** Throws on invalid input, traversal/size limit violations, compression failures treated as errors, or schema validation failures after construction.

---

### `replayPacket(packet, options?)`

**Purpose:** Decompress the inner envelope, verify hash (by default), expand dedupe references from **inner** `refs` only, expand compaction dictionary, and return replay views (`ReplayState`).

**Parameters**

- `packet` — `IntelPacket`.
- `options` — `ReplayPacketOptions`; `verifyHash` defaults to `true`.

**Returns:** `ReplayState` (`normalized`, `canonical`, `compacted`, `deduped`, `expanded`).

**Determinism:** Same `packet` and options ⇒ same expanded logical output for supported versions.

**Failure behavior:** Calls `assertSupportedIntelPacketVersion` first (throws on unsupported/malformed shell or unsupported `spec_version` when present). Throws on decompress/parse failures, hash mismatch when verification is on, missing/cyclic refs, or invalid inner shape.

---

### `verifyIntelPacket(packet)`

**Purpose:** Boolean integrity check without throwing for common failure modes.

**Parameters:** `packet` — unknown / `IntelPacket`-shaped.

**Returns:** `true` if outer schema passes, payload decompresses, inner parses, inner hash matches `packet_hash`, and post-decompression validation succeeds; otherwise **`false`** (fail-closed, no thrown errors for expected invalid packets).

**Determinism:** Pure function of `packet` bytes/fields.

---

### `canonicalize(value)`

**Purpose:** Return a canonical JSON-like tree with **lexicographically sorted** object keys at every object node (arrays preserve order).

**Parameters:** JSON-like `value` (after typical normalization expectations).

**Returns:** Canonicalized value suitable for stable serialization.

**Determinism:** Same logical input ⇒ same output shape and key order.

**Failure behavior:** May throw when inputs violate plain-object / cycle rules consistent with the rest of the engine (see implementation and tests).

---

### `canonicalStringify(value)`

**Purpose:** Serialize a canonicalized value to the **exact** UTF-8 string form used in inner hashing steps (stable key order and formatting rules as implemented).

**Parameters:** JSON-like `value`.

**Returns:** `string` (UTF-8).

**Determinism:** Same canonical logical content ⇒ identical string.

**Failure behavior:** Throws on non-serializable structures per engine rules.

---

### `hashPacket(body)`

**Purpose:** Compute **SHA-256** hex digest of the canonical serialized `body` per `hash.ts` (used for inner envelope integrity).

**Parameters:** Inner hashing body shape (see spec: `ip_version`, `encoding`, `root`, `refs`, `delta`).

**Returns:** 64-character lowercase hex string.

**Determinism:** Identical `body` ⇒ identical digest.

---

### `compactSchema(value, options?)`

**Purpose:** Apply optional key compaction using caller/default dictionary mapping.

**Parameters:** Canonical JSON-like `value`; optional `CompactOptions` / dictionary merge behavior.

**Returns:** Compacted tree (still JSON-like).

**Determinism:** Same inputs and dictionary ⇒ same output.

**Failure behavior:** Throws on invalid merge / validation errors (`validateCompactionMerge`).

---

### `expandSchema(value, options?)`

**Purpose:** Reverse compaction using merged metadata dictionary + defaults.

**Parameters:** Compacted value; options with optional `dictionary` from packet metadata.

**Returns:** Expanded canonical keys.

**Determinism:** Inverse of compaction for supported mappings.

---

### `dedupeStructures(value)`

**Purpose:** Replace repeated identical subtrees with stable `__ip_ref` pointers and a side `refs` table.

**Parameters:** JSON-like `value` (typically compacted).

**Returns:** `DedupeResult` `{ value, refs }`.

**Determinism:** Stable ref identifiers and table layout for the same input tree.

**Failure behavior:** Throws on cycles or excessive structure per engine limits.

---

### `applyDelta(base, patch)` / `diffPackets(before, after)`

**Purpose:** `diffPackets` computes deterministic delta metadata between two compacted states; `applyDelta` applies a patch map (see `delta.ts` for exact semantics). Used by `createPacket` when `options.base` is provided.

**Parameters:** JSON-like compacted values; patch is `DeltaPatch`.

**Returns:** Patched value or patch map.

**Determinism:** Patches are derived deterministically from compared trees.

**Failure behavior:** Throws on invalid patch shapes or incompatible bases per implementation.

---

### `assertSupportedIntelPacketVersion(packet)`

**Purpose:** Validate outer packet shell with `intelPacketSchema`; ensure optional `spec_version` is either absent or equals `INTELPACKET_SPEC_VERSION` (`"1"`).

**Parameters:** `unknown`.

**Returns:** `void`.

**Failure behavior:** Throws `intelPacketError` on malformed or unsupported packets.

---

## `@intelpacket/pii`

The PII package **re-exports** selected `@intelpacket/core` symbols for convenience; only PII-specific APIs are summarized below. See core section for shared exports.

### `validatePrivacyPolicy(policy)` / policy shape

**Purpose:** Parse and validate a `PrivacyPolicyV1` object (Zod-backed).

**Returns:** Validated policy object.

**Failure behavior:** Throws `IntelPacketPIIError` on invalid policy.

**Policy structure (summary):** `version: "v1"`, optional `mode` (`"fail-closed"` | `"permissive"`), path lists for `redact`, `mask`, `tokenize`, `hmac`, `remove`, `deny`, `allow`. Path syntax is implemented in `policy.ts`.

---

### `protectPII(input, policy, options?)`

**Purpose:** Apply policy actions to structured `input`, emit `ProtectPIIResult` with transformed `data` and `PrivacyReport`.

**Parameters**

- `input` — structured JSON-like object.
- `policy` — validated policy or raw object (validated internally).
- `options` — `ProtectPIIOptions`: optional `tokenSecret`, `hmacSecret`, `detectOptions`, etc., required when tokenize/hmac rules are used.

**Returns:** `{ data, report }` (`ProtectPIIResult`).

**Determinism:** Same `input`, policy, and secrets ⇒ same transforms and same report fields (for a fixed engine version).

**Failure behavior:** Throws `IntelPacketPIIError` on invalid structures, policy violations, or missing secrets when required.

---

### `createPIIPacket(input, policy, options?)`

**Purpose:** `protectPII` → `assertSupportedIntelPacketPIIVersion(report)` → `createPacket` on protected data → `assertSupportedIntelPacketVersion(packet)`.

**Parameters:** Same as `protectPII` plus optional `packetOptions` forwarded to `createPacket`.

**Returns:** `{ packet, privacy }`.

**Determinism:** Composes `protectPII` and `createPacket` determinism.

**Failure behavior:** Throws on any failure from nested steps.

---

### `detectPII(input, options?)`

**Purpose:** Heuristic detection of potentially sensitive fields (field-name and value-pattern hints).

**Parameters:** Structured `input`; optional `DetectPIIOptions` (e.g. `sensitiveFieldNames`).

**Returns:** `PIIDetectResult` with `fields` entries (paths, categories, kinds — not raw secret dumps).

**Determinism:** Same input and options ⇒ same detection list for a fixed engine version.

**Guarantees / limits:** Heuristic only; false positives and false negatives are possible (see PII spec).

---

### `createPrivacyReport(input, transformed, policyInput, detectOptions?)`

**Purpose:** Build a `PrivacyReport` by comparing `input` vs `transformed` under a validated policy, including post-transform residual scans.

**Parameters:** Original and post-transform values; policy; optional detection options.

**Returns:** `PrivacyReport` including `pii_spec_version: "1"` for v1 policies.

**Determinism:** Same quadruple ⇒ same report.

**Failure behavior:** Validates policy; may throw on invalid inputs per implementation.

---

### `assertSupportedIntelPacketPIIVersion(value)`

**Purpose:** Assert a `PrivacyReport`-shaped value is compatible with PII Spec v1 when `policy_version === "v1"` (requires `pii_spec_version === INTELPACKET_PII_SPEC_VERSION`).

**Parameters:** `unknown` (typically a `PrivacyReport`).

**Returns:** `void`.

**Failure behavior:** Throws `IntelPacketPIIError` if the object is not report-shaped or version fields are inconsistent.

---

### Deterministic token / HMAC behavior (public helpers)

- `tokenizeField`, `hmacField`, `maskStringByKind`, `inferMaskKindFromFieldName`, `redactValue` — low-level building blocks used by `protectPII`. Outputs for tokenize/HMAC are deterministic for the same `(path, value, secret)` and fixed algorithm parameters; they **MUST NOT** embed raw secrets in their outputs. Changing the secret changes outputs with overwhelming probability.

**Privacy report:** Contains paths and aggregate flags, not raw `tokenSecret` / `hmacSecret` values.

---

## Version constants (representative)

| Symbol | Package | Meaning |
|--------|---------|---------|
| `INTELPACKET_SPEC_VERSION` | core (and re-exported pii) | Document/spec revision on packets (`"1"`). |
| `INTELPACKET_PII_SPEC_VERSION` | pii | PII report spec revision (`"1"`). |
| `IP_VERSION` | core | Protocol / inner `ip_version` (`"1"`). |

---

*End of API reference.*
