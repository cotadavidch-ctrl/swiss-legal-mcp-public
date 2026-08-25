# Official Swiss case resolver fixtures

The resolver tests use synthetic, minimized judgment-like strings generated inside
`apps/mcp-server/tests/officialSwissCaseTools.test.ts`.

No real court judgment text is copied here. The fixture corpus is intentionally synthetic so tests
remain deterministic, offline and free of unnecessary third-party legal text.

Covered scenarios:

- complete official judgment;
- truncated official judgment;
- ambiguous candidate ranking;
- PDF-like passive extraction;
- error, challenge, login and rate-limit pages;
- unofficial aggregator headnote;
- aggregator without dispositive;
- official/secondary comparison mismatch;
- cache hit and invalidation;
- SSRF and non-allowlisted URL blocking.
