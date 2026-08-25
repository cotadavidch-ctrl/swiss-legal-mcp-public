# Data Classification

Classes:

- Public: official published law and public metadata.
- Internal: build artifacts, release manifests, non-secret diagnostics.
- Confidential: local configuration, cache indexes, update history.
- Highly sensitive: case files, non-public decisions, health data, banking data, personal identifiers, credentials, tokens, process history and user-supplied documents.

Highly sensitive data must not be logged. Optional encrypted storage uses authenticated encryption.
