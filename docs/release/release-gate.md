# Release Gate

The local gate returns one of:

- `READY`: all required local artifacts exist, no blockers, no warnings.
- `READY WITH WARNINGS`: no blockers, but non-critical warnings remain.
- `BLOCKED`: one or more release blockers remain.

Current release policy blocks `READY` when:

- The project license is missing or not recorded consistently.
- SBOM, license inventory, API inventory, build hashes or release manifest are missing.
- Critical tests fail.
- Public API has not been inventoried.
- Secrets are detected outside tests/docs.
- Third-party dependency license metadata remains unknown after local package metadata and license-file inspection.

No script publishes packages, Docker images, Git tags, Git commits or remote releases.

As of Phase 7 hardening, DNS rebinding, explicit port policy, compression limits, PDF inspection and RDF inspection are covered by local code and offline tests. As of the Apache-2.0 owner decision, the previous `UNLICENSED` blocker is removed once regenerated artifacts confirm the license consistently.

# Additional Local Use Gate

The release gate now also requires:

- `pnpm test:claude-desktop` PASS against `/usr/local/bin/node apps/mcp-server/dist/stdio.js`.
- `pnpm test:updater` PASS.
- `pnpm test:breach-detection` PASS.
- `pnpm update-security:check` PASS.

The gate is BLOCKED if stdio requires an HTTP bearer token, fixtures appear in production,
stdout is contaminated, update signatures or hashes are not verified, rollback is unavailable,
or local breach-detection checks are missing.
