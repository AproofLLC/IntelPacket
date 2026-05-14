# Healthcare usage (one vertical among many)

IntelPacketPII is **not healthcare-only**. This page describes **one** common regulated context so teams can see how policies map to clinical-shaped JSON—**without** implying that IntelPacketPII is a HIPAA product or compliance solution.

## Role in a broader program

Use IntelPacketPII to apply **consistent transforms** (redact, mask, tokenize, HMAC, remove) to structured payloads that may contain PHI or other identifiers **before** packetization or downstream processing.

Organizational compliance still depends on deployment, contracts, access control, logging, key management, and legal review.

## Typical fields (examples)

Field names such as **MRN**, **DOB**, **patient identifiers**, and **payer/member identifiers** often appear in healthcare integrations. Map them with the same policy primitives used in any other industry:

- **Tokenize** stable identifiers needed for correlation without exposing raw values  
- **HMAC** stable digests for values that must not round-trip  
- **Redact** or **mask** where display-safe substitutes are enough  
- **Allowlist** to drop fields that are not approved to leave a given trust boundary  

## Detection notes

Built-in detection includes common clinical field names and generic patterns (e.g. SSN-shaped values). Operational timestamps are **not** treated as DOB unless the field name suggests birth date—reducing noisy classification on generic event times.

For institution-specific fields, extend detection with `detectOptions.sensitiveFieldNames` / `protectPII(..., { detectOptions })`.

## Related reading

- [industry-usage.md](./industry-usage.md) — cross-industry framing  
- [compliance-positioning.md](./compliance-positioning.md) — non-claims compliance language  
