# Network Security

Phase 7 status: hardened locally, with offline regression tests.

Implemented controls:

- HTTPS-only by default.
- Explicit port policy: default allowlist is port 443 only.
- HTTP/80 is allowed only when a caller creates an explicit provider/test exception.
- URLs with embedded credentials are rejected.
- Provider-specific domain allowlists are enforced before every request.
- Redirects are validated on every hop before follow-up fetches.
- Localhost, `.localhost`, loopback, RFC1918, link-local, carrier-grade NAT, unspecified, multicast/reserved IPv4, unique-local IPv6, link-local IPv6, multicast IPv6 and IPv4-mapped IPv6 private addresses are rejected.
- Raw public IP literals are rejected; providers must use configured official domains.
- Hostname DNS results are policy-checked before fetch, including multi-answer responses where any private/reserved result blocks the request.
- Response size limits apply to compressed bytes and decompressed bytes.
- gzip, deflate and brotli are supported with a maximum decompression ratio.
- Unknown or malformed compression encodings fail with typed errors.
- Timeouts use `AbortController`.
- Retries apply only to transient HTTP status codes and aborts, with backoff and jitter.
- Circuit breaker state is maintained by `SecureHttpClient`.

DNS rebinding strategy:

- The initial URL is validated syntactically and against provider allowlists.
- DNS is resolved through a controlled lookup hook before the request.
- The resolved addresses are checked for private, loopback, link-local, multicast, reserved and IPv4-mapped private ranges.
- Redirect targets repeat the same validation and lookup.
- Tests simulate DNS rebinding and rotating multi-answer DNS without network access.

Residual limitation:

The standard `fetch` API used here does not expose a portable way to pin the already-validated IP address to the subsequent TLS connection while preserving hostname/SNI validation. The implementation therefore reduces rebinding risk through immediate pre-fetch DNS validation and per-redirect validation, but it does not claim a cryptographic guarantee against a race between lookup and connection in all runtimes.

Release gate impact:

DNS rebinding, port policy and decompression-bomb controls are no longer technical blockers.
