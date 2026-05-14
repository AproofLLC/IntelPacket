# Contributing

Thank you for helping improve the IntelPacket Suite.

## Development setup

```bash
pnpm install
pnpm run build:core
pnpm run verify
```

`@intelpacket/pii` typechecks against built `@intelpacket/core` declarations; building core first avoids stale `dist` types.

Official npm package names are `@intelpacket/core` and `@intelpacket/pii`.

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm run verify:structure` | Monorepo layout, dependency direction, and packaging guardrails. |
| `pnpm -r run typecheck` | TypeScript across packages. |
| `pnpm -r test` | Vitest suites. |
| `pnpm -r run build` | `tsup` bundles to `dist/`. |
| `pnpm run verify` | `typecheck` + `test` + `build`. |
| `pnpm run pack:dry` | `npm pack --dry-run` for each publishable package. |

## Package boundaries

- **`@intelpacket/core` MUST NOT depend on `@intelpacket/pii`.**
- **`@intelpacket/pii` MUST depend on `@intelpacket/core`** (workspace `workspace:*` in this repo; compatible semver range when published).

Breaking boundary rules will fail `verify:structure`.

## Determinism and specs

- The engine is **deterministic** and **replay-integrity** oriented for supported inputs; changes that alter canonical output or hashes are **breaking** unless explicitly versioned and documented.
- Updates to [IntelPacket Spec v1](./packages/core/docs/intelpacket-spec-v1.md) or [PII Spec v1](./packages/pii/docs/intelpacket-pii-spec-v1.md) **SHOULD** include corresponding tests and API or spec cross-links.
- Do not claim transport protocols, binary interchange standards, or compliance certifications the code does not implement.

## Pull requests

- Keep diffs focused; avoid unrelated refactors.
- Ensure `pnpm run verify` passes locally before requesting review.
- If you change public exports, update [docs/API_REFERENCE.md](./docs/API_REFERENCE.md).

## Code of conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
