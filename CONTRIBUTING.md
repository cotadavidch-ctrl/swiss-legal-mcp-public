# Contributing

Use Node `>=22` and `pnpm@11.17.0`.

Before proposing changes, run:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
NODE_ENV=test pnpm test
pnpm build
```

Do not add new legal providers or activate new MCP tools without documented real-source evidence and tests.

Do not commit generated secrets, local credentials, package publication tokens or private config files.

Contributions to this repository are made under Apache License 2.0 (`Apache-2.0`) unless a separate written agreement says otherwise. See `LICENSE` and `NOTICE`.
