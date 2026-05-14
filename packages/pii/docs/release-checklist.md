# Release checklist (`@intelpacket/pii`)

Use this before tagging or publishing. IntelPacketPII is **privacy-preserving preprocessing** for structured data with PII; it is **industry-agnostic** and runs **before** IntelPacket packetization. It **does not** make an organization compliant by itself.

## Compliance wording (non-claims)

IntelPacketPII does not make an organization compliant by itself. It provides privacy-preserving preprocessing controls that can support privacy-aligned architectures when combined with proper deployment, access control, audit logging, contractual controls, key management, retention policies, and legal review.

## Steps

1. Confirm **package name** is `@intelpacket/pii` and **version** in `package.json` is intended for release.
2. Confirm **repository URL** (`package.json` → `repository.url`) matches the actual GitHub repository (update before publish if the repo moved).
3. Run **`pnpm run typecheck`** (or `npx --yes pnpm@9.15.0 run typecheck`).
4. Run **`pnpm test`** — full suite including core + PII.
5. Run **`pnpm run test:pii`** — dedicated PII suite under `tests/pii/`.
6. Run **`pnpm run build`** — produces `dist/`.
7. Run **`pnpm run bench:pii`** — smoke-check multi-industry timings (machine-dependent; do not treat as SLA).
8. Optionally run **`pnpm bench`** and **`pnpm run bench:50x`** if IntelPacket Core benches are part of your gate.
9. Run **`npm pack --dry-run`** — inspect tarball: should include `dist/`, `README.md`, `LICENSE`, `package.json`, `docs/`; must **not** include `tests/`, `examples/`, `benchmarks/`, `node_modules`, or `.env` files.
10. **`git status`** — working tree clean; no accidental `dist/` or secrets (if not using a release automation that commits tags only).
11. **Tag** the release (e.g. `v0.1.0`) on the commit that passed the checks.
12. **Publish** to npm with an authenticated registry login: `npm publish` (or `pnpm publish`) from package root.

## After publish

- Verify the package page and `npm view @intelpacket/pii`.
- Optionally run `npm pack @intelpacket/pii` from a temp dir to confirm consumer tarball shape.
