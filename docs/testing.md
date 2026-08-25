# Testing

The normal test suite is offline by default and must not depend on Internet access.

## Main commands

- `NODE_ENV=test pnpm test`
- `pnpm test:coverage`
- `pnpm test:security`
- `pnpm test:updater`
- `pnpm test:breach-detection`
- `pnpm test:claude-desktop`
- `pnpm test:integration`
- `pnpm eval:procedural-strategy`
- `pnpm review:procedural-strategy --prepare`
- `pnpm run ci`

## Procedural strategy evaluation

Phase 9 adds a deterministic evaluation harness for `analyze_procedural_strategy`.

- Corpus: `tests/fixtures/procedural-strategy/cases.json`
- Harness: `apps/mcp-server/scripts/procedural-strategy-eval.ts`
- JSON report: `docs/release/generated/procedural-strategy-evaluation.json`
- Markdown report: `docs/procedural-strategy/evaluation-report.md`

The harness evaluates structure and legal safety properties, not textual similarity. It checks fact
classification, chronology, missing documents, competence, procedural route, deadlines, evidence,
case-law conservatism, strategy, counteranalysis, traceability, confidence and privacy.

The corpus is small and controlled. It is useful for regression and calibration, not statistical
claims about real-world performance.

## Swiss legal drafting regression

`apps/mcp-server/tests/legalDraftingTools.test.ts` covers the eight drafting/review/rebuttal MCP
tools through the in-memory MCP transport. The tests cover administrative Einsprache, cantonal
Beschwerde, legal-aid requests, Fristerstreckung, Akteneinsicht, Rechtsvorschlag, out-of-court
letters, unconfirmed remedy/deadline/essential data, official versus aggregator case law, literal
quotes versus paraphrase, party allegations, bank-record contradictions, internal transfer
double-counting, zero intermediate balance, bank fees, independent grounds, unjustified Willkuer,
attachments, Noven risk, Swiss German orthography, terminology, tone, clean/control-layer separation
anti-invention checks and full-text case-law degradation before clean-draft use.

## Case full-text reading policy

`apps/mcp-server/tests/officialSwissCaseTools.test.ts` covers the official Swiss case resolver with
offline synthetic fixtures: BGer/BGE/ATF/BVGer/BStGer/cantonal/URL normalization, candidate ranking,
identity verification, full-text fetch states, completeness, SSRF blocking, unofficial fallback,
source comparison, cache invalidation and legal-use eligibility for citation, strategy, drafting and
multirole consumers.

The resolver no longer generates official judgment text in production. Offline tests inject a test
HTTP transport; production verification requires `network_transport: live_http`,
`mock_or_fixture: false`, byte count, hash and a real retrieval timestamp.

`pnpm test:official-case-live --reference 1B_352/2019` runs an optional real-network Federal
Supreme Court check outside CI.

The Federal Criminal Court adapter has optional live checks against the official BStGer Weblaw
database:

```bash
pnpm test:official-case-live --court bstger --reference SK.2023.1
pnpm test:official-case-live --court bstger --reference RR.2024.1
pnpm diagnose:official-case-pipeline --court bstger --reference SK.2023.1
```

The Appenzell Ausserrhoden adapter has optional live checks against the official
`rechtsprechung.ar.ch` portal:

```bash
pnpm test:official-case-live --court ar --reference "O2V 19 21"
pnpm test:official-case-live --court ar --reference "O1S 18 1"
pnpm diagnose:official-case-pipeline --court ar --reference "O2V 19 21"
```

The AR checks must report `canton_code: "AR"`, `court: "Obergericht Appenzell Ausserrhoden"`,
`network_transport: "live_http"`, `mock_or_fixture: false`, `identity_verified` and
`full_text_verified_official`.

`apps/mcp-server/tests/jurisprudenceGuardrails.test.ts` includes offline regression cases for the
strict judgment reading gate:

- complete official judgment;
- complete aggregator-only judgment;
- headnote-only and snippet-only material;
- later reasoning changing an early fragment;
- autonomous/subsidiary grounds;
- incomplete extraction, missing dispositif, missing facts, omitted pages and truncated
  considerations;
- allegations confused with ratio, arbitrary-review summaries and obiter;
- partial-case attempts in procedural strategy and drafting;
- official/aggregator mismatch, changed hash, separate opinions and unread final consideration.

The expected safe degradation is `candidate_only` or `unverified_reference` plus warnings. Partial
judgments must not become `comparable_direct`, `limited_analogy` or `general_analogy`.

## Live evaluation

Live procedural-strategy evaluation is opt-in only:

```sh
RUN_LIVE_PROCEDURAL_STRATEGY_EVAL=true pnpm eval:procedural-strategy --all
```

The normal suite does not execute live evaluation and must not send private case files to third
parties.

The controlled live run writes:

- `docs/release/generated/procedural-strategy-live-evaluation.json`
- `docs/procedural-strategy/live-evaluation-report.md`

It uses abstract legal queries only and records provider latency, warnings, selected authorities,
adverse authorities, privacy validation and confidence before/after.

## Human review import

Phase 10 adds a prepared human-review package:

- package: `docs/procedural-strategy/human-review/`
- exportable package: `artifacts/procedural-strategy-human-review/`
- import command: `pnpm review:procedural-strategy --import <path>`
- generated report: `docs/release/generated/procedural-strategy-human-validation.json`

The import command rejects hash mismatches, duplicate reviewers, invalid scores, missing comments
for scores below 3 and inconsistent finding status. The repository does not include fake human
reviews.

## Claude Desktop acceptance

`pnpm test:claude-desktop` starts:

```sh
NODE_ENV=production /usr/local/bin/node apps/mcp-server/dist/stdio.js
```

It performs MCP initialize, `tools/list`, mandatory tool checks, fixture absence checks, basic calls
to `verify_legal_citation`, `analyze_procedural_strategy`, `analyze_swiss_legal_positions` and
`resolve_official_swiss_case`, stdout cleanliness and clean shutdown.

## Updater and breach detection

`pnpm test:updater` is fully offline except a controlled local `localhost` server. It validates
manifest signatures, artifact signatures, hash and size, channel policy, replay/downgrade rejection,
safe paths, atomic fixture install and rollback.

`pnpm test:breach-detection` validates AES-256-GCM authenticated encryption, scrypt derivation,
key rotation, event classification, redaction and protected incident-file permissions.

## Why typecheck/build say 17 of 18

`pnpm-workspace.yaml` includes `apps/*`, `packages/*` and `packages/providers/*`. Together with the
root package there are 18 workspace package manifests.

`pnpm -r --if-present run typecheck` and `pnpm -r --if-present run build` report
`Scope: 17 of 18 workspace projects` because pnpm recursive execution excludes the workspace root
package from the recursive target set. The excluded project is the root `swiss-legal-mcp` package.
This is intentional and safe here:

- the root package has no `tsconfig.json`;
- the root scripts are orchestration scripts that call the 17 real TypeScript packages/apps;
- distributed contents are validated through app/package builds, API inventory, build hashes and
  pack dry-run;
- the root does not contain compiled TypeScript sources that would be skipped.
