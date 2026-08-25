# Changelog

## Unreleased

- Adds an auditable official Swiss case resolver with four MCP tools:
  `resolve_official_swiss_case`, `fetch_official_swiss_case_full_text`,
  `verify_swiss_case_identity` and `compare_swiss_case_sources`.
- Adds deterministic multirole contradictory Swiss legal analysis with two MCP tools: `analyze_swiss_legal_positions` and `validate_multirole_legal_analysis`.
- Hardens the multirole validator after blind-case testing: correctly applied controls are informational, true violations use distinct codes/severities, Swiss-only jurisdiction is summarized as one confirmed dimension plus seven unverified procedural dimensions, and incomplete outcome scenarios remain conditional.
- Separates party arguments, authority arguments, court findings, neutral assessment and predicted outcomes so no role narrative becomes a judicial conclusion without verified support.
- Adds a deterministic Swiss legal drafting/review/rebuttal layer with eight MCP tools: `draft_swiss_legal_document`, `review_swiss_legal_document`, `validate_procedural_requirements`, `generate_rechtsbegehren`, `build_evidence_index`, `extract_challenged_passages`, `build_rebuttal_matrix`, `validate_swiss_legal_draft`.
- Adds `legal_drafting_check`, Swiss legal German guardrails, Rechtsbegehren generation, evidence/attachment indexing, quote-and-rebuttal, independent-ground checks and internal-transfer double-counting analysis.
- Adds an executable full-text judgment reading policy: snippets, headnotes and partial judgments remain `candidate_only` or `unverified_reference`, and cannot become decisive case law in procedural strategy or Swiss legal drafting.
- Hardens Swiss legal drafting state propagation: placeholders cannot pass essential checks, uncertain facts remain non-categorical, user-supplied quotes are not treated as source-verified, unavailable evidence is not used as current support, and every Rechtsbegehren keeps an audit trace.
- Splits drafting jurisdiction into concrete dimensions and expands evidence reporting so user assertions, tool availability, document verification, record status and Noven status no longer collapse into one ambiguous field.
- Hardens MCP legal outputs after Claude Desktop testing: federal case references can now carry explicit `officialCaseVerification` against covered Bundesgericht records, while `entscheidsuche.ch` remains a secondary aggregator trace.
- Adds conservative jurisprudential comparability guardrails for `analyze_procedural_strategy`, including structured dimensions and separation of ratio, obiter, party allegations, lower-authority reasoning and deciding-court reasoning.
- Adds legal-aid guardrails for Art. 29 Abs. 3 BV, Mitwirkungspflicht, Art. 56 ZPO and cantonal procedural law without automatic `unbeholfen` or automatic first-deficiency cure conclusions.
- Adds Fedlex temporal assessment fields so `endDate` and `isHistorical` remain source metadata rather than automatic legal applicability conclusions.

## 1.0.0 - 2026-08-03

- Licensed the project under Apache License 2.0 (`Apache-2.0`) with root `LICENSE` and `NOTICE`.
- Completed Release 1.0 local gate for the Swiss Legal MCP Server without external publication.
- Includes federal and cantonal source coverage documented through Phase 6, with inaccessible cantons documented rather than simulated.
- Provides the MCP server, admin CLI, provider registry, typed errors, structured logging, metrics, cache controls and local release tooling.
- Adds `packages/citations` and the seven activated advanced legal tools: `verify_legal_citation`, `identify_applicable_version`, `search_across_sources`, `extract_legal_passages`, `compare_legal_documents`, `find_cited_sources`, `build_case_citation_network`.
- Keeps `get_transitional_provisions` deliberately inactive because no existing provider offers reproducible transitional-provision data.
- Includes network hardening, DNS rebinding checks, explicit port policy, compression limits, passive PDF inspection and RDF guards.
- Adds deterministic procedural strategy analysis through `analyze_procedural_strategy`; it does not use AI and does not replace professional legal advice.
- Adds Phase 9 procedural-strategy evaluation: 15-case anonymized/controlled corpus, deterministic harness, JSON/Markdown reports and human review template.
- Adds Phase 10 partial advanced validation: five-case human-review package, exportable per-case reviewer artifacts, live evaluation artifact/report, reviewer schema, import validator, adjudication/calibration docs and release-gate warnings for missing qualified human review/calibration.
- Regenerates SBOM, license inventory, third-party notices, API inventory, build hashes, benchmark baseline, checksums, release manifest and package dry-run metadata.
- Known warnings: Docker is unavailable in this local environment, Git is not initialized, no external package/image/repository/release was published, and the dependency fixture `transport@0.0.1` remains a manual-review notice only.
- Adds `@swiss-legal-mcp/updater` with a manual secure updater core: signed manifest validation, Ed25519 verification, SHA-256 verification, anti-downgrade/replay policy, localhost-only test download path, atomic fixture install, rollback, local update history, AES-256-GCM object encryption, scrypt key derivation and deterministic breach-detection events.
- Adds `pnpm test:claude-desktop`, `pnpm test:updater` and `pnpm test:breach-detection`, and gates release checks on Claude Desktop stdio acceptance plus updater/security release acceptance.

No external package, image, tag or release has been published.
