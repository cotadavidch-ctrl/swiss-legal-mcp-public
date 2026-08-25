# Live evaluation

Live evaluation is opt-in and is not run by the normal offline suite.

Run only with anonymized abstract legal issues:

```sh
RUN_LIVE_PROCEDURAL_STRATEGY_EVAL=true pnpm eval:procedural-strategy --all
```

For `legal-aid-ar`, use abstract queries about legal aid, economic capacity, transfer between own accounts, Art. 56 ZPO, incomplete bank documentation, later-filed evidence, advance on costs, right to be heard and remittal.

The latest controlled run writes:

- `docs/release/generated/procedural-strategy-live-evaluation.json`
- `docs/procedural-strategy/live-evaluation-report.md`

Do not send names, account numbers, addresses, private documents, personal docket numbers or medical identifiers.

The current live harness uses `entscheidsuche.ch` through its public MCP endpoint with hard per-request timeouts. It records selected, adverse and distinguishable candidates from provider-returned metadata/snippets, then leaves final legal comparability to human review.
