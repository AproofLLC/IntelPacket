# Privacy report

`protectPII` always returns both **`data`** (transformed payload) and **`report`**.

Reports are **industry-agnostic**: the same structure is used for clinical, financial, HR, SaaS, education, legal, or operational records.

## Report fields (paths only)

The report lists **field paths** and **high-level categories** from detection. It must **not** include raw PII values or secrets.

Key fields:

- `fields_detected` — output of `detectPII(input)` before transforms (honors `protectPII` → `detectOptions` when set)
- `fields_redacted`, `fields_masked`, `fields_tokenized`, `fields_hmac`, `fields_removed`, `denied_fields`
- `unhandled_sensitive_fields` — paths still considered sensitive under policy (permissive mode)
- `safe_for_packetization` — `true` only when post-transform detection finds no unresolved sensitive fields and unhandled list is empty
- `raw_pii_present` — boolean synopsis of residual risk

## `createPrivacyReport(input, transformed, policy, detectOptions?)`

Rebuilds an approximate report by diffing **input vs transformed** (inferred redact/mask/token/HMAC/remove) and running **`detectPII` + pattern scans** on the transformed value. Optional **`detectOptions`** should match what you used during `protectPII` if you customized detection.

## `verifyPrivacyResult(result)`

Deterministic checks (not a compliance or blockchain proof):

- Honors `safe_for_packetization` / `raw_pii_present`
- Re-runs `detectPII` on output (with allowlist waivers from the report)
- Scans string leaves for **SSN-like patterns**
