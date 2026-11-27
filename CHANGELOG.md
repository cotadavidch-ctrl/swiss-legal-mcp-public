# Changelog

## 1.2.0 - 2026-11-27

- Version bump to 1.2.0 across all workspace packages and the MCP server identity.

- Adds `prepare_legal_council` and `validate_legal_council`: a strategy council with five simulated voices (own lawyer, opposing counsel, favorable, strict and neutral judge). The server prepares each voice's brief from already verified material (procedural routes, known-rule deadlines, grounds, a case-law research plan) and validates what the model writes: cited norms and case law against official sources, facts used, role leakage, guarantee language, overstated confidence, undifferentiated judges, cross-review and a synthesis that hides the strongest counter-argument. Tool input is strict snake_case; an unknown field now returns an error listing the valid fields (also for nested objects).
- Adds `analyze_case_corpus_style` (recurring formulas, structure and citations of a corpus of federal judgments, time-budgeted and resumable).
- Procedural rules registry (ZPO, BGG, OR, DBG with literal excerpts and verification date): routes for civil claims, sale defects, appeal to the Federal Supreme Court and tax assessment feed `analyze_procedural_strategy`.
- Federal court portal protection: request pacing with jitter and a per-minute cap, cooldown persisted to disk when the portal challenges the client, disk cache of read decisions. No bypass of any protection; requests are slower and spread out.
- Corpus size: pagination reaches beyond the first page, dispositive formulas of single-judge decisions and simplified-procedure facts are recognised, BGE full texts are found, and a pool warning explains short corpora.
- Citations: abbreviation-based resolution of articles ("Art. 100 BGG"), social-insurance ordinances (UVV, KVV, AVIV, IVV, AHVV, ATSV and FR/IT forms), per-work resolution preferring the in-force version, exact match when verified live.
- Case numbers of the former Federal Insurance Court (EVG, until 2006: "I 122/06", "U 122/06", "K 45/04") are recognised, searched in the portal's own spelling and verified by their docid (checked live with I 122/06).
- Four Swiss litigation plugins (civil, administrative and social insurance, labour, criminal) generated from one source (`plugins/src`, `node scripts/build-plugins.mjs`): 14 original skills (matter intake, chronology and evidence, deadlines, appeal, Federal Supreme Court, citation review, confidentiality, court-mail triage). Every article cited was checked against Fedlex and a test keeps skills in sync with the real tools.
- `compute_legal_deadline`: new rule sets `ZPO_BERUFUNG_ANTWORT`, `ZPO_BERUFUNG_ANTWORT_SUMMARISCH` (Art. 312 and 314 ZPO) and `OR_MIETE_KUENDIGUNG_ANFECHTUNG` (Art. 273 OR); `stillstandExempt: false` confirms an ordinary procedure so the result is firm and no earlier "safe date" is shown.
- `generate_rechtsbegehren` quotes only the amount and interest in a payment request; `validate_legal_council` warns with `no_authorities_cited` when no voice cites case law.
- `analyze_procedural_strategy` now returns verified procedural rules (literal excerpts checked against Fedlex on 2026-11-24) for social insurance (ATSG), tenancy, debt enforcement (SchKG), criminal procedure (StPO), employment termination (OR 336b) and federal administrative procedure (VwVG), not only civil and tax cases. `prepare_legal_council` suggests the Federal Supreme Court chamber by subject and drops useless search words.
- `validate_legal_council` now tells a case number the portal does not know (`authority_not_found`, error) apart from one that could not be checked (`authority_unverified`, warning); it only asserts non-existence when the portal answered and there is no sign of blocking, cooldown or network failure. Reviewer and target names of one character are accepted.
- `generate_rechtsbegehren` no longer reports `contradictory_requests` when the remand is requested as subsidiary (eventualiter, hilfsweise) and recognises more wordings of a remand request. Family-law skill added to the civil plugin.
- Swiss litigation plugins expanded to 104 original skills: civil 42, administrative and social insurance 39, labour 50, criminal 49, with twelve shared matter-management skills.
- Sale and works routes include the 60-day defect-notice rules in force since 1 January 2026 (Art. 201 Abs. 4, 367 Abs. 1bis, 370 Abs. 4 OR) with a transitional-law warning, and flag Art. 219 Abs. 3 OR as repealed.
- Every plugin skill now carries the information to request, the deliverable, typical mistakes, a final quality checklist and, where it cites law, the literal official text of each cited article (`articulos.md`, fetched from Fedlex).
- Procedural-strategy tests write reports to a temporary folder instead of the repository.
- Local deploy script with live smoke test and rollback (`scripts/deploy-local.mjs`).

## 1.1.0 - 2026-11-17

- Version bump to 1.1.0 across all workspace packages and the MCP server identity.
- Downloads from official sources (including `*.bger.ch` through the pinned TLS chain) now enforce a byte limit WHILE receiving: a declared `Content-Length` above the limit is rejected immediately and a stream without it is cut as soon as it exceeds the limit (previously the whole body was buffered before the size check).

- `consistencyFindings` adds `arithmeticMismatches` (a stated surplus, shortfall or balance that no subtraction of two or three of the amounts cited in the decision produces), compares values with a maximum stated in the same sentence, and counts months and number words ("sechs Monate"). Review flags now recognise "kann nicht angefochten werden" and "non è dato alcun ricorso" as excluded appeal, "il n'est pas nécessaire de vérifier" as refused examination, and a relative mentioned in one sentence with presumed support in the next; the origin-based-treatment entry also fires on Italian wording. Found by running the tool on three self-written decisions (DE, FR, IT) with planted defects.

- Citations of VGG/LTAF, SVG/LCR, MWSTG/LTVA, ArG/LTr, GlG/LEg, USG/LPE and BPG/LPers are recognised and verified against Fedlex (each checked live). Full test suite: 1449 passed, 0 failed.

- Citations of KVG/LAMal, UVG/LAA, BVG/LPP, DBG/LIFD, StHG/LHID, RPG/LAT, VZAE/OASA and BüG/LN are recognised and verified against Fedlex (SR where unique, ELI where the SR is ambiguous), each checked live.

- IVG (SR 831.20) and AHVG (SR 831.10) articles are now recognised and verified (also as LAI and LAVS), and the knowledge base adds a verified entry on disability pensions (Art. 28 and 7 IVG: thresholds, integration before pension, duty to reduce incapacity).

- Federal citations written in French or Italian ("art. 29 al. 2 Cst.", "article 9 Cst.", "art. 43, 49 et 52 LPGA", "art. 29 cpv. 2 Cost.") are now recognised and verified in the language of the citation; before, only German "Art." forms were picked up, so French and Italian decisions got no automatic norm check.

- Cantonal laws are read in their current version only, so an article that is not found there no longer rejects a finding as "non-existent": the finding stays `quote_only` and `automaticFindings` reports `cantonal_article_not_in_current_version` (it may have been repealed or renumbered). Excerpts of cantonal articles no longer carry HTML residue.

- Cantonal articles numbered with "§" (AG, ZG and others) are now found (the article lookup normalises "Art." and "§"), "§ N SIGLA" citations are verified like "Art. N SIGLA" in cantons with article reading, and the most cited laws whose catalogue titles carry no abbreviation (SHG, VRPG/VRG/VRP, StG, BauG/PBG) are resolved by exact title when the match is unique. This fixes a false "article not found" for "§"-numbered cantonal laws.

- Knowledge base: verified ATSG entries for recovery of benefits (Art. 25), duties to inform and collaborate (Art. 27 and 28) and cantonal insurance-court procedure (Art. 61 lit. c, g, h).

- `prepare_decision_review` `consistencyFindings` adds `sameReferenceConflicts` (a sentence that gives two different amounts or day counts to "the same" month/period/source, including a nil value against an amount and number words such as "vier und elf Tage") and detects contrasted dates written without a year.

- Knowledge base: verified entries for unemployment-insurance suspensions (Art. 30 AVIG paras. 1-3, Art. 43 ATSG paras. 1 and 3: causes, competent authority, 60-day maximum, written record of oral information) and foreigners-law measures (Art. 62 and 96 AIG).

- Decision review: cantonal articles cited with a law abbreviation (e.g. "Art. 2 BauG") are now resolved against the official catalogue of the declared canton (one unique title ending in the abbreviation; ambiguous or missing stays unverified) in the 19 LexWork cantons and Geneva, so any of their laws can be checked without a hand-kept table. Evidence and internal-inconsistency checklist items now also suggest Art. 29 para. 2 BV.

- Cantonal verification in the decision review: Geneva (SIL) now serves individual articles (`get_cantonal_article`), extracted from the full text by the "Art. N" heading sequence and rejected when the heading is not found; LGD (rsg_l1_20) and LPA (rsg_e5_10) of Geneva and ALVG (361.0), SHG (381.1) and VRP (951.1) of St. Gallen are registered after reading their identifiers from the official portals. Zurich articles remain unverifiable: the law text is only published as PDFs on a host that refused the declared client.
- Knowledge base: verified ground on notification and execution before notification (Art. 49 ATSG, Art. 34 VwVG).

- `prepare_decision_review` adds `consistencyFindings` (deterministic candidates read from the decision itself): values above a maximum or below a minimum the decision states (days, CHF), dates in tension or an effect dated before its cause, and ATSG appeal period/authority mismatches (Art. 52 and 60 ATSG, only when ATSG/AVIG is cited). It now reads article lists ("Art. 43, 49 und 52 ATSG"), "Art. 4 Abs. 1 und 2 ZUG" and French cantonal citations, recognises an appeal instruction without a heading and French/German exclusions of appeal, and warns when `canton` conflicts with the collection marks in the text (LS, bGS, BSG, sGS, SAR). New knowledge-base entries: origin-based treatment (Art. 8 para. 2 BV), ATSG appeal instruction and AR VRPG (Art. 18, 34, 55); AR VRPG articles are now verifiable.
- `verify_review_findings` adds `normFit` per finding (general-clause-only, specific, specific-weak) and `supportedOnlyByGeneralClauses`, and no longer emits the lexical signal for general BV guarantees.

- `prepare_decision_review` now resolves every cited federal article in Fedlex on its own (non-existent articles are flagged automatically, existing ones come with their official text), recognises ZUG, AIG and AsylG, and returns `knownIssues` from a verified knowledge base (`legalGroundsRegistry.ts`): competence of a service instead of the authority (Obergericht AR O4V 21 28, 28.04.2022, E. 4.3-4.4), minimum-residence-duration grounds (ZUG 4 and 12, AIG 61a, AsylG 82, BV 12) and sibling support (ZGB 328, 329), each with literal excerpts, identifier and verification date.
- `analyze_decision_document` now returns `reviewFlags`: challengeable points of an authority decision (excluded or missing appeal instruction, no legal basis cited, examination declared unnecessary, sibling support without basis in Art. 328 ZGB, Art. 12 BV emergency aid not examined, budgetary rationale, voluntary-benefit claim, unproven presumptions), each with the literal sentence, its location and only norms read from Fedlex. Also fixes negated admissions ("wird nicht anerkannt") being reported as strong admissions.
- Adds `analyze_opposing_submission`: reads the opposing party's submission and returns admissions, contradictions (within a document, across documents and against record facts), unsubstantiated or absolute assertions and non-literal quotations of statutes and case law, each with the literal sentence and its location, review questions and a DE/FR draft rebuttal that turns the opponent's own wording against them. Also checks paraphrased deadlines and percentages against the cited article, flags own allegations the opponent left unanswered (ZPO) and analyzes the own submission for exposure. Heuristic; findings are candidates for human validation.
- Adds `compute_legal_deadline` (deterministic procedural deadlines with legal basis per step) for ATSG, VwVG, BGG, SchKG, ZPO (Berufung, Beschwerde, summary) and StPO (Beschwerde, Berufung, Einsprache contra Strafbefehl); StPO has no Fristenstillstand (Art. 89 para. 2 StPO).
- Adds `analyze_decision_document` (heuristic intake of administrative decisions from text or PDF) and `verify_quoted_passages` (literal quote verification with near-match detection); unverified quotes now block `readyForFiling`.
- Official federal judgments are read through `www.bger.ch` with a pinned intermediate certificate (scoped to `*.bger.ch`); judgment text no longer carries portal navigation, CSS or editorial noise.
- Fedlex article text is now extracted in document order (superscript sub-items such as Art. 336c lit. c-bis to c-quinquies CO) and editorial notes are separated from normative text; `isHistorical` is false for in-force versions with a scheduled end date; SR numbers shared with a repealed act resolve to the applicable consolidation.
- Fixes the cantonal ZH search treating HTTP 204 (no matches) as a provider outage.
- Adds `scripts/deploy-local.mjs` (backup, build, smoke tests, live portal check, rollback), `scripts/portal-canary.mjs` and `scripts/ailc-tool-regression.mjs`.

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
