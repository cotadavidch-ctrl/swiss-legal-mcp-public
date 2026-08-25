# Update Signing

The updater verifies Ed25519 signatures with Node's maintained crypto implementation.

It verifies:

- manifest envelope signature over canonical JSON;
- artifact signature over artifact bytes;
- configured key ID;
- revoked key IDs;
- SHA-256 and size.

The repository contains no real signing secret. Tests generate disposable fixture keys in memory.
