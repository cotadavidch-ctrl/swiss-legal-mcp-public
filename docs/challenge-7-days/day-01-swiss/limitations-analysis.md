# Day 01 Limitations Analysis

Status: PASS

Scope: analysis only. No code, tests, RC, tarball, dependencies or MCP configuration were modified.

## Evidence Read

Files reviewed:

- `docs/challenge-7-days/day-01-swiss/judge-selection.md`
- `docs/challenge-7-days/day-01-swiss/corpus.json`
- `docs/challenge-7-days/day-01-swiss/style-analysis.md`
- `docs/challenge-7-days/day-01-swiss/swiss-federal-court-writing-style.md`
- `docs/challenge-7-days/day-01-swiss/example-brief.md`
- `docs/challenge-7-days/day-01-swiss/generic-vs-skilled-comparison.md`
- `docs/challenge-7-days/day-01-swiss/metadata.json`

Relevant code inspected for planning only:

- `apps/mcp-server/src/tools/entscheidsucheTools.ts`
- `packages/providers/entscheidsuche/src/entscheidsucheProvider.ts`
- `apps/mcp-server/src/tools/officialSwissCaseTools.ts`
- `apps/mcp-server/src/tools/officialSwissCaseResolver.ts`
- `apps/mcp-server/tests/officialSwissCaseTools.test.ts`
- `packages/providers/entscheidsuche/src/entscheidsucheProvider.test.ts`

## Observed State

- Verified official corpus: 8 full-text decisions.
- Minimum target: 50 decisions.
- Objective target: 60 decisions.
- Selected profile: II. zivilrechtliche Abteilung.
- Language: German.
- Individual judge style: not supported.
- Tools used: `search_cases`, `resolve_official_swiss_case`, `get_law`.

## Summary

The Day 1 limitation is not that Swiss Legal MCP failed to verify individual cases. The resolver produced high-quality identity and full-text states for selected cases. The blocking problem is the lack of a deterministic corpus-building path: official federal discovery, chamber/language/period filtering, BGE-to-case mapping, batch resolution, checkpointing and structured export.

## Limitations

### LIM-001 - Corpus Too Small

- Type: METHODOLOGY
- Severity: P1
- Tool affected: all Day 1 workflow tools
- Evidence: `metadata.json` records `verified_full_text_cases: 8`; `judge-selection.md` records target 50-70 and actual 8.
- Cause probable: manual discovery and resolution could not scale to 50 verified official full-text decisions.
- Impact: style output must remain PARTIAL; no representative chamber profile.
- Proposed solution: implement an official corpus-building workflow with discovery, batch resolution and export.
- Probable files affected: `apps/mcp-server/src/tools/officialSwissCaseTools.ts`, `apps/mcp-server/src/tools/officialSwissCaseResolver.ts`, new helper under `apps/mcp-server/src/tools/`.
- Tests needed: end-to-end offline corpus builder fixture with 60 candidates, partial failure handling, checkpoint resume.
- Regression risk: medium; corpus tooling must not alter existing single-case resolver behavior.
- Acceptance criterion: one run can produce at least 50 `full_text_verified_official` decisions for a configured chamber/language/period without manual copy-paste.

### LIM-002 - `search_cases` Is Aggregator-Based

- Type: MCP
- Severity: P1
- Tool affected: `search_cases`
- Evidence: `judge-selection.md` states aggregator results were used only for discovery; `entscheidsucheTools.ts` describes `search_cases` as using entscheidsuche.ch and warning that it is not official.
- Cause probable: current search capability is intentionally routed through an unofficial aggregator.
- Impact: discovery needs a second official verification step for every candidate; source status is not official at search time.
- Proposed solution: do not weaken `search_cases`; add official federal discovery capability or a federal-only mode that clearly uses `search.bger.ch`.
- Probable files affected: `apps/mcp-server/src/tools/officialSwissCaseTools.ts`, `apps/mcp-server/src/tools/officialSwissCaseResolver.ts`.
- Tests needed: offline official search HTML fixtures; assertion that source status is official and aggregators are not authority.
- Regression risk: low if added as a separate official path.
- Acceptance criterion: federal searches return official candidate references with source attribution `swiss_federal_supreme_court`.

### LIM-003 - No Federal-Only Official Search Surface

- Type: MCP
- Severity: P1
- Tool affected: no dedicated tool exists
- Evidence: Day 1 used `search_cases` plus single-case `resolve_official_swiss_case`; no artifact records a federal official search tool.
- Cause probable: the resolver can resolve references, but it is not a corpus search/list API.
- Impact: reaching 50-70 decisions depends on ad hoc query construction.
- Proposed solution: create `search_federal_cases` only if implemented against official federal search, not as a thin alias to `search_cases`.
- Probable files affected: `apps/mcp-server/src/tools/officialSwissCaseTools.ts`, `apps/mcp-server/src/tools/officialSwissCaseResolver.ts`.
- Tests needed: query, date range, language, chamber prefix, pagination and official attribution.
- Regression risk: low.
- Acceptance criterion: `search_federal_cases` can discover at least 100 official candidate references for `5A`, German, selected period in paginated fixture tests.

### LIM-004 - Chamber Filtering Is Not First-Class

- Type: MCP
- Severity: P1
- Tool affected: `search_cases`, `resolve_official_swiss_case`
- Evidence: `corpus.json` selected II. civil division, but current `SearchCasesParams` exposes `court`, not a validated federal `chamber` or division filter; resolver normalizes chamber only after a reference exists.
- Cause probable: search and resolution are separated; chamber is metadata in resolver, not a discovery constraint.
- Impact: manual filtering is required to keep the corpus homogeneous.
- Proposed solution: add `chamber`/`division` filters to the official federal search and corpus export pipeline; keep resolver input backward compatible.
- Probable files affected: `apps/mcp-server/src/tools/officialSwissCaseTools.ts`, `apps/mcp-server/src/tools/officialSwissCaseResolver.ts`, `apps/mcp-server/tests/officialSwissCaseTools.test.ts`.
- Tests needed: `5A` accepted, `4A` excluded from primary corpus, comparator tagging preserved.
- Regression risk: medium if chamber labels are confused with case-number prefixes.
- Acceptance criterion: a query for II. civil division returns only `5A`/`5D` or explicitly mapped II. civil decisions according to a documented chamber mapping.

### LIM-005 - Judge And Composition Filtering Is Unsupported

- Type: SOURCE
- Severity: P2
- Tool affected: corpus construction, resolver metadata
- Evidence: `judge-selection.md` rejects individual judge style because official decisions verify composition but not drafting author; `style-analysis.md` says no judge should be credited as author from `Besetzung`.
- Cause probable: official judgments expose panel composition, not individual authorship.
- Impact: individual judge style cannot be supported honestly.
- Proposed solution: allow composition search only as metadata filtering, with explicit `no_authorship_inference`; do not create a judge-style claim.
- Probable files affected: `apps/mcp-server/src/tools/officialSwissCaseResolver.ts`, corpus export helper.
- Tests needed: composition filter labels output as `composition_match`, not `author_match`.
- Regression risk: high if UI wording implies authorship.
- Acceptance criterion: any judge/composition filter returns a warning that presence in composition is not authorship.

### LIM-006 - BGE-To-Case Mapping Is Partial

- Type: MCP
- Severity: P1
- Tool affected: `resolve_official_swiss_case`
- Evidence: `corpus.json` excluded `BGE 133 III 350` and `BGE 134 III 332` because official BGE excerpts had missing dispositive; Day 1 used underlying case numbers where available.
- Cause probable: official BGE pages and full Aza case pages are different official surfaces, and mapping is not exposed as a dedicated workflow.
- Impact: BGE citations can resolve to official extracts but remain unsuitable as full-text corpus entries.
- Proposed solution: extend resolver with explicit `published_citation -> case_reference` mapping result, or create `resolve_bge_to_case` only if mapping cannot be cleanly represented inside existing resolver output.
- Probable files affected: `apps/mcp-server/src/tools/officialSwissCaseResolver.ts`, `packages/citations/src/parser.ts`, `apps/mcp-server/tests/officialSwissCaseTools.test.ts`.
- Tests needed: BGE exact citation maps to official report plus underlying case reference; missing full text blocks corpus inclusion.
- Regression risk: medium.
- Acceptance criterion: BGE references produce structured fields: `official_report_status`, `underlying_case_reference`, `full_text_case_status`.

### LIM-007 - Pagination Is Inefficient For Massive Discovery

- Type: PROVIDER
- Severity: P1
- Tool affected: `search_cases`
- Evidence: `entscheidsucheProvider.ts` documents cursor-based pagination where `page > 1` walks earlier pages sequentially and discards intermediate results.
- Cause probable: backend uses opaque `search_after` cursors, not random-access pages.
- Impact: large corpus discovery via aggregator is slow and fragile.
- Proposed solution: official federal search should expose cursor/checkpoint rather than fake random-access pages; batch workflow should persist next cursor.
- Probable files affected: `packages/providers/entscheidsuche/src/entscheidsucheProvider.ts` if aggregator path is reused; preferably new official federal discovery helper.
- Tests needed: resume from cursor, no repeated earlier pages, deterministic ordering.
- Regression risk: low if existing pagination contract is left unchanged.
- Acceptance criterion: a corpus run can continue from the last official cursor/checkpoint.

### LIM-008 - No Batch Resolution API

- Type: MCP
- Severity: P1
- Tool affected: `resolve_official_swiss_case`
- Evidence: Day 1 resolved cases manually one by one; no artifact or tool shows batch input.
- Cause probable: resolver is designed for individual legal-use verification.
- Impact: 60-case corpus requires many manual calls and cannot reliably checkpoint partial success.
- Proposed solution: add `batch_resolve_official_cases` or an internal batch mode used by `export_case_corpus`.
- Probable files affected: `apps/mcp-server/src/tools/officialSwissCaseTools.ts`, `apps/mcp-server/src/tools/officialSwissCaseResolver.ts`.
- Tests needed: mixed successful, incomplete, metadata-only and timeout results; concurrency limit; stable ordering.
- Regression risk: medium due live network load if not throttled.
- Acceptance criterion: batch resolves 60 references offline with per-item legal-use status and no all-or-nothing failure.

### LIM-009 - Deduplication Is Manual At Corpus Level

- Type: MCP
- Severity: P2
- Tool affected: corpus construction
- Evidence: `metadata.json` records `duplicates_detected: 0`, but this was a manual/documented corpus result; resolver has candidate duplicate fields, not corpus-wide export dedup.
- Cause probable: deduplication exists at candidate level, not across a full corpus run.
- Impact: joined proceedings, BGE/case-number overlaps and repeated search hits can inflate counts.
- Proposed solution: corpus exporter should deduplicate by `document_hash`, `canonical_url`, `normalized_reference`, `official_docid` and joined-proceeding relationships.
- Probable files affected: new corpus helper; `apps/mcp-server/src/tools/officialSwissCaseResolver.ts`.
- Tests needed: duplicate search hits, BGE plus case-number pair, joined proceedings.
- Regression risk: medium; over-deduplication could remove legitimate joined but separate decisions.
- Acceptance criterion: exported corpus reports duplicate groups and keeps one canonical included record.

### LIM-010 - Legal-Use Statuses Are Rich But Not Export-Normalized

- Type: MCP
- Severity: P2
- Tool affected: `resolve_official_swiss_case`, corpus export
- Evidence: `corpus.json` manually distinguishes `full_text_verified_official`, comparator and excluded records such as official extract and metadata-only.
- Cause probable: resolver returns rich statuses per case, but no corpus schema normalizes them for selection.
- Impact: users must interpret and manually classify records.
- Proposed solution: define corpus-level statuses: `included_full_text_official`, `official_extract_only`, `metadata_only`, `secondary_source_only`, `excluded_incomplete`, `excluded_identity`.
- Probable files affected: new corpus schema helper, `apps/mcp-server/src/tools/officialSwissCaseTools.ts`.
- Tests needed: all statuses serialized consistently.
- Regression risk: low.
- Acceptance criterion: `export_case_corpus` produces the four-way distinction required by Day 1 without manual editing.

### LIM-011 - Language Selection Can Drift

- Type: SOURCE
- Severity: P2
- Tool affected: `resolve_official_swiss_case`
- Evidence: `corpus.json` excluded `5A_154/2014` because a German-profile request received a French document with language mismatch warning.
- Cause probable: official case language is determined by the proceeding; portal interface language does not guarantee document language.
- Impact: German corpus construction may include French or Italian decisions unless language is validated after fetch.
- Proposed solution: strict corpus filter on `document_language_detected` and official metadata language; non-matching items are excluded or stored as comparators.
- Probable files affected: corpus builder/exporter; resolver language validation.
- Tests needed: requested German but official French document, expected exclusion.
- Regression risk: low.
- Acceptance criterion: exported German corpus has `language: de` and excludes language mismatches by default.

### LIM-012 - Matter And Period Selection Are Manual

- Type: METHODOLOGY
- Severity: P2
- Tool affected: `search_cases`, corpus workflow
- Evidence: `corpus.json` includes mixed subjects: debt enforcement, child maintenance, adult protection, revision proceedings; selected profile says emphasis on civil appeals and related simplified proceedings.
- Cause probable: no structured subject taxonomy or period selection was enforced during discovery.
- Impact: style model may mix ordinary merits decisions with simplified non-entry decisions.
- Proposed solution: add explicit corpus criteria: chamber prefixes, date range, language, remedy type, subject keywords, simplified-procedure inclusion flag.
- Probable files affected: corpus builder; maybe official federal search input schema.
- Tests needed: include/exclude by date range, matter labels and remedy keyword.
- Regression risk: low.
- Acceptance criterion: corpus metadata explains selected period and matter distribution.

### LIM-013 - No Structured Corpus Export Tool

- Type: MCP
- Severity: P1
- Tool affected: missing
- Evidence: Day 1 manually created `corpus.json`; `metadata.json` records files created but no tool-generated corpus manifest.
- Cause probable: tools are legal lookup/resolution oriented, not dataset construction oriented.
- Impact: repeated challenge runs are not reproducible enough.
- Proposed solution: create `export_case_corpus` after or alongside batch resolution.
- Probable files affected: `apps/mcp-server/src/tools/officialSwissCaseTools.ts`, new `caseCorpusTools.ts` or helper module.
- Tests needed: JSON schema validation, stable sorting, source trace preservation, partial-state export.
- Regression risk: low if additive.
- Acceptance criterion: export contains cases, exclusions, source policy, counts, filters, hashes, warnings and run metadata.

### LIM-014 - Timeouts And Runtime Load Are Unplanned For 60 Live Resolutions

- Type: MCP
- Severity: P2
- Tool affected: resolver workflow
- Evidence: Day 1 manually used `timeout_policy: long`; no corpus artifact has timing, retry or checkpoint metadata.
- Cause probable: individual resolver timeout policy exists, but no workload-level scheduler.
- Impact: large runs may fail midway or stress official sources.
- Proposed solution: controlled concurrency, provider-specific rate limit, backoff, retry budget and checkpointed continuation.
- Probable files affected: batch/corpus helper; resolver transport if retry hooks need exposure.
- Tests needed: simulated timeout, retry, cancellation, partial output.
- Regression risk: medium.
- Acceptance criterion: a 60-case run survives individual timeouts and records per-case failure reasons.

### LIM-015 - Traceability Is Per Document, Not Per Corpus Run

- Type: MCP
- Severity: P2
- Tool affected: corpus workflow
- Evidence: `corpus.json` stores URLs and document IDs, but not resolution IDs, retrieval timestamps, metadata hashes or document hashes for every included case.
- Cause probable: manual artifact simplified resolver output.
- Impact: later audit cannot fully reproduce every decision state.
- Proposed solution: export all trace fields already produced by resolver: `resolution_id`, `candidate_fingerprint`, `metadata_hash`, `document_hash`, `retrieved_at`, `cache_status`, `warnings`.
- Probable files affected: corpus exporter.
- Tests needed: required trace fields present for included and excluded items.
- Regression risk: low.
- Acceptance criterion: every corpus entry is auditable without re-running live network calls.

### LIM-016 - Official Source Does Not Support Individual Authorship

- Type: SOURCE
- Severity: P3
- Tool affected: judge/composition selection
- Evidence: `judge-selection.md` and `swiss-federal-court-writing-style.md` explicitly reject individual judge imitation and authorship attribution.
- Cause probable: published decisions list judicial composition, not the drafter.
- Impact: individual-judge challenge variant is not achievable from these sources.
- Proposed solution: keep individual style unsupported; allow only institutional chamber style or composition-presence studies.
- Probable files affected: documentation and guardrails only unless new composition filters are added.
- Tests needed: no tool output labels a listed judge as author.
- Regression risk: high if wording changes are sloppy.
- Acceptance criterion: all outputs preserve `individual_judge_attribution_status: not_supported`.

### LIM-017 - Statutes Were Verified At Law-Version Level Only

- Type: METHODOLOGY
- Severity: P3
- Tool affected: `get_law`
- Evidence: `example-brief.md` states article-level application must be checked against official Fedlex before real filing.
- Cause probable: Day 1 did not require statutory article extraction; it used laws as verified authority context.
- Impact: example brief cannot be filing-ready.
- Proposed solution: for future drafting challenges, add article-level Fedlex extraction or require explicit article lookup before article quotation.
- Probable files affected: existing Fedlex tools if article extraction is expanded; otherwise documentation.
- Tests needed: article-level retrieval by SR/ELI/article number.
- Regression risk: medium if legal text parsing is overclaimed.
- Acceptance criterion: article citations include verified article text/status or are labelled law-level only.

### LIM-018 - Official Extract, Metadata, Secondary Source And Full Text Need Hard Selection Gates

- Type: MCP
- Severity: P1
- Tool affected: resolver plus corpus construction
- Evidence: `corpus.json` excludes official BGE extracts, metadata-only `5A_391/2007`, partial `5A_154/2014`, missing-dispositive `5A_54/2014`, and includes only full-text official decisions.
- Cause probable: resolver exposes legal-use states but corpus selection was manual.
- Impact: accidental inclusion of unusable records is easy in large runs.
- Proposed solution: implement corpus gate rules that include only `identity_verified`, `source_status: official`, `reading_status: full_text_verified_official`, `completeness_status: complete`, unless explicitly exported as excluded.
- Probable files affected: corpus exporter and tests.
- Tests needed: all four status classes and exclusions.
- Regression risk: low.
- Acceptance criterion: corpus export cannot count official extracts, metadata-only records or secondary sources as verified full-text cases.

## Required Topic Analysis

### a. Búsqueda exclusiva de jurisprudencia federal

Current state: absent as a dedicated official tool. `search_cases` can search broadly through an aggregator. `resolve_official_swiss_case` can verify federal cases after a reference is known.

Needed: official federal discovery through `search.bger.ch` with explicit source attribution.

### b. Filtrado por sala

Current state: resolver can detect chamber from case number and live metadata. Search does not expose first-class chamber filters.

Needed: validated `chamber` filter and documented mapping from prefixes such as `5A`/`5D` to the selected civil division.

### c. Filtrado por juez o composición

Current state: composition is extracted from official headers; authorship is not available.

Needed: optional composition-presence filtering with a permanent warning that this is not authorship.

### d. Resolución de citas BGE a expedientes reales

Current state: BGE official pages can resolve but may be official extracts with missing dispositive. Underlying case mapping is not a clean user-facing workflow.

Needed: explicit BGE-to-underlying-case mapping status.

### e. Paginación y recuperación masiva

Current state: aggregator pagination is cursor-based and sequential for pages. No massive official recovery workflow exists.

Needed: cursor checkpointing and stable official discovery.

### f. Batch resolve de sentencias oficiales

Current state: not available as a public tool.

Needed: additive batch resolver with concurrency and per-item status.

### g. Deduplicación

Current state: candidate-level duplicate metadata exists; corpus-level dedup was manual.

Needed: corpus dedup by official identifiers, hashes and joined proceedings.

### h. Diferenciación entre source statuses

Current state: resolver has the required concepts; corpus selection applies them manually.

Needed: corpus gate that serializes `full_text_verified_official`, `official_extract`, `metadata_only` and `secondary_source`.

### i. Selección por idioma, materia y periodo

Current state: language and dates exist in some inputs; matter selection is manual. Language must be validated after fetch.

Needed: explicit corpus filters and post-fetch validation.

### j. Exportación estructurada de corpus

Current state: manual JSON artifact.

Needed: `export_case_corpus` or equivalent internal function.

### k. Timeouts y rendimiento

Current state: single-case timeout policy exists; no workload-level scheduler.

Needed: rate limits, retry budget, backoff and checkpointing.

### l. Trazabilidad de cada documento

Current state: resolver returns rich fields; Day 1 corpus stored only a subset.

Needed: export all resolution identifiers, hashes, timestamps and warnings.

### m. Capacidad real para alcanzar 50-70 sentencias

Current state: possible in principle, not operationally supported by the current user-facing workflow. The blocker is official filtered discovery plus batch/corpus tooling.

Needed: official federal search plus batch resolver and corpus export. Expected result after first fix: 50-70 for a broad 5A/5D German period, assuming official site availability and respectful rate limits.
