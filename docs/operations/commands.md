# Operations Commands

Local validation commands:

- `pnpm ci`: local offline CI chain.
- `pnpm test:security`: focused security tests plus local secret/doc checks.
- `pnpm test:integration`: live integration test files, skipped unless their environment flags are set.
- `pnpm benchmark`: writes `docs/release/generated/benchmark-baseline.json`.
- `pnpm release:prepare`: generates local release artifacts and dry-run pack metadata.
- `pnpm release:check`: evaluates the local release gate.

No command publishes externally.
