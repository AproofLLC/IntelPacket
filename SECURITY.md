# Security

## Scope

This project provides **deterministic structured-data packetization** and an **optional privacy preprocessing** layer. Security behavior is limited to what is implemented and described in:

- [packages/core/docs/intelpacket-spec-v1.md](./packages/core/docs/intelpacket-spec-v1.md)
- [packages/pii/docs/intelpacket-pii-spec-v1.md](./packages/pii/docs/intelpacket-pii-spec-v1.md)
- [docs/API_REFERENCE.md](./docs/API_REFERENCE.md)

There are **no warranties** beyond what you validate in your own environment.

## What we do not guarantee

- **No compliance certification** (HIPAA, GDPR, SOC 2, etc.) from using these libraries alone.
- **No encryption product** — callers must handle encryption in transit or at rest where required.
- **No access control** — authorization and key management are out of scope.
- **No transport security** — this is not a network protocol implementation.

## Reporting a vulnerability

Please report security-sensitive issues **privately** to the maintainers (replace with your project contact, for example a GitHub **Security Advisories** tab or `security@example.com`). Include:

- Affected package(s) and version(s)
- Minimal reproduction or proof-of-concept
- Impact assessment if known

Public issues for non-sensitive bugs are welcome via the issue templates.

## Deterministic validation

`verifyIntelPacket` and schema-backed assertions provide **integrity checks** against documented fields and limits. They do **not** replace threat modeling, secure deployment, or review of caller-supplied secrets (`tokenSecret`, `hmacSecret`) for the PII layer.
