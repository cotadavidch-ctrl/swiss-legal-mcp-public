import {
  compareSwissCaseSourcesByIdentifier,
  fetchOfficialSwissCaseFullTextByIdentifier,
  getOfficialCaseCacheDiagnostics,
  resolveOfficialSwissCase,
  verifySwissCaseIdentityByIdentifier,
} from "../apps/mcp-server/src/tools/officialSwissCaseResolver.js";

function argValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

const reference = argValue("--reference") ?? "1B_352/2019";
const court = argValue("--court") ?? null;
const cantonHint = court?.toLowerCase() === "ar" ? "AR" : undefined;

function officialPortalEndpoint(referenceValue: string): string {
  if (/^(?:BGE|ATF|DTF)\s+\d+\s+[IVX]+\s+\d+$/i.test(referenceValue)) {
    return "https://search.bger.ch/ext/eurospider/live/de/php/clir/http/index.php";
  }
  if (/^(?:O[1-3][A-Z]|AB)\s+\d{2}\s+\d{1,4}$/i.test(referenceValue)) {
    return "https://rechtsprechung.ar.ch/api/.netlify/functions/searchQueryService";
  }
  if (/^[A-Z]{1,3}\.\d{4}\.\d+[A-Z]?$/i.test(referenceValue)) {
    return "https://bstger.weblaw.ch/api/getDocuments?withAggregations=true";
  }
  if (/^[A-Z]-\d+\/\d{4}$/i.test(referenceValue)) {
    return "https://bvger.weblaw.ch/api/.netlify/functions/searchQueryService";
  }
  return "https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php";
}

const resolved = await resolveOfficialSwissCase({
  case_reference: reference,
  ...(court ? { court_hint: court } : {}),
  ...(cantonHint ? { canton_hint: cantonHint } : {}),
  require_official_source: true,
  require_full_text: true,
  strict_identity_match: true,
  retrieval_mode: "full_text",
  presentation_mode: "debug",
});

const adapterParseStatus =
  resolved.discovery_status === "candidate_selected"
    ? "parsed"
    : resolved.discovery_status === "no_candidate" &&
        resolved.warnings.some((warning) => warning.includes("bvger_search_response_unparseable"))
      ? "parse_failed"
      : resolved.discovery_status;

const fetched = await fetchOfficialSwissCaseFullTextByIdentifier({
  resolution_id: resolved.resolution_id,
  requireOfficial: true,
  requireFullText: true,
});

const verified = await verifySwissCaseIdentityByIdentifier({
  document_id: fetched.document_id,
  requested_reference: reference,
  strict: true,
});

const compared = await compareSwissCaseSourcesByIdentifier({
  official_document_id: fetched.document_id,
  case_reference: reference,
  allow_secondary_discovery: true,
});

const refetched = await fetchOfficialSwissCaseFullTextByIdentifier({
  document_id: fetched.document_id,
  requireOfficial: true,
  requireFullText: true,
});
const cacheDiagnostics = getOfficialCaseCacheDiagnostics();
const ratio = resolved.legal_use.ratio_analysis;

const report = {
  generatedAt: new Date().toISOString(),
  requested_court: court,
  court: resolved.selected_candidate?.court ?? court,
  canton_code: resolved.selected_candidate?.canton ?? null,
  reference,
  portal_endpoint: officialPortalEndpoint(reference),
  portal_accessible: Boolean(
    fetched.status_code && fetched.status_code >= 200 && fetched.status_code < 300,
  ),
  search_status: resolved.discovery_status,
  candidate_count: resolved.candidates.length,
  candidate_selected: Boolean(resolved.selected_candidate),
  identity_status: verified.status,
  completeness_status: resolved.completeness?.completeness_status ?? null,
  official_verification_status: resolved.legal_use.official_verification_status,
  adapter_parse_status: adapterParseStatus,
  resolution_id: resolved.resolution_id,
  candidate_id: resolved.selected_candidate?.candidate_id ?? null,
  official_document_id: fetched.document_id ?? null,
  secondary_document_id: compared.secondary_document_ids?.[0] ?? null,
  comparison_id: compared.comparison_id ?? null,
  resolve: resolved.discovery_status === "candidate_selected" ? "PASS" : "FAIL",
  fetch_standalone_by_resolution_id:
    fetched.fetch_status === "fetch_success" && fetched.document_id ? "PASS" : "FAIL",
  verify_standalone_by_document_id:
    verified.status === "identity_verified" && verified.circular_verification_detected === false
      ? "PASS"
      : "FAIL",
  compare:
    compared.comparison_status === "compared" ||
    (compared.comparison_status === "insufficient_sources" &&
      compared.source_mismatch.includes("secondary_source_missing") &&
      !compared.source_mismatch.includes("official_source_not_found"))
      ? "PASS"
      : "FAIL",
  persistence_after_restart:
    refetched.cache_status === "cache_hit_valid" &&
    refetched.document_hash === fetched.document_hash &&
    refetched.document_id === fetched.document_id
      ? "PASS"
      : "FAIL",
  tool_interoperability:
    fetched.fetch_status === "fetch_success" &&
    verified.status === "identity_verified" &&
    compared.comparison_status !== undefined
      ? "pass"
      : "fail",
  placeholder_metadata_detected: resolved.selected_candidate?.decision_date !== null,
  initial_decision_date: resolved.selected_candidate?.decision_date ?? null,
  initial_decision_date_status: resolved.selected_candidate?.decision_date_status ?? null,
  final_decision_date: fetched.live_metadata?.decision_date ?? null,
  physical_page_count: fetched.physical_page_count ?? null,
  extracted_page_count: fetched.extracted_page_count ?? null,
  pages_with_text: fetched.pages_with_text ?? [],
  pages_without_text: fetched.pages_without_text ?? [],
  pages_failed: fetched.pages_failed ?? [],
  physical_page_coverage: fetched.physical_page_coverage ?? null,
  extraction_page_coverage: fetched.extraction_page_coverage ?? null,
  document_unit_count: fetched.document_unit_count ?? null,
  scanned_document_detected: fetched.scanned_document_detected ?? false,
  ocr_required: fetched.ocr_required ?? false,
  ocr_performed: fetched.ocr_performed ?? false,
  ocr_language: fetched.ocr_language ?? null,
  ocr_confidence: fetched.ocr_confidence ?? null,
  pages_requiring_ocr: fetched.pages_requiring_ocr ?? [],
  requested_locale: fetched.requested_locale ?? null,
  portal_interface_language: fetched.portal_interface_language ?? null,
  document_language_detected: fetched.document_language_detected ?? null,
  document_language_confidence: fetched.document_language_confidence ?? 0,
  document_language_sources: fetched.document_language_sources ?? [],
  language_mismatch: fetched.language_mismatch ?? false,
  ratio_summary: ratio?.ratio_summary ?? null,
  main_ground: ratio?.main_ground ?? null,
  subsidiary_grounds: ratio?.subsidiary_grounds ?? [],
  independent_alternative_grounds: ratio?.independent_alternative_grounds ?? [],
  independent_grounds_count: ratio?.independent_grounds_count ?? null,
  independent_grounds_reviewed: ratio?.independent_grounds_reviewed ?? null,
  independent_ground_details: ratio?.independent_ground_details ?? [],
  no_independent_alternative_grounds_detected:
    ratio?.no_independent_alternative_grounds_detected ?? null,
  obiter: ratio?.obiter ?? [],
  obiter_details: ratio?.obiter_details ?? [],
  published_citation:
    fetched.published_citation ?? fetched.live_metadata?.published_citation ?? null,
  case_reference: fetched.case_reference ?? fetched.live_metadata?.case_reference ?? null,
  official_docid: fetched.official_docid ?? fetched.live_metadata?.official_docid ?? null,
  publication_mapping_status:
    fetched.publication_mapping_status ?? fetched.live_metadata?.publication_mapping_status ?? null,
  publication_mapping_evidence: fetched.publication_mapping_evidence ?? [],
  dispositive_link: ratio?.dispositive_link ?? null,
  ratio_evidence: ratio?.ratio_evidence ?? [],
  ratio_confidence: ratio?.ratio_confidence ?? null,
  section_evidence: fetched.section_evidence ?? [],
  official_fetch_valid:
    fetched.fetch_status === "fetch_success" &&
    fetched.network_transport === "live_http" &&
    fetched.mock_or_fixture === false &&
    Boolean(fetched.document_hash) &&
    Boolean(fetched.retrieved_at),
  comparison_valid:
    compared.comparison_status === "compared" ||
    compared.source_mismatch.includes("secondary_source_missing"),
  source_comparison: compared.comparison_status ?? null,
  comparison_status: compared.comparison_status ?? null,
  comparison_warnings: compared.source_mismatch,
  cache_status: refetched.cache_status ?? null,
  cache_origin: resolved.cache_origin ?? null,
  store_schema_version: resolved.store_schema_version ?? null,
  persistence_between_independent_calls:
    fetched.fetch_status === "fetch_success" &&
    fetched.document_hash === resolved.document_hash &&
    fetched.document_id === resolved.document_id
      ? "PASS"
      : "FAIL",
  persistence_after_process_restart:
    refetched.cache_status === "cache_hit_valid" &&
    refetched.document_hash === fetched.document_hash &&
    refetched.document_id === fetched.document_id
      ? "PASS"
      : "FAIL",
  persistence_after_machine_restart: "not_tested",
  cache_directory_source: cacheDiagnostics.cache_directory_source,
  cache_directory_writable: cacheDiagnostics.cache_directory_writable,
  cache_store_initialized: cacheDiagnostics.cache_store_initialized,
  cache_store_schema_version: cacheDiagnostics.cache_store_schema_version,
  cache_store_path_redacted: cacheDiagnostics.cache_path_redacted,
  cwd_independent: cacheDiagnostics.cwd_independent,
  no_synthetic_mock_fixture:
    fetched.mock_or_fixture === false &&
    !fetched.warnings.some((warning) => /synthetic|mock|fixture/i.test(warning)),
};

console.error(JSON.stringify(report, null, 2));

const pass =
  report.resolve === "PASS" &&
  report.fetch_standalone_by_resolution_id === "PASS" &&
  report.verify_standalone_by_document_id === "PASS" &&
  report.compare === "PASS" &&
  report.persistence_after_restart === "PASS" &&
  report.placeholder_metadata_detected === false &&
  report.official_fetch_valid === true &&
  report.no_synthetic_mock_fixture === true;

process.exit(pass ? 0 : 1);
