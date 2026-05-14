# IntelPacket PII Specification v1

This document formalizes the **privacy preprocessing layer** implemented by **`@intelpacket/pii`** as **PII Spec v1**. It complements the **[IntelPacket Specification v1](../../core/docs/intelpacket-spec-v1.md)** (`@intelpacket/core`).

## Document conventions

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are to be interpreted as described in [BCP 14](https://datatracker.ietf.org/doc/html/rfc2119) \[[RFC2119](https://datatracker.ietf.org/doc/html/rfc2119)\] when, and only when, they appear in all capitals in this document.

### Terminology

- **Policy** — A validated `PrivacyPolicyV1` object controlling redact, mask, tokenize, HMAC, remove, deny, and allow paths.
- **Protection result** — Output of `protectPII`: transformed structured data plus a `PrivacyReport`.
- **Privacy report** — Deterministic summary of paths acted on, detections, and flags; MUST NOT contain raw `tokenSecret` / `hmacSecret`.
- **Adapter** — `createPIIPacket`, which composes `protectPII` and `createPacket` from `@intelpacket/core`.

### Policy semantics (summary)

- **Fail-closed mode (default)** — Unhandled sensitive detections after transforms SHOULD cause `safe_for_packetization: false` in the report unless policy explicitly permits permissive handling.
- **Rule precedence** — Field actions are applied according to the engine’s rule ordering and allow/deny matching (`policy.ts`, `transform.ts`); callers MUST supply consistent allow lists when retaining sensitive-detected paths.

**Normative sources:** `packages/pii/src/pii/types.ts`, `packages/pii/src/pii/schemas.ts`, `packages/pii/src/pii/policy.ts`, `packages/pii/src/pii/detect.ts`, `packages/pii/src/pii/transform.ts`, `packages/pii/src/pii/report.ts`, `packages/pii/src/pii/adapter.ts`, `packages/pii/src/pii/spec.ts`.

---

## 1. Purpose

IntelPacketPII is an **optional** privacy preprocessing layer applied **before** IntelPacket Core (`createPacket`, hash, replay).

It reduces exposure of sensitive field values in structured data by applying **caller-defined policies** (redact, mask, tokenize, HMAC, remove, allow/deny) and emitting a **privacy report** (paths and metadata — not raw secrets).

---

## 2. Pipeline

```
Raw sensitive structured data
  → validate privacy policy
  → detectPII (heuristics + optional field-name map)
  → apply policy actions (redact / mask / tokenize / hmac / remove / deny)
  → privacy report (paths, actions, flags)
  → safe structured data
  → IntelPacket Core (`createPacket`, …)
  → IntelPacket Spec v1 packet
```

---

## 3. Policy structure

**Type `PrivacyPolicyV1`** (`types.ts`), schema **`privacyPolicyV1Schema`** (`schemas.ts`):

| Field | Role |
|--------|------|
| `version` | **Literal `"v1"`** — policy language revision. |
| `mode` | Optional: `"fail-closed"` (default) or `"permissive"`. |
| `redact` | Path patterns → replace with redaction literal. |
| `mask` | Path patterns → masked string (partial reveal). |
| `tokenize` | Path patterns → deterministic token (requires `tokenSecret`). |
| `hmac` | Path patterns → HMAC digest string (requires `hmacSecret`). |
| `remove` | Path patterns → delete node. |
| `deny` | Path patterns → deny/remove. |
| `allow` | Path patterns allowed without transformation when matched. |

Path syntax is the engine’s policy path language (`parsePolicyPath`, `pathMatches`, `formatPath` in `policy.ts`).

**Secrets:** `tokenSecret` / `hmacSecret` are provided via **`ProtectPIIOptions`** only; they MUST NOT appear in the privacy report or packet metadata.

---

## 4. Field action guarantees

| Action | Guaranteed | Not guaranteed |
|--------|------------|----------------|
| **Redact** | Target path value becomes the stable redaction literal; raw value not preserved in output at that path. | Semantic meaning of surrounding document. |
| **Mask** | Raw string is not reproduced verbatim when masked; format depends on mask kind. | Perfect opacity for all human interpretations. |
| **Tokenize** | Deterministic per `(path, value, secret)` for a fixed secret; output prefixed conventionally (`tok_`). | Same token across different secrets. |
| **HMAC** | Deterministic per `(path, value, secret)`; digest form does not embed raw secret. | Collision resistance beyond HMAC-SHA256 assumptions. |

---

## 5. Detection guarantees

- **`detectPII`** combines **field-name** heuristics and **value patterns** (`detect.ts`).
- **False positives / false negatives** are possible — detection is heuristic, not exhaustive classification.
- **Policy actions** take precedence over raw retention when a path matches a rule (see `transform.ts` / `findAllowMatch`).

---

## 6. Tokenization / HMAC guarantees

- **Deterministic** for the same `(path, value, secret)`.
- **Different secrets** ⇒ different outputs (with overwhelming probability).
- **Raw value** MUST NOT appear in transformed output at transformed paths for those actions.
- **Secrets** MUST NOT appear in **`PrivacyReport`** or **`IntelPacket.metadata`** (callers must not place secrets in `PacketMetadata`).

---

## 7. Report guarantees

- **`PrivacyReport`** records **paths** and aggregate flags (`fields_redacted`, `fields_masked`, …); `fields_detected` entries describe detections (path, category, detection kind — not a dump of raw payload).
- Report MUST NOT embed **raw secrets** (`tokenSecret` / `hmacSecret`).
- Report fields are derived deterministically from `(input, transformed, policy)` for a fixed engine version (`createPrivacyReport`, `protectPII`).
- **`pii_spec_version`:** `"1"` for PII Spec v1 reports (`INTELPACKET_PII_SPEC_VERSION`).

---

## 8. Adapter guarantees

- **`createPIIPacket`** runs **`protectPII`** then **`createPacket`** from `@intelpacket/core`.
- Resulting **`IntelPacket`** conforms to **IntelPacket Spec v1** (including `spec_version` / `ip_version` when produced by current core).
- **`assertSupportedIntelPacketVersion`** may be invoked after creation to validate shell compatibility.
- Raw sensitive values MUST NOT appear in the packet payload after protection for paths governed by policy (enforced by fail-closed semantics and verification helpers where applicable).

---

## 9. Security considerations

- Callers MUST keep `tokenSecret` and `hmacSecret` out of logs, reports, and `IntelPacket.metadata`.
- No **raw secret** leakage via report or adapter wiring in the reference implementation is intended; review custom forks.
- **Prototype pollution** keys are rejected in policy paths and traversal (`policy.ts`, `transform.ts`).
- **Deterministic transforms** for fixed options and secrets.
- **Policy validation** via `privacyPolicyV1Schema` / `validatePrivacyPolicy`.

This layer does **not** provide encryption, transport security, legal compliance, or access control.

---

## 10. Non-goals

- **Not** legal compliance by itself.
- **Not** perfect PHI/PII discovery.
- **Not** encryption at rest or in transit.
- **Not** access control, IAM, or consent management.

---

*End of IntelPacket PII Specification v1.*
