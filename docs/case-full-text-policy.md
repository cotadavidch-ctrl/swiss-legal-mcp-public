# Case Full-Text Reading Policy

This project treats case-search results as locator material until the judgment text has been read completely.

Snippets, headnotes, summaries, indexes, isolated passages and citations in other judgments are not precedents. They can only produce `candidate_only` or `unverified_reference`.

## States

The executable policy in `apps/mcp-server/src/tools/jurisprudenceGuardrails.ts` records:

- `full_text_verified_official`: complete text read and verified against an official source.
- `full_text_read_unofficial`: complete text read from an unofficial aggregator, not official verification.
- `full_text_read`: complete text read, source not classified as official.
- `partial_text_only`: partial text only.
- `headnote_only`: only headnote or summary material.
- `snippet_only`: search-result snippet only.
- `inaccessible_full_text`: no full text available.
- `extraction_incomplete`: text retrieval/extraction exists but coverage, sections, pages, hash or source checks failed.

For traceability each report exposes source URL, retrieval time, reading completion time, document hash, extractor version, coverage percentage, read pages, read sections, unread ranges, missing sections and extraction errors.

## Completeness

Precedential use requires 100% coverage and review of facts, procedural history, party arguments, lower-authority reasoning where reproduced, reasoning, admissibility, standard of review, autonomous grounds, dispositif and costs. If a separate opinion exists, it must also be reviewed.

Ratio status is `ratio_confirmed` only when the full text has been read and facts, reasoning, dispositif and autonomous grounds have been reviewed. Otherwise it is `ratio_not_confirmed`.

## Degradation

If full text is not read, comparability is degraded to `candidate_only` or `unverified_reference`. The system adds warnings such as `full_text_not_read`, `full_text_not_verified`, `extraction_incomplete`, `missing_dispositif`, `missing_factual_section`, `missing_reasoning_section`, `missing_independent_ground_review`, `possible_context_loss`, `candidate_only`, `source_unofficial` and `full_text_source_mismatch`.

`comparable_direct`, `limited_analogy` and `general_analogy` are blocked until the reading policy allows precedential use.

## Tool Integration

The policy is applied in the shared jurisprudence guardrails used by:

- `resolve_official_swiss_case`
- `fetch_official_swiss_case_full_text`
- `verify_swiss_case_identity`
- `compare_swiss_case_sources`
- `verify_legal_citation`
- `search_cases` / `search_cases_by_reference` through procedural classification
- `get_case` / `get_case_metadata` as retrieval material, not automatic precedent
- `find_cited_sources`
- `build_case_citation_network`
- `analyze_procedural_strategy`
- `compare_legal_documents`
- `extract_legal_passages`
- the Swiss drafting/review tools

The drafting layer may retain a partial case in `controlReport.sources`, but `decisiveUseAllowed` is false and the clean draft must not silently incorporate that case as authority.

The official Swiss case resolver adds an official-source-first pipeline before these guardrails:
normalization, candidate ranking, identity verification, passive full-text fetch, completeness
review, official/secondary comparison and legal-use states. A secondary source can never become
`full_text_verified_official`, and an incomplete judgment keeps `ratio_status:
ratio_not_confirmed`.

## Safe Examples

- A snippet mentioning `Art. 29 BV` is returned as `candidate_only` with `full_text_not_read`.
- A full aggregator text is `full_text_read_unofficial` and carries `source_unofficial`; it is not `full_text_verified_official`.
- A judgment without dispositif or facts is `extraction_incomplete`; ratio remains `ratio_not_confirmed`.
- A source/hash mismatch emits `full_text_source_mismatch` or `document_hash_changed` and blocks precedential use.
