# Security Policy

Do not publish secrets, bearer tokens, cookies, private keys or session identifiers in issues, logs, fixtures or documentation.

Report security findings privately to the project owner until a public reporting channel is chosen.

Current security posture:

- HTTP MCP requires a bearer token outside `NODE_ENV=test`.
- Logs redact common secret fields.
- Provider network access is allowlisted where `SecureHttpClient` is used.
- DNS rebinding, port policy, compression limits, PDF inspection and RDF guards are covered by local offline tests.
- The project license is Apache License 2.0 (`Apache-2.0`); security reports do not alter license or warranty terms in `LICENSE`.

# Security Addendum: Updater and Local Detection

Swiss Legal MCP includes a manual updater core. It is not automatic, does not run remote scripts and
does not edit Claude Desktop configuration.

Security controls added for local use:

- Ed25519 manifest and artifact verification.
- SHA-256 artifact verification.
- Anti-downgrade and anti-replay release policy.
- Explicit confirmation for install and rollback.
- AES-256-GCM optional object encryption.
- scrypt key derivation for password-backed keys.
- Local breach-detection events with redaction and restrictive file modes.
- Claude Desktop stdio production acceptance.

See `docs/updater/` and `docs/security/` for current limits and procedures.
