# Determinism

IntelPacket is built so that the same input data yields the same normalized tree, the same canonical JSON, and the same `packet_hash` across runs and process boundaries, subject to the limitations in [replay-guarantees.md](./replay-guarantees.md).

## Normalization

- Object keys are processed in sorted order when building normalized objects; arrays keep element order. `undefined` is omitted; `null` is kept.
- Numbers: non-finite values become `null` in canonical output.
- Strings: NFC normalization is applied; invalid surrogate sequences are left unchanged if normalization throws.
- Booleans from strings: only `true` / `false` / `yes` / `no` (case-insensitive). Strings `"0"` and `"1"` remain strings (not booleans).
- Amount-style decimals: strings containing a `.` in a simple decimal pattern may become numbers (e.g. `"49.990"` → `49.99`). Pure integer strings (including leading zeros like `"00123"`) stay strings.
- Timestamps: only strings with **valid calendar dates** may normalize to ISO-8601 UTC; invalid dates like `2026-02-31` stay as strings. `Date.parse` is used only after component validation.

## Canonicalization

- At every object node, keys are sorted lexicographically. `canonicalize(canonicalize(x))` matches `canonicalize(x)` for JSON-compatible values.
- `canonicalStringify` is `JSON.stringify` of that canonical structure (no extra whitespace).

## Hashing

- `packet_hash` is SHA-256 (hex) of `canonicalStringify` applied to the inner envelope only:

`{ ip_version, encoding, root, refs, delta }`

- Outer fields such as `created_at` and the compression record are **not** part of the hash input.

## Dedupe and refs

- Duplicate subtrees (by structural JSON fingerprint) receive stable ids `r0`, `r1`, … ordered by sorted fingerprint string.
- Reference expansion during replay is deterministic depth-first.

## Deltas

- Patches use a fixed deletion sentinel and optional numeric additive patches. Patch object key order is canonicalized when patches are produced and applied.
- v0.1 packets are **full-state** packets: when `options.base` is supplied, `delta` is stored as audit/patch metadata alongside the complete next `root` in the inner envelope. **Delta-only** wire formats are future work.
