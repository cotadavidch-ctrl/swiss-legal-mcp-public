# Security

Security details are split across:

- `docs/security/network-security.md`
- `docs/security/content-security.md`
- `SECURITY.md`

Phase 9 adds privacy checks for procedural-strategy evaluation. The evaluation corpus must remain
anonymized and must not contain real names, full account numbers, addresses, personal docket
numbers, medical identifiers, bearer tokens, cookies or session identifiers.

The live procedural-strategy evaluation flag is opt-in and must not upload private case material to
third parties. The live artifact records only abstract queries, provider metadata, titles/snippets,
latency, warnings and hashes; it must not contain private documents, names, account numbers,
addresses, personal docket numbers or medical identifiers.

Human review packages use pseudonymous reviewer IDs and case hashes. Review imports must not include
names, account numbers, addresses, private docket numbers, medical identifiers, bearer tokens,
cookies or session identifiers.
