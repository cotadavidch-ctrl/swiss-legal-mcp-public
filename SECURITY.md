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

### Local Docker Compose credentials (October 2026)

Docker Compose loads secrets from two untracked, required files:

- `postgres.env` containing `POSTGRES_PASSWORD`, accessible only to PostgreSQL.
- `mcp.env` containing `MCP_HTTP_BEARER_TOKEN`, accessible only to the MCP server.

Copy the matching `*.env.example` template to each private file, generate
independent random values, and restrict file permissions to the account owner.
Compose fails when either file is missing. Do not commit populated files.

Ports bind only to `127.0.0.1` for local development. Do not publish them
without reviewing authentication, TLS, firewall rules and deployment access.

The previous development password and token were hard-coded in public Git
history. Anyone who reused them in a running installation must rotate both.
Environment changes alone do not update existing PostgreSQL role passwords
stored in a persistent `postgres_data` volume; perform an in-database
password rotation or, for a disposable empty development volume, recreate
it after verifying that no data needs to be preserved. Historic Git commits
remain publicly accessible even after current files have been corrected.
