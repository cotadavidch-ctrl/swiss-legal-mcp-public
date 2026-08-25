# Updater Threat Model

Primary threats: tampered manifest, tampered artifact, downgrade, replay, wrong channel, unsafe paths, symlink writes, oversized payloads, unauthorized host, and accidental update during MCP activity.

Controls: strict Zod schemas, Ed25519 verification, SHA-256 verification, monotonic `releaseSequence`, SemVer comparison, channel policy, path normalization, restrictive modes, local history, explicit confirmation, and rollback.

Residual risk: there is no published update service yet, no transparency log integration, and operator key custody must be handled outside this repository.
