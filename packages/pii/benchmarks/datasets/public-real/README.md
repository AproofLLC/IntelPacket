# PII public-real safe benchmark datasets

These fixtures are public-safe, fake-identity datasets for `@intelpacket/pii` advanced benchmarks. They are small seed corpora that the runner repeats deterministically to the requested scale.

No file contains real users, real phone numbers, real emails, real secrets, credentials, private data, or copied support exports. Emails use reserved domains such as `example.invalid`; phone-like values use synthetic `555` ranges.

| Dataset | Purpose | Source type | Sanitization notes | License/source reference | Why selected |
| --- | --- | --- | --- | --- | --- |
| `sanitized-user-records.json` | User profile rows with policy-covered fields | Generated fake identities | Reserved emails, fake names, synthetic account IDs | Generated fixture | Exercises common user-record protection |
| `public-webhook-users.json` | User-shaped webhook payloads | Generated safe subset inspired by public webhook docs | Fake customer IDs, reserved emails, synthetic phones | Generated fixture; public docs shape reference only | Exercises nested webhook envelopes |
| `fake-support-tickets.json` | Support tickets containing fake customer metadata | Generated fake support records | No real tickets; all names/emails/notes are synthetic | Generated fixture | Exercises mixed safe text and policy-covered sensitive fields |
| `synthetic-audit-users.json` | Audit rows with synthetic actors | Generated fake audit identities | Reserved service/user emails, fake IDs, synthetic names | Generated fixture | Exercises audit-like repeated actors and metadata |

These public-real safe datasets improve coverage beyond pure synthetic entropy classes, but they still are not identical to private production traffic. PII benchmark behavior is workload-dependent and policy-dependent.
