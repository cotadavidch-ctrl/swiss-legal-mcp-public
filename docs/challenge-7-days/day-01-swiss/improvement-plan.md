# Day 01 Improvement Plan

Status: READY_FOR_IMPLEMENTATION

Scope: technical plan only. Do not modify code until the next implementation task.

## Goal

Enable a repeatable Day 1 rerun that can produce 50-70 official, identity-verified, full-text Swiss Federal Supreme Court decisions for the selected profile:

`II. zivilrechtliche Abteilung, German-language institutional style.`

## Tool Design Assessment

### Extend `search_cases`

Recommendation: do not use this as the primary fix.

Reason: `search_cases` is explicitly aggregator-based through entscheidsuche.ch. Extending it into an official federal search would blur source semantics and could weaken the current warning contract. It may later accept extra filters for discovery convenience, but not as the official corpus authority.

### Create `search_federal_cases`

Recommendation: yes, if implemented against official Swiss Federal Supreme Court search.

Reason: a new official-source tool cleanly separates official federal discovery from unofficial aggregator discovery. It should return candidates, not legal-use-ready precedents.

Required inputs:

- `query`
- `language`
- `chamber`
- `dateFrom`
- `dateTo`
- `pageSize`
- `cursor`
- `requireOfficialSource`

Required output:

- official candidate references;
- canonical official URL;
- decision date if available;
- chamber;
- language;
- next cursor/checkpoint;
- source attribution;
- warnings.

### Add Filters By Chamber

Recommendation: yes.

Reason: chamber filtering is necessary to build a homogeneous corpus. The filter should be explicit and validated. It should not rely only on free-text query matching.

### Add Filters By Judge/Composition

Recommendation: only as composition-presence metadata, not judge authorship.

Reason: the official source verifies composition but not individual authorship. Any filter must emit `no_authorship_inference`.

### Create `resolve_bge_to_case`

Recommendation: maybe, but first try to extend `resolve_official_swiss_case`.

Reason: BGE resolution is naturally part of official case resolution. A separate tool is justified only if the workflow needs a simple public function that maps `BGE 133 III 350` to official report plus underlying case reference without fetching full text.

Preferred approach:

- Add a `published_citation_resolution` block to `resolve_official_swiss_case`.
- Include `official_report_status`, `underlying_case_reference`, `underlying_case_resolution_status`.

### Create `batch_resolve_official_cases`

Recommendation: yes.

Reason: the single resolver is high quality but not usable at 60-case scale manually. Batch resolving should be additive and keep per-item status.

Required behavior:

- controlled concurrency;
- per-item timeout;
- retry budget;
- no all-or-nothing failure;
- deterministic ordering;
- checkpoint output;
- preserve every resolver warning.

### Create `export_case_corpus`

Recommendation: yes, but it can be implemented as a tool wrapping `search_federal_cases` and `batch_resolve_official_cases`, or as a reusable internal function first.

Reason: Day 1 needs a structured corpus artifact with inclusion/exclusion gates, traceability, counts and limitations.

## Recommended First Fix

Implement official federal discovery plus corpus export as a narrow vertical slice:

1. Add `search_federal_cases` for official Swiss Federal Supreme Court discovery.
2. Add internal batch resolution used by corpus export.
3. Add `export_case_corpus` only if the internal helper proves stable and the MCP surface remains clean.

If scope must be smaller, start with `search_federal_cases` and a script/internal helper, then expose `batch_resolve_official_cases` in a second step.

## Recovery Strategy For 60 Decisions

### 1. Discovery

Use official federal search only.

Initial filters:

- court family: Swiss Federal Supreme Court;
- language: German;
- chamber/prefix: `5A` and optionally `5D` for II. civil-law division related simplified proceedings;
- period: broad enough to reach 80-120 candidates, for example 2014-2026;
- matter keywords optional, not mandatory for the first 60.

Search should over-collect candidates because some will be excluded.

Target discovery count: 100-140 candidates.

### 2. Federal Filtering

Keep only official Swiss Federal Supreme Court candidates. Reject aggregator-only entries before resolution.

### 3. Deduplication

Deduplicate before and after resolution:

- before resolution by normalized reference and canonical URL;
- after resolution by document hash, metadata hash, official docid, canonical URL and joined-proceeding relation.

### 4. Official Resolution

Resolve each candidate with:

- `require_official_source: true`
- `require_full_text: true`
- `strict_identity_match: true`
- `retrieval_mode: full_text`
- `language_hint: de`

### 5. Status Gate

Include only records where:

- `identity.status == identity_verified`
- `source_status == official`
- `fetch.fetch_status == fetch_success`
- `completeness_status == complete`
- `reading_status == full_text_verified_official`
- `document_language_detected == de`

Export but do not count:

- official extracts;
- metadata-only records;
- language mismatches;
- missing dispositive;
- secondary-only discoveries;
- identity mismatches.

### 6. Control Of Concurrency

Use conservative defaults:

- concurrency: 2-4 live requests;
- per-item timeout: resolver default or long for official site only;
- retry: 1-2 attempts for transient network failures;
- backoff: exponential with jitter;
- global cap: stop after 60 included or 140 candidates processed.

### 7. Checkpointing

Persist checkpoint after every candidate:

- input filters;
- discovery cursor;
- processed references;
- included references;
- excluded references and reasons;
- retry counts;
- last successful item;
- run warnings.

### 8. Validation

Before export completion:

- count included cases;
- verify no duplicates;
- verify all included source URLs are official;
- verify all included records are German;
- verify all included records are full-text official;
- verify excluded records retain reasons.

### 9. Export

Export:

- corpus JSON;
- exclusion JSON;
- summary markdown;
- source manifest;
- trace manifest with hashes and resolution IDs.

## Implementation Phases

### Phase A - Official Federal Search

Add `search_federal_cases` with offline fixture tests.

Likely files:

- `apps/mcp-server/src/tools/officialSwissCaseTools.ts`
- `apps/mcp-server/src/tools/officialSwissCaseResolver.ts`
- `apps/mcp-server/tests/officialSwissCaseTools.test.ts`

Acceptance:

- official search returns federal candidates from fixture HTML;
- filters by language/date/chamber;
- returns cursor/checkpoint;
- does not use entscheidsuche as authority.

### Phase B - Batch Resolve

Add internal batch resolver and possibly MCP tool `batch_resolve_official_cases`.

Likely files:

- `apps/mcp-server/src/tools/officialSwissCaseTools.ts`
- `apps/mcp-server/src/tools/officialSwissCaseResolver.ts`
- `apps/mcp-server/tests/officialSwissCaseTools.test.ts`

Acceptance:

- resolves mixed list deterministically;
- per-item errors do not abort the batch;
- checkpoint and warnings are preserved;
- concurrency limit is testable.

### Phase C - Corpus Export

Add `export_case_corpus` if the public MCP surface is justified. Otherwise keep it as an internal script used for validation artifacts.

Likely files:

- `apps/mcp-server/src/tools/caseCorpusTools.ts` or a helper under `apps/mcp-server/src/tools/`
- `apps/mcp-server/src/registry.ts`
- `apps/mcp-server/tests/caseCorpusTools.test.ts`

Acceptance:

- produces a JSON corpus matching Day 1 fields;
- separates included, comparators and excluded;
- validates schema;
- includes traceability fields.

## Test Plan

Required offline tests:

- official federal search fixture with 120 hits;
- chamber filter includes `5A`, excludes `4A` unless comparator mode;
- language mismatch exclusion;
- BGE official extract mapped but not counted;
- metadata-only excluded;
- missing dispositive excluded;
- duplicate BGE/case-number pair deduplicated;
- joined proceedings handled without double counting;
- batch resolution partial failures;
- timeout retry and checkpoint resume;
- export schema validation.

Required live/integration tests:

- one official federal search page;
- one BGE-to-case resolution;
- one 5A full-text resolution;
- one corpus smoke run capped at 5.

## Risks

- Official site structure may change.
- Chamber mapping by case prefix may be incomplete.
- Composition filtering can be misread as authorship.
- Batch runs could overload official services if concurrency is too high.
- Strict gates may still fail to reach 50 if the selected period is too narrow.

## Expected Outcome

After the recommended first fix, a broad German `5A`/`5D` official federal run should be able to collect at least 50 full-text verified official decisions, probably 60, provided the official site remains available and rate limits are respected.

Estimated corpus after fix: 50-70 included cases from 100-140 discovered candidates.

## Non-Goals

- No new legal providers.
- No individual judge authorship model.
- No use of aggregators as primary authority.
- No weakening of existing legal-use statuses.
- No automatic legal conclusion from style similarity.
