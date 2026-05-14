# IntelPacketPII privacy policy (v1)

Policies are validated with **Zod** (`validatePrivacyPolicy`) and enforced by `protectPII`.

They are **industry-agnostic**: the same actions apply whether the payload comes from healthcare, finance, HR, SaaS, education, legal, or other systems.

## Shape

```json
{
  "version": "v1",
  "mode": "fail-closed",
  "redact": ["national_id"],
  "mask": ["phone"],
  "tokenize": ["employee_id", "external_ref"],
  "hmac": ["tax_id"],
  "remove": ["street_address"],
  "allow": ["record_id", "status", "employee_id", "external_ref", "tax_id", "phone"],
  "deny": ["freeform_notes"]
}
```

## Modes

- **`fail-closed` (default):** sensitive fields detected by `detectPII` must be explicitly handled (rule match) or covered by **`allow`** when an allowlist is in use. Residual sensitive values after transform throw `IntelPacketPIIError`.
- **`permissive`:** unhandled paths are recorded on the report; **`failOnUnhandledPII: true`** in options can still force throws.

## Path syntax

- Dot paths: `account.holder.email`, `employees[].id`
- Array wildcard: **`items[].token`** (only `[]`, not `[0]`)

## Detector extensions

`detectPII(input, { sensitiveFieldNames: { case_ref: "legal", custom_attr: "custom" } })` merges extra name→category hints after built-in defaults.  
`protectPII` can pass the same via **`options.detectOptions`**.

## Conflicts

The same logical path cannot appear in more than one of: `redact`, `mask`, `tokenize`, `hmac`, `remove`, **`deny`**.

`allow` may overlap action paths (e.g. allow output fields that were explicitly transformed).

## Secrets

- `tokenize` requires `tokenSecret`
- `hmac` requires `hmacSecret`
- Missing secrets throw **`MISSING_TOKEN_SECRET`** / **`MISSING_HMAC_SECRET`**

## Dangerous segments

Segments `__proto__`, `constructor`, and `prototype` are rejected in policy paths.
