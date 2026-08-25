import {
  fetchOfficialSwissCaseFullTextByIdentifier,
  normalizeSwissCaseReference,
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

const result = await resolveOfficialSwissCase({
  case_reference: reference,
  ...(court ? { court_hint: court } : {}),
  ...(cantonHint ? { canton_hint: cantonHint } : {}),
  require_official_source: true,
  require_full_text: true,
  strict_identity_match: true,
  retrieval_mode: "refresh",
  presentation_mode: "debug",
});
const recovered = result.resolution_id
  ? await resolveOfficialSwissCase({
      resolution_id: result.resolution_id,
      presentation_mode: "debug",
    })
  : null;

const fetch = result.fetch;
const standaloneFetch = result.resolution_id
  ? await fetchOfficialSwissCaseFullTextByIdentifier({
      resolution_id: result.resolution_id,
    })
  : null;
const standaloneIdentity =
  result.document_id || result.resolution_id
    ? await verifySwissCaseIdentityByIdentifier({
        document_id: result.document_id ?? undefined,
        resolution_id: result.resolution_id,
        requested_reference: reference,
      })
    : null;
const ratio = result.legal_use.ratio_analysis;
const report = {
  generatedAt: new Date().toISOString(),
  court,
  reference,
  normalization: normalizeSwissCaseReference(reference),
  official_search: result.attempts,
  discovery_status: result.discovery_status,
  candidate_count: result.candidate_count,
  candidates: result.candidates.map((candidate) => ({
    candidate_id: candidate.candidate_id,
    source_adapter: candidate.source_adapter,
    source_url: candidate.source_url,
    reference: candidate.reference,
    published_citation: candidate.published_citation ?? null,
    case_reference: candidate.case_reference ?? null,
    official_docid: candidate.official_docid ?? null,
    publication_mapping_status: candidate.publication_mapping_status ?? null,
    publication_mapping_evidence: candidate.publication_mapping_evidence ?? [],
  })),
  selected_candidate_id: result.selected_candidate_id,
  resolution_id: result.resolution_id,
  ambiguity_status: result.ambiguity_status,
  selection_blockers: result.selection_blockers,
  recovered_discovery_status: recovered?.discovery_status ?? null,
  recovered_candidate_count: recovered?.candidate_count ?? null,
  recovered_selected_candidate_id: recovered?.selected_candidate_id ?? null,
  recovered_required_user_disambiguation: recovered?.required_user_disambiguation ?? null,
  recovered_fetch_status: recovered?.fetch?.fetch_status ?? null,
  document_availability_status: result.document_availability_status,
  fetchability_status: result.fetchability_status,
  selected_candidate_status: result.selected_candidate_status,
  required_user_disambiguation: result.required_user_disambiguation ?? false,
  candidate_fingerprints: result.candidate_fingerprints ?? [],
  persisted_fetch_status: standaloneFetch?.fetch_status ?? null,
  canton_code: result.selected_candidate?.canton ?? null,
  court_name: result.selected_candidate?.court ?? null,
  status:
    fetch?.fetch_status === "fetch_success" &&
    fetch.network_transport === "live_http" &&
    fetch.mock_or_fixture === false &&
    fetch.document_hash &&
    fetch.retrieved_at &&
    result.identity.status === "identity_verified"
      ? "portal_accessible"
      : fetch?.fetch_status === "access_restricted"
        ? "access_restricted"
        : fetch?.fetch_status === "rate_limited"
          ? "rate_limited"
          : fetch?.warnings.some((warning) => warning.includes("no_exact_official_document"))
            ? "portal_changed"
            : "adapter_failure",
  requested_url: fetch?.requested_url ?? null,
  final_url: fetch?.final_url ?? null,
  status_code: fetch?.status_code ?? null,
  redirect_chain: fetch?.redirects ?? [],
  fetch_status: fetch?.fetch_status ?? null,
  domain: fetch?.final_url ? new URL(fetch.final_url).hostname : null,
  mime_type: fetch?.mime_type ?? null,
  bytes_received: fetch?.bytes_received ?? 0,
  publication_mapping_status: fetch?.publication_mapping_status ?? null,
  publication_mapping_confidence: fetch?.publication_mapping_confidence ?? null,
  publication_mapping_evidence: fetch?.publication_mapping_evidence ?? [],
  published_citation: fetch?.published_citation ?? fetch?.live_metadata?.published_citation ?? null,
  case_reference: fetch?.case_reference ?? fetch?.live_metadata?.case_reference ?? null,
  official_docid: fetch?.official_docid ?? fetch?.live_metadata?.official_docid ?? null,
  document_hash: fetch?.document_hash ?? null,
  retrieved_at: fetch?.retrieved_at ?? null,
  primary_reference: fetch?.primary_reference ?? fetch?.live_metadata?.primary_reference ?? null,
  primary_reference_source:
    fetch?.primary_reference_source ?? fetch?.live_metadata?.primary_reference_source ?? null,
  cited_references: fetch?.cited_references ?? [],
  related_proceeding_references: fetch?.related_proceeding_references ?? [],
  reviewed_decision_references: fetch?.reviewed_decision_references ?? [],
  decision_date: fetch?.decision_date ?? fetch?.live_metadata?.decision_date ?? null,
  decision_date_source:
    fetch?.decision_date_source ?? fetch?.live_metadata?.decision_date_source ?? null,
  date_mismatch: fetch?.date_mismatch ?? fetch?.live_metadata?.date_mismatch ?? false,
  response_body_type: fetch?.response_body_type ?? null,
  parser_status: fetch?.parser_status ?? null,
  physical_page_count: fetch?.physical_page_count ?? null,
  extracted_page_count: fetch?.extracted_page_count ?? null,
  pages_without_text: fetch?.pages_without_text ?? [],
  pages_failed: fetch?.pages_failed ?? [],
  physical_page_coverage: fetch?.physical_page_coverage ?? null,
  scanned_document_detected: fetch?.scanned_document_detected ?? false,
  ocr_required: fetch?.ocr_required ?? false,
  document_language_detected: fetch?.document_language_detected ?? null,
  document_language_confidence: fetch?.document_language_confidence ?? 0,
  language_mismatch: fetch?.language_mismatch ?? false,
  ratio_summary: ratio?.ratio_summary ?? null,
  main_ground: ratio?.main_ground ?? null,
  dispositive: fetch?.sections["dispositive"] ?? null,
  obiter: ratio?.obiter ?? [],
  obiter_details: ratio?.obiter_details ?? [],
  independent_grounds_count: ratio?.independent_grounds_count ?? null,
  independent_grounds_reviewed: ratio?.independent_grounds_reviewed ?? null,
  independent_ground_details: ratio?.independent_ground_details ?? [],
  ratio_evidence: ratio?.ratio_evidence ?? [],
  network_transport: fetch?.network_transport ?? "none",
  mock_or_fixture: fetch?.mock_or_fixture ?? null,
  identity_status: result.identity.status,
  standalone_identity_status: standaloneIdentity?.status ?? null,
  identity_status_same: standaloneIdentity
    ? standaloneIdentity.status === result.identity.status
    : null,
  official_identity_verified_same: standaloneIdentity
    ? standaloneIdentity.official_identity_verified === result.identity.official_identity_verified
    : null,
  mismatched_fields_same: standaloneIdentity
    ? JSON.stringify(standaloneIdentity.mismatched_fields) ===
      JSON.stringify(result.identity.mismatched_fields)
    : null,
  identity_score_same: standaloneIdentity
    ? standaloneIdentity.identity_score === result.identity.identity_score
    : null,
  identity_confidence_same: standaloneIdentity
    ? standaloneIdentity.identity_confidence === result.identity.identity_confidence
    : null,
  official_identity_verified: result.identity.official_identity_verified,
  mismatched_fields: result.identity.mismatched_fields,
  reference_year: result.identity.reference_year,
  reference_year_source: result.identity.reference_year_source,
  decision_year: result.identity.decision_year,
  decision_year_source: result.identity.decision_year_source,
  year_relationship: result.identity.year_relationship,
  year_mismatch: result.identity.year_mismatch,
  year_mismatch_blocking: result.identity.year_mismatch_blocking,
  circular_verification_detected: result.identity.circular_verification_detected,
  independent_evidence_count: result.identity.independent_evidence_count,
  legal_use: result.legal_use,
  warnings: result.warnings,
};

console.error(JSON.stringify(report, null, 2));

const preciseFailure =
  (report.fetch_status === "fetch_failed" || report.fetch_status === "empty_document") &&
  result.identity.circular_verification_detected === false &&
  (fetch?.warnings.some((warning) =>
    /document_fetch_failed|empty_response|redirect_to_search_page|invalid_download_url|candidate_not_found|no_exact_official_document/i.test(
      warning,
    ),
  ) ??
    false);

const deliberateAmbiguity =
  result.discovery_status === "candidate_ambiguous" &&
  result.selected_candidate_id === null &&
  result.candidate_count > 1 &&
  result.selection_blockers.includes("required_user_disambiguation") &&
  result.fetch === null &&
  result.identity.status === "identity_ambiguous" &&
  result.identity.circular_verification_detected === false;

const pass =
  report.status === "portal_accessible" &&
  report.network_transport === "live_http" &&
  report.mock_or_fixture === false &&
  Boolean(report.document_hash) &&
  Boolean(report.retrieved_at) &&
  report.bytes_received > 0 &&
  result.identity.status === "identity_verified";

process.exit(pass || preciseFailure || deliberateAmbiguity ? 0 : 1);
