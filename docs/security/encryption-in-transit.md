# Encryption In Transit

Provider access requires HTTPS unless a test explicitly uses local `localhost`.

HTTP transport security remains bearer-token protected in production. Tokens belong in headers, not URLs.

stdio is local IPC and does not use TLS. It must not be described as encrypted; local protection relies on OS permissions and disk encryption.
