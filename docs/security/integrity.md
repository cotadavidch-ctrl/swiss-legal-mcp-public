# Integrity

Integrity checks include build hashes, SBOM, package inventory, release manifest, update manifest signatures and artifact hashes.

User-editable local configuration is not treated as tampering by default.

Administrative command:

```bash
pnpm --filter @swiss-legal-mcp/admin-cli exec tsx src/index.ts integrity verify
```
