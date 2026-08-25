# Claude Desktop Security

Required production command:

```json
{
  "command": "/usr/local/bin/node",
  "args": ["/absolute/path/to/swiss-legal-mcp/apps/mcp-server/dist/stdio.js"],
  "env": {
    "NODE_ENV": "production"
  }
}
```

Do not configure `NODE_ENV=test` or an HTTP bearer token for stdio.

Optional cache location:

```json
{
  "env": {
    "NODE_ENV": "production",
    "SWISS_LEGAL_CACHE_DIR": "/Users/<username>/Library/Caches/swiss-legal-mcp"
  }
}
```

If `SWISS_LEGAL_CACHE_DIR` is omitted on macOS, the official Swiss case resolver uses the user cache
directory `~/Library/Caches/swiss-legal-mcp`. It must never fall back to `/.cache`, even when Claude
Desktop starts the process with `/` as the working directory.

Acceptance is recorded in `docs/release/generated/claude-desktop-acceptance.json`.
