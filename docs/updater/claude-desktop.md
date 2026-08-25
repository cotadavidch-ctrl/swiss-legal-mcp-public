# Claude Desktop After Updates

The updater does not edit Claude Desktop configuration.

After an update, run:

```bash
pnpm test:claude-desktop
```

This starts `/usr/local/bin/node apps/mcp-server/dist/stdio.js` with `NODE_ENV=production`, verifies initialize, `tools/list`, mandatory tools, absence of fixtures, stdout cleanliness and clean shutdown.
