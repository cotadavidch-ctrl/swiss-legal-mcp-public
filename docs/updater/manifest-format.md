# Update Manifest Format

Manifests use schema version `1` and are wrapped in an envelope:

```json
{
  "manifest": {
    "schemaVersion": 1,
    "project": "swiss-legal-mcp",
    "version": "1.0.1",
    "channel": "stable",
    "publishedAt": "2026-08-03T00:00:00.000Z",
    "expiresAt": "2027-08-03T00:00:00.000Z",
    "minimumNodeVersion": "22",
    "mcpProtocolCompatibility": { "minimum": "2025-06-18", "maximum": "2026-12-31" },
    "releaseSequence": 2,
    "artifacts": [],
    "securityAdvisories": [],
    "rollbackSupported": true,
    "signingKeyId": "configured-key"
  },
  "signature": "base64-ed25519-signature"
}
```

Unknown fields are rejected. Artifacts must declare platform, URL, SHA-256, size, signature and content type.
