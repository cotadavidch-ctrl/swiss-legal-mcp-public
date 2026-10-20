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

Docker Compose requires two independently generated private values in an untracked
.env file: SWISS_LEGAL_MCP_POSTGRES_PASSWORD and SWISS_LEGAL_MCP_BEARER_TOKEN.
Copy .env.example and populate them with secure random values.
Services bind only to 127.0.0.1 for local development. Never expose these
ports publicly without reviewed authentication, TLS and network controls.

Static development credentials formerly in docker-compose.yml were removed.
They were not production credentials, but instances initialized from these
values must rotate both. Updating the Compose variable does not rotate a
PostgreSQL password in a persistent postgres_data volume. Change the live
PostgreSQL role password, or recreate a disposable empty development volume
after checking it holds no valuable data. Rotate any reused MCP bearer token.
The old Git commit is immutable and may remain visible in public history.
