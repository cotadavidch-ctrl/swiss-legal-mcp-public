import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractPdfText } from "@swiss-legal-mcp/shared-web";
import { canonicalizeUrlForDedup } from "./caseDeduplication.js";
import { canonicalizeSwissCaseNumber } from "@swiss-legal-mcp/shared";

// Official full-text resolver constants
const OFFICIAL_FULL_TEXT_PRIMARY_ENDPOINT = "https://relevancy.bger.ch/php/aza/http/index.php";
const OFFICIAL_FULL_TEXT_FALLBACK_ENDPOINT = "https://www.bger.ch/ext/eurospider/live";
type OfficialCaseHttpTransport = (
  url: string,
  options?: {
    readonly method?: "GET" | "POST";
    readonly body?: string;
    readonly headers?: Record<string, string>;
  },
  signal?: AbortSignal,
) => Promise<OfficialCaseHttpResponse>;

interface OfficialCaseHttpResponse {
  readonly requested_url: string;
  readonly final_url: string;
  readonly status_code: number;
  readonly redirect_chain: readonly string[];
  readonly response_headers: Record<string, string>;
  readonly mime_type: string | null;
  readonly content_length: number;
  readonly bytes_received: number;
  readonly retrieved_at: string;
  readonly body: Uint8Array;
  readonly network_transport: "live_http" | "test_http";
  readonly mock_or_fixture: boolean;
}

async function asyncFetch(
  url: string,
  options: {
    readonly method?: "GET" | "POST";
    readonly body?: string;
    readonly headers?: Record<string, string>;
  } = {},
  signal?: AbortSignal,
): Promise<OfficialCaseHttpResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  if (signal) {
    signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      body: options.body,
      headers: options.headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const body = await response.arrayBuffer();
    const bytesReceived = body.byteLength;

    // Convert headers to plain object
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      requested_url: url,
      final_url: response.url,
      status_code: response.status,
      redirect_chain: Array.from(response.redirected ? [url, response.url] : [url]),
      response_headers: headers,
      mime_type: response.headers.get("content-type") ?? null,
      content_length: Number(response.headers.get("content-length")) || bytesReceived,
      bytes_received: bytesReceived,
      retrieved_at: new Date().toISOString(),
      body: new Uint8Array(body),
      network_transport: "live_http",
      mock_or_fixture: false,
    };
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Fetch timeout for URL: ${url}`, { cause: error });
    }
    throw error;
  }
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isAllowedCandidateUrl(raw: string): boolean {
  const url = safeUrl(raw);
  if (!url) return false;
  return allowedOfficialDomains.has(url.hostname);
}
const maxOfficialCaseResponseBytes = 5_000_000;
const allowedOfficialDomains = new Set<string>([
  "bger.ch",
  "relevancy.bger.ch",
  "www.bger.ch",
  "search.bger.ch",
  "entscheidsuche.ch",
  "bvger.weblaw.ch",
  "bstger.weblaw.ch",
  "rechtsprechung.ar.ch",
]);
let officialCaseHttpTransport: OfficialCaseHttpTransport = asyncFetch;

async function liveHttpFetch(
  url: string,
  options: {
    readonly method?: "GET" | "POST";
    readonly body?: string;
    readonly headers?: Record<string, string>;
  } = {},
  signal?: AbortSignal,
): Promise<OfficialCaseHttpResponse> {
  if (
    process["env"]["NODE_ENV"] === "test" &&
    process["env"]["SWISS_LEGAL_MCP_LIVE_HTTP"] !== "1"
  ) {
    throw new Error("live_http_disabled_in_test");
  }
  let currentUrl = url;
  const redirectChain: string[] = [];
  for (let hop = 0; ; hop += 1) {
    if (!isAllowedCandidateUrl(currentUrl)) throw new Error("network_policy_blocked");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    if (signal) {
      signal.addEventListener("abort", () => controller.abort());
    }
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: options.method ?? "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/pdf,text/plain;q=0.9,*/*;q=0.1",
          "User-Agent": "swiss-legal-mcp/1.0 official-case-resolver",
          ...options.headers,
        },
        ...(options.body === undefined ? {} : { body: options.body }),
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`HTTP ${response.status} redirect_without_location`);
      if (hop >= 5) throw new Error("redirect_policy_blocked");
      redirectChain.push(currentUrl);
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxOfficialCaseResponseBytes) throw new Error("response_too_large");
    const responseHeaders = Object.fromEntries(response.headers.entries());
    return {
      requested_url: url,
      final_url: currentUrl,
      status_code: response.status,
      redirect_chain: redirectChain,
      response_headers: {
        "content-type": responseHeaders["content-type"] ?? "",
        "content-length": responseHeaders["content-length"] ?? "",
        server: responseHeaders["server"] ?? "",
        date: responseHeaders["date"] ?? "",
      },
      mime_type: response.headers.get("content-type"),
      content_length: Number(response.headers.get("content-length") ?? bytes.byteLength),
      bytes_received: bytes.byteLength,
      retrieved_at: new Date().toISOString(),
      body: bytes,
      network_transport: "live_http",
      mock_or_fixture: false,
    };
  }
}

/**
 * Constructs the Aza document ID from case number and decision date.
 * Format: aza://DD-MM-YYYY-CASE
 *
 * @param caseNumber - Canonicalized case number (e.g., "5A_604/2024")
 * @param decisionDate - Decision date in DD.MM.YYYY format (e.g., "31.12.2024")
 * @returns Aza document ID string or null if invalid
 */
export function constructAzaDocumentId(caseNumber: string, decisionDate: string): string | null {
  // Validate inputs
  if (!caseNumber || !decisionDate) {
    return null;
  }

  // Validate decision date format (DD.MM.YYYY)
  const datePattern = /^(\d{2})\.(\d{2})\.(\d{4})$/;
  const dateMatch = decisionDate.match(datePattern);
  if (!dateMatch) {
    return null;
  }

  const [, day, month, year] = dateMatch;
  // Ensure day, month, year are defined (they should be due to regex check above)
  if (day === undefined || month === undefined || year === undefined) {
    return null;
  }

  // Validate day, month, year ranges
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  if (isNaN(dayNum)) {
    return null;
  }
  if (dayNum < 1 || dayNum > 31) {
    return null;
  }
  if (isNaN(monthNum)) {
    return null;
  }
  if (monthNum < 1 || monthNum > 12) {
    return null;
  }
  if (isNaN(yearNum)) {
    return null;
  }
  if (yearNum < 1900 || yearNum > 2100) {
    return null;
  }

  // Format case number: replace '/' with '-' for Aza ID
  const formattedCaseNumber = caseNumber.replace(/\//g, "-");

  // Construct Aza ID: aza://DD-MM-YYYY-CASE
  return `aza://${day}-${month}-${year}-${formattedCaseNumber}`;
}

/**
 * Encodes a string for use in a URL query parameter.
 *
 * @param str - String to encode
 * @returns URL-encoded string
 */
function urlEncode(str: string): string {
  return encodeURIComponent(str);
}

/**
 * Builds the primary official full-text URL for a Swiss Federal Court decision.
 *
 * @param azaId - Aza document ID (e.g., "aza://31-12-2024-5A_604-2024")
 * @returns Full URL to the primary endpoint
 */
function buildPrimaryFullTextUrl(azaId: string): string {
  const encodedAzaId = urlEncode(azaId);
  return `${OFFICIAL_FULL_TEXT_PRIMARY_ENDPOINT}?highlight_docid=${encodedAzaId}&type=show_document`;
}

/**
 * Builds the fallback official full-text URL for a Swiss Federal Court decision.
 *
 * @param azaId - Aza document ID (e.g., "aza://31-12-2024-5A_604-2024")
 * @param language - Language code (de, fr, it)
 * @returns Full URL to the fallback endpoint
 */
function buildFallbackFullTextUrl(azaId: string, language: string): string {
  const encodedAzaId = urlEncode(azaId);
  // Validate language
  const validLang = ["de", "fr", "it"].includes(language) ? language : "de";
  return `${OFFICIAL_FULL_TEXT_FALLBACK_ENDPOINT}/${validLang}/php/aza/http/index.php?highlight_docid=${encodedAzaId}&lang=${validLang}&type=show_document&zoom=`;
}

/**
 * Attempts to fetch full text from the official Bundesgericht endpoints.
 *
 * @param caseNumber - Canonicalized case number (e.g., "5A_604/2024")
 * @param decisionDate - Decision date in DD.MM.YYYY format (e.g., "31.12.2024")
 * @param language - Detected language (de, fr, it)
 * @param signal - Optional abort signal for cancellation
 * @returns Promise resolving to the fetch result or null if failed
 */
export async function fetchOfficialFullTextFromBger(
  caseNumber: string,
  decisionDate: string,
  language: string,
  signal?: AbortSignal,
): Promise<{
  status: number;
  finalUrl: string;
  body: Uint8Array;
  mimeType: string;
  redirectChain: string[];
} | null> {
  try {
    // Construct Aza document ID
    const azaId = constructAzaDocumentId(caseNumber, decisionDate);
    if (!azaId) {
      return null;
    }

    // Try primary endpoint first
    const primaryUrl = buildPrimaryFullTextUrl(azaId);
    let response = await officialCaseHttpTransport(primaryUrl, {}, signal);

    // If primary endpoint succeeded and returned reasonable content, use it
    if (response.status_code === 200 && response.body.length > 1000) {
      return {
        status: response.status_code,
        finalUrl: response.final_url,
        body: response.body,
        mimeType: response.mime_type ?? "",
        redirectChain: [...response.redirect_chain],
      };
    }

    // Try fallback endpoints for each language
    const languagesToTry = [language, ...["de", "fr", "it"].filter((l) => l !== language)];
    for (const lang of languagesToTry) {
      const fallbackUrl = buildFallbackFullTextUrl(azaId, lang);
      response = await officialCaseHttpTransport(fallbackUrl, {}, signal);

      if (response.status_code === 200 && response.body.length > 1000) {
        return {
          status: response.status_code,
          finalUrl: response.final_url,
          body: response.body,
          mimeType: response.mime_type ?? "",
          redirectChain: [...response.redirect_chain],
        };
      }
    }

    // If we got here, neither endpoint worked well
    return null;
  } catch {
    // Do not throw: the caller handles official-search fallback paths.
    return null;
  }
}

export type CitationFamily =
  | "federal_case_number"
  | "published_federal_report"
  | "bge_atf_dtf"
  | "bvger_case_number"
  | "bstger_case_number"
  | "cantonal_case_number"
  | "url"
  | "unknown";

export type CourtFamily =
  | "swiss_federal_supreme_court"
  | "federal_administrative_court"
  | "federal_criminal_court"
  | "cantonal_court"
  | "unknown";

export type DiscoveryStatus = "candidate_selected" | "candidate_ambiguous" | "no_candidate";
export type DocumentAvailabilityStatus =
  | "official_document_available"
  | "metadata_only"
  | "invalid_download_url"
  | "redirect_to_search_page"
  | "document_not_found"
  | "access_restricted"
  | "unknown";
export type FetchabilityStatus = "fetchable" | "not_fetchable" | "unknown";
export type SelectedCandidateStatus =
  "selected_fetchable" | "selected_metadata_only" | "no_candidate_selected";
export type PublicationMappingStatus =
  "not_applicable" | "mapping_unverified" | "mapping_verified" | "mapping_not_found";
export type YearRelationship =
  | "same_year"
  | "decision_after_reference_year"
  | "decision_before_reference_year"
  | "unrelated_year_fields"
  | "insufficient_data";
export type IdentityStatus =
  | "identity_verified"
  | "identity_probable"
  | "identity_ambiguous"
  | "identity_mismatch"
  | "identity_not_verifiable";
export type FetchStatus =
  | "fetch_success"
  | "fetch_partial"
  | "fetch_failed"
  | "access_restricted"
  | "rate_limited"
  | "unsupported_format"
  | "content_not_case"
  | "empty_document"
  | "source_changed";
export type CompletenessStatus =
  | "complete"
  | "partial"
  | "missing_dispositive"
  | "missing_facts"
  | "missing_final_reasoning"
  | "ocr_defective"
  | "truncated"
  | "unknown";
export type ReadingStatus =
  | "full_text_verified_official"
  | "full_text_read_unofficial"
  | "full_text_read"
  | "partial_text_only"
  | "headnote_only"
  | "snippet_only"
  | "inaccessible_full_text"
  | "extraction_incomplete";
export type RatioStatus = "ratio_confirmed" | "ratio_probable" | "ratio_not_confirmed";
export type EligibilityStatus = "eligible" | "blocked" | "requires_human_review";
export type CacheStatus =
  "cache_hit_valid" | "cache_hit_stale" | "cache_invalidated" | "cache_miss";
export type CachePathErrorCode =
  | "cache_path_invalid"
  | "cache_directory_not_writable"
  | "cache_directory_creation_failed"
  | "cache_atomic_write_failed"
  | "cache_lock_failed";

export class OfficialCaseCacheError extends Error {
  constructor(
    readonly code: CachePathErrorCode,
    readonly safeMessage: string,
    options?: { cause?: unknown },
  ) {
    super(safeMessage, options);
    this.name = "OfficialCaseCacheError";
  }
}

export interface OfficialCaseCacheDiagnostics {
  readonly cache_directory_source:
    | "SWISS_LEGAL_CACHE_DIR"
    | "macos_user_cache"
    | "linux_xdg_cache"
    | "linux_home_cache"
    | "windows_localappdata"
    | "tmpdir_fallback";
  readonly cache_directory_writable: boolean;
  readonly cache_store_initialized: boolean;
  readonly cache_store_schema_version: number | null;
  readonly cache_path_redacted: string;
  readonly cwd_independent: boolean;
  readonly warning: string | null;
  readonly store_schema_version?: number;
  readonly cache_store_path_redacted?: string;
  readonly persistence_between_independent_calls?: boolean;
  readonly persistence_after_process_restart?: "not_tested";
  readonly persistence_after_machine_restart?: "not_tested";
}

export interface ResolveOfficialSwissCaseInput {
  readonly case_reference?: string;
  readonly resolution_id?: string;
  readonly court_hint?: string;
  readonly canton_hint?: string;
  readonly decision_date_hint?: string;
  readonly language_hint?: "de" | "fr" | "it";
  readonly source_url_hint?: string;
  readonly allow_unofficial_fallback?: boolean;
  readonly require_official_source?: boolean;
  readonly require_full_text?: boolean;
  readonly strict_identity_match?: boolean;
  readonly retrieval_mode?: "metadata_only" | "full_text" | "cache_only" | "refresh";
  readonly timeout_policy?: "default" | "short" | "long";
  readonly presentation_mode?: "clean" | "professional" | "technical_control" | "debug";
}

export interface NormalizedCaseReference {
  readonly raw_reference: string;
  readonly normalized_reference: string;
  readonly citation_family: CitationFamily;
  readonly court_family: CourtFamily;
  readonly possible_courts: readonly string[];
  readonly possible_cantons: readonly string[];
  readonly decision_year: number | null;
  readonly sequence_number: string | null;
  readonly chamber_or_division: string | null;
  readonly publication_type: "case_number" | "official_report" | "url" | "unknown";
  readonly normalization_confidence: number;
  readonly reporter?: "BGE" | "ATF" | "DTF" | null;
  readonly published_report_volume?: string | null;
  readonly published_report_division?: string | null;
  readonly published_report_page?: string | null;
  readonly canonical_published_citation?: string | null;
}

export interface OfficialCaseCandidate {
  readonly candidate_id: string;
  readonly source: string;
  readonly source_url: string;
  readonly canonical_url: string;
  readonly official: boolean;
  readonly court: string | null;
  readonly court_family: CourtFamily;
  readonly canton: string | null;
  readonly reference: string | null;
  readonly decision_date: string | null;
  readonly decision_date_status?:
    "not_verified" | "verified_from_live_document" | "metadata_mismatch";
  readonly chamber: string | null;
  readonly language: "de" | "fr" | "it" | null;
  readonly title: string | null;
  readonly mime_type: string | null;
  readonly resolution_id?: string;
  readonly source_adapter?: string;
  readonly published_citation?: string | null;
  readonly case_reference?: string | null;
  readonly official_docid?: string | null;
  readonly publication_mapping_status?: PublicationMappingStatus;
  readonly publication_mapping_confidence?: number | null;
  readonly publication_mapping_evidence?: readonly string[];
  readonly candidate_fingerprint?: string;
  readonly normalized_reference?: string;
  readonly download_url?: string | null;
  readonly exact_reference_match?: boolean;
  readonly reference_position?: "header" | "filename" | "metadata" | "body" | "url" | "none";
  readonly heading_reference_match?: boolean;
  readonly filename_reference_match?: boolean;
  readonly metadata_reference_match?: boolean;
  readonly citation_only_match?: boolean;
  readonly primary_document?: boolean;
  readonly full_text_available?: boolean;
  readonly candidate_score?: number;
  readonly blocking_mismatches?: readonly string[];
  readonly rejection_reasons?: readonly string[];
  readonly duplicate_group_id?: string | null;
  readonly canonical_candidate_id?: string | null;
  readonly duplicate_candidate_ids?: readonly string[];
  readonly duplicate_reason?: string | null;
  readonly binary_hash?: string | null;
  readonly text_hash?: string | null;
  readonly structural_hash?: string | null;
  readonly duplicate_classification?:
    | "exact_binary_duplicate"
    | "same_text_different_wrapper"
    | "same_decision_republication"
    | "same_decision_different_language"
    | "not_duplicate";
  readonly content?: string;
  readonly content_kind: "html" | "pdf" | "text" | "headnote" | "error" | "unknown";
  readonly score: number;
  readonly matched_features: readonly string[];
  readonly mismatched_features: readonly string[];
  readonly missing_features: readonly string[];
  readonly selection_reason: string;
  readonly rejected_reason: string | null;
  /**
   * Pre-fetch structural deduplication provenance (see `mergePreFetchDuplicates`).
   * Populated only when this candidate is the result of merging 2+ raw
   * candidates that different adapters produced for the same underlying
   * decision (e.g. a `case_reference`-driven search candidate and a
   * `source_url_hint`-driven direct-URL candidate). Never drops information:
   * every merged adapter, source URL and canonical URL is preserved here.
   */
  readonly merged_from_adapters?: readonly string[];
  readonly merged_source_urls?: readonly string[];
  readonly merged_canonical_urls?: readonly string[];
  readonly merged_candidate_ids?: readonly string[];
  readonly pre_fetch_merge_reason?: string | null;
}

export interface IdentityVerification {
  readonly status: IdentityStatus;
  readonly matched_fields: readonly string[];
  readonly mismatched_fields: readonly string[];
  readonly missing_fields: readonly string[];
  readonly ambiguity_reasons: readonly string[];
  readonly identity_score: number | null;
  readonly identity_confidence: number | null;
  readonly official_identity_verified: boolean;
  readonly requires_human_review: boolean;
  readonly identity_evidence_sources: readonly string[];
  readonly independent_evidence_count: number;
  readonly metadata_extracted_from_live_document: boolean;
  readonly metadata_extracted_from_search_result: boolean;
  readonly circular_verification_detected: boolean;
  readonly reference_year: number | null;
  readonly reference_year_source: string | null;
  readonly decision_year: number | null;
  readonly decision_year_source: string | null;
  readonly year_relationship: YearRelationship;
  readonly year_mismatch: boolean;
  readonly year_mismatch_blocking: boolean;
}

export interface FullTextFetchResult {
  readonly fetch_status: FetchStatus;
  readonly cache_status?: CacheStatus;
  readonly resolution_id?: string;
  readonly candidate_id?: string;
  readonly document_id?: string;
  readonly requested_url?: string;
  readonly source_url: string;
  readonly final_url: string;
  readonly status_code?: number;
  readonly redirects: readonly string[];
  readonly response_headers?: Record<string, string>;
  readonly mime_type: string | null;
  readonly content_length: number;
  readonly bytes_received?: number;
  readonly document_hash: string | null;
  readonly metadata_hash?: string | null;
  readonly network_transport?: "live_http" | "test_http" | "none";
  readonly mock_or_fixture?: boolean;
  readonly severity?: "info" | "warning" | "blocker";
  readonly retrieved_at: string | null;
  readonly extractor_version: string;
  readonly source_version: string | null;
  readonly text: string | null;
  readonly sections: Record<string, string>;
  readonly section_evidence?: readonly SectionEvidence[];
  readonly physical_page_count?: number | null;
  readonly extracted_page_count?: number | null;
  readonly pages_with_text?: readonly number[];
  readonly pages_without_text?: readonly number[];
  readonly pages_failed?: readonly number[];
  readonly physical_page_coverage?: number | null;
  readonly extraction_page_coverage?: number | null;
  readonly document_unit_count?: number;
  readonly scanned_document_detected?: boolean;
  readonly ocr_required?: boolean;
  readonly ocr_performed?: boolean;
  readonly ocr_language?: string | null;
  readonly ocr_confidence?: number | null;
  readonly pages_requiring_ocr?: readonly number[];
  readonly requested_locale?: string | null;
  readonly portal_interface_language?: string | null;
  readonly document_language_detected?: "de" | "fr" | "it" | null;
  readonly document_language_confidence?: number;
  readonly document_language_sources?: readonly string[];
  readonly language_mismatch?: boolean;
  readonly live_metadata?: LiveDocumentMetadata;
  readonly published_citation?: string | null;
  readonly case_reference?: string | null;
  readonly official_docid?: string | null;
  readonly publication_mapping_status?: PublicationMappingStatus;
  readonly publication_mapping_confidence?: number | null;
  readonly publication_mapping_evidence?: readonly string[];
  readonly primary_reference?: string | null;
  readonly primary_reference_source?: string | null;
  readonly cited_references?: readonly string[];
  readonly related_proceeding_references?: readonly string[];
  readonly reviewed_decision_references?: readonly string[];
  readonly reference_extraction_confidence?: number;
  readonly decision_date?: string | null;
  readonly decision_date_source?: string | null;
  readonly decision_date_confidence?: number;
  readonly candidate_decision_date?: string | null;
  readonly live_document_decision_date?: string | null;
  readonly date_mismatch?: boolean;
  readonly response_body_type?: "pdf" | "html" | "text" | "empty" | "binary";
  readonly access_restrictions?: readonly string[];
  readonly parser_status?: string;
  readonly completeness_status?: CompletenessStatus;
  readonly reading_status?: ReadingStatus;
  readonly warnings: readonly string[];
  // Pagination fields for large document support
  readonly text_chunk?: string | null; // Actual text chunk (may be null for metadata-only)
  readonly chunk_index?: number; // 0-based index of this chunk
  readonly total_chunks?: number | null; // Total number of chunks (null if unknown)
  readonly next_chunk_token?: string | null; // Token to get the next chunk
  readonly is_chunked?: boolean; // Whether this response is part of a chunked response
}

export interface CompletenessReport {
  readonly total_pages: number | null;
  readonly pages_read: readonly number[];
  readonly page_coverage: number;
  readonly physical_page_count?: number | null;
  readonly extracted_page_count?: number | null;
  readonly pages_with_text?: readonly number[];
  readonly pages_without_text?: readonly number[];
  readonly pages_failed?: readonly number[];
  readonly physical_page_coverage?: number | null;
  readonly extraction_page_coverage?: number | null;
  readonly document_unit_count?: number;
  readonly scanned_document_detected?: boolean;
  readonly ocr_required?: boolean;
  readonly ocr_performed?: boolean;
  readonly ocr_language?: string | null;
  readonly ocr_confidence?: number | null;
  readonly pages_requiring_ocr?: readonly number[];
  readonly total_sections: number;
  readonly sections_read: readonly string[];
  readonly section_coverage: number;
  readonly missing_pages: readonly number[];
  readonly missing_sections: readonly string[];
  readonly truncated_sections: readonly string[];
  readonly extraction_errors: readonly string[];
  readonly dispositive_present: boolean;
  readonly factual_section_present: boolean;
  readonly reasoning_section_present: boolean;
  readonly final_reasoning_section_present: boolean;
  readonly separate_opinions_present: boolean;
  readonly separate_opinions_read: boolean;
  readonly independent_grounds_count: number;
  readonly independent_grounds_read: number;
  readonly completeness_score: number;
  readonly completeness_status: CompletenessStatus;
  readonly section_evidence?: readonly SectionEvidence[];
}

export interface UniformLegalUseStatus {
  readonly discovery_status: DiscoveryStatus;
  readonly identity_status: IdentityStatus;
  readonly source_status: "official" | "unofficial" | "not_found";
  readonly fetch_status: FetchStatus;
  readonly completeness_status: CompletenessStatus;
  readonly reading_status: ReadingStatus;
  readonly official_verification_status:
    ReadingStatus | "official_source_not_found" | "not_verified";
  readonly ratio_status: RatioStatus;
  readonly ratio_analysis?: RatioAnalysis;
  readonly comparability_eligibility: EligibilityStatus;
  readonly drafting_eligibility: EligibilityStatus;
  readonly strategy_eligibility: EligibilityStatus;
  readonly citation_eligibility: EligibilityStatus;
}

export interface RatioAnalysis {
  readonly ratio_summary: string | null;
  readonly main_ground: string | null;
  readonly subsidiary_grounds: readonly string[];
  readonly independent_alternative_grounds: readonly string[];
  readonly independent_grounds_count: number;
  readonly independent_grounds_reviewed: number;
  readonly independent_ground_details: readonly RatioGroundDetail[];
  readonly no_independent_alternative_grounds_detected: boolean;
  readonly obiter: readonly string[];
  readonly obiter_details?: readonly ObiterPassageDetail[];
  readonly dispositive_link: string | null;
  readonly ratio_evidence: readonly RatioEvidence[];
  readonly ratio_status: RatioStatus;
  readonly ratio_confidence: number;
  readonly warnings: readonly string[];
}

export interface AutonomousGroundReviewValidation {
  readonly validation_status: "complete" | "blocked";
  readonly omitted_ground_ids: readonly string[];
  readonly independent_grounds_count: number;
  readonly independent_grounds_reviewed: number;
  readonly ratio_status: RatioStatus;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly comparability_eligibility: EligibilityStatus;
  readonly drafting_eligibility: EligibilityStatus;
  readonly strategy_eligibility: EligibilityStatus;
  readonly dispositive_support_warning: string | null;
}

export interface SwissCaseGroundCoverageValidation {
  readonly validation_status: "complete" | "blocked";
  readonly document_id: string;
  readonly document_hash: string | null;
  readonly total_verified_ground_count: number;
  readonly reviewed_ground_count: number;
  readonly included_ground_ids: readonly string[];
  readonly excluded_ground_ids: readonly string[];
  readonly omitted_ground_ids: readonly string[];
  readonly verified_ground_ids: readonly string[];
  readonly ratio_status: RatioStatus;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly comparability_eligibility: EligibilityStatus;
  readonly drafting_eligibility: EligibilityStatus;
  readonly strategy_eligibility: EligibilityStatus;
  readonly citation_eligibility: EligibilityStatus;
  readonly no_network_request: true;
  readonly source_analysis_hash: string | null;
  readonly persistence_verified: boolean;
}

export function validateAutonomousGroundReviewCompleteness(input: {
  readonly ratio_analysis?: RatioAnalysis | null;
  readonly omitted_ground_ids?: readonly string[];
}): AutonomousGroundReviewValidation {
  const omittedGroundIds = input.omitted_ground_ids ?? [];
  const ratio = input.ratio_analysis;
  if (!ratio) {
    return {
      validation_status: "blocked",
      omitted_ground_ids: omittedGroundIds,
      independent_grounds_count: 0,
      independent_grounds_reviewed: 0,
      ratio_status: "ratio_not_confirmed",
      blockers: ["ratio_analysis_missing"],
      warnings: ["ratio_analysis_missing"],
      comparability_eligibility: "blocked",
      drafting_eligibility: "blocked",
      strategy_eligibility: "blocked",
      dispositive_support_warning: null,
    };
  }

  const verifiedAutonomousGrounds = ratio.independent_ground_details.filter(
    (ground) =>
      ground.autonomous === true &&
      ground.autonomous_ground_status === "verified" &&
      ground.independently_sufficient === true,
  );
  const omitted = new Set(omittedGroundIds);
  const omittedVerifiedGrounds = verifiedAutonomousGrounds.filter((ground) =>
    omitted.has(ground.ground_id),
  );
  const independentGroundsCount =
    verifiedAutonomousGrounds.length > 0
      ? verifiedAutonomousGrounds.length
      : ratio.independent_grounds_count;
  const independentGroundsReviewed = Math.max(
    0,
    (verifiedAutonomousGrounds.length > 0
      ? verifiedAutonomousGrounds.length
      : ratio.independent_grounds_reviewed) - omittedVerifiedGrounds.length,
  );
  const blocked =
    omittedVerifiedGrounds.length > 0 || independentGroundsReviewed < independentGroundsCount;
  const dispositiveSupportWarning = blocked
    ? "A remaining verified autonomous ground can independently support the dispositive; all autonomous grounds must be reviewed."
    : null;

  return {
    validation_status: blocked ? "blocked" : "complete",
    omitted_ground_ids: omittedGroundIds,
    independent_grounds_count: independentGroundsCount,
    independent_grounds_reviewed: independentGroundsReviewed,
    ratio_status: blocked ? "ratio_not_confirmed" : ratio.ratio_status,
    blockers: blocked ? ["autonomous_ground_not_reviewed"] : [],
    warnings: [
      ...(omittedVerifiedGrounds.length > 0
        ? [
            `omitted_autonomous_ground:${omittedVerifiedGrounds.map((ground) => ground.ground_id).join(",")}`,
          ]
        : []),
      ...(blocked ? ["remaining_autonomous_ground_supports_dispositive"] : []),
    ],
    comparability_eligibility: blocked ? "blocked" : "eligible",
    drafting_eligibility: blocked ? "blocked" : "eligible",
    strategy_eligibility: blocked ? "blocked" : "eligible",
    dispositive_support_warning: dispositiveSupportWarning,
  };
}

export function validateSwissCaseGroundCoverage(input: {
  readonly document_id: string;
  readonly included_ground_ids?: readonly string[];
  readonly excluded_ground_ids?: readonly string[];
  readonly validation_mode?: "coverage";
}): SwissCaseGroundCoverageValidation {
  const included = [...new Set(input.included_ground_ids ?? [])];
  const excluded = [...new Set(input.excluded_ground_ids ?? [])];
  const store = readStore();
  const stored = store.documents[input.document_id];
  if (!stored || !isStoredDocumentValid(stored)) {
    return {
      validation_status: "blocked",
      document_id: input.document_id,
      document_hash: stored?.document_hash ?? null,
      total_verified_ground_count: 0,
      reviewed_ground_count: 0,
      included_ground_ids: included,
      excluded_ground_ids: excluded,
      omitted_ground_ids: excluded,
      verified_ground_ids: [],
      ratio_status: "ratio_not_confirmed",
      blockers: ["stored_official_document_not_found"],
      warnings: ["coverage_validation_uses_persisted_documents_only"],
      comparability_eligibility: "blocked",
      drafting_eligibility: "blocked",
      strategy_eligibility: "blocked",
      citation_eligibility: "blocked",
      no_network_request: true,
      source_analysis_hash: null,
      persistence_verified: false,
    };
  }
  const fetch = storedDocumentToFetch(stored, "cache_hit_valid");
  const completeness = verifyCompleteness(fetch);
  const ratio = analyzeRatio(fetch, completeness);
  const verifiedGrounds = ratio.independent_ground_details.filter(
    (ground) =>
      ground.autonomous === true &&
      ground.autonomous_ground_status === "verified" &&
      ground.independently_sufficient === true,
  );
  const verifiedIds = verifiedGrounds.map((ground) => ground.ground_id);
  const verifiedSet = new Set(verifiedIds);
  const omittedVerified = excluded.filter((id) => verifiedSet.has(id));
  const notReviewedVerified = verifiedIds.filter(
    (id) => !included.includes(id) || omittedVerified.includes(id),
  );
  const blockers =
    notReviewedVerified.length > 0
      ? ["autonomous_ground_not_reviewed"]
      : ratio.ratio_status !== "ratio_confirmed"
        ? ["ratio_not_confirmed"]
        : [];
  const reviewedGroundCount = Math.max(0, verifiedIds.length - omittedVerified.length);
  const analysisHash = sha256(
    JSON.stringify({
      document_id: input.document_id,
      document_hash: stored.document_hash,
      verified_ground_ids: verifiedIds,
      verified_ground_hashes: verifiedGrounds.flatMap((ground) => ground.evidence_hashes ?? []),
      included,
      excluded,
    }),
  );
  const blocked = blockers.length > 0 || reviewedGroundCount < verifiedIds.length;
  return {
    validation_status: blocked ? "blocked" : "complete",
    document_id: input.document_id,
    document_hash: stored.document_hash,
    total_verified_ground_count: verifiedIds.length,
    reviewed_ground_count: reviewedGroundCount,
    included_ground_ids: included,
    excluded_ground_ids: excluded,
    omitted_ground_ids: notReviewedVerified,
    verified_ground_ids: verifiedIds,
    ratio_status: blocked ? "ratio_not_confirmed" : ratio.ratio_status,
    blockers,
    warnings: [
      ...(excluded.filter((id) => !verifiedSet.has(id)).length > 0
        ? [
            `excluded_ground_not_verified:${excluded.filter((id) => !verifiedSet.has(id)).join(",")}`,
          ]
        : []),
      ...(notReviewedVerified.length > 0
        ? [`omitted_autonomous_ground:${notReviewedVerified.join(",")}`]
        : []),
    ],
    comparability_eligibility: blocked ? "blocked" : "eligible",
    drafting_eligibility: blocked ? "blocked" : "eligible",
    strategy_eligibility: blocked ? "blocked" : "eligible",
    citation_eligibility: blocked ? "blocked" : "eligible",
    no_network_request: true,
    source_analysis_hash: analysisHash,
    persistence_verified: true,
  };
}

export interface SectionEvidence {
  readonly section_id: string;
  readonly heading: string;
  readonly page_start: number | null;
  readonly page_end: number | null;
  readonly text_hash: string;
  readonly extraction_status: "extracted" | "missing" | "partial";
  /** Idioma en el que parece estar redactado el marcador/heuristica que
   * localizo esta seccion (de/fr/it), o null si no se pudo clasificar. Nunca
   * sustituye ni se deriva del idioma solicitado en la busqueda -- ver
   * `classifyMarkerLanguage`. */
  readonly detected_language: "de" | "fr" | "it" | null;
  /** Como se localizo la seccion: `dom` (parseo estructural del HTML real,
   * no implementado en esta version -- ver comentario junto a
   * `SectionDetectionMethod`), `heading` (marcador/encabezado explicito
   * reconocido), `structural_pattern` (posicion inferida sin marcador
   * explicito) o `text_pattern` (vocabulario tematico dentro de otra seccion
   * ya localizada). */
  readonly detection_method:
    "dom" | "heading" | "structural_pattern" | "text_pattern" | "content_heuristics";
}

export interface RatioEvidence {
  readonly section_id: string;
  readonly page_numbers: readonly number[];
  readonly text_hash: string;
  readonly excerpt: string;
}

interface PassageTraceabilityMetadata {
  readonly supporting_sections: readonly string[];
  readonly supporting_document_units: readonly string[];
  readonly supporting_page_numbers: readonly number[];
  readonly passage_authority_level: NonNullable<RatioGroundDetail["passage_authority_level"]>;
  readonly passage_origin: NonNullable<RatioGroundDetail["passage_origin"]>;
  readonly pagination_type: string;
  readonly page_reference_status: string;
}

export interface RatioGroundDetail {
  readonly ground_id: string;
  readonly summary: string;
  readonly legal_issue?: string | null;
  readonly doctrine_only?: boolean;
  readonly applied_to_case?: boolean;
  readonly dispositive_dependency?: boolean;
  readonly independently_sufficient?: boolean;
  readonly autonomous_ground_status?:
    | "verified"
    | "rejected_doctrine_only"
    | "rejected_lower_instance_ground"
    | "rejected_not_applied"
    | "rejected_not_independently_sufficient"
    | "rejected_subargument"
    | "rejected_cumulative"
    | "insufficient_evidence"
    | "requires_human_review";
  readonly rejection_reason?: string | null;
  readonly supporting_sections: readonly string[];
  readonly supporting_page_numbers: readonly number[];
  readonly evidence_hashes?: readonly string[];
  readonly link_to_dispositive: string | null;
  readonly passage_authority_level?: "current_court" | "lower_authority" | "unknown";
  readonly passage_origin?:
    | "current_court_original_reasoning"
    | "current_court_adopted_reasoning"
    | "lower_authority_reasoning"
    | "unknown";
  readonly pagination_type?: string;
  readonly page_reference_status?: string;
  readonly source_decision_level?: "current_court" | "lower_instance" | "doctrine" | "unknown";
  readonly belongs_to_current_decision?: boolean;
  readonly applied_by_current_court?: boolean;
  readonly linked_to_current_dispositive?: boolean;
  readonly independently_sufficient_for_current_dispositive?: boolean;
  readonly supporting_document_units?: readonly string[];
  readonly autonomous: boolean;
  readonly sufficient_for_dispositive?: boolean;
  readonly relationship_to_other_grounds?: string | null;
  readonly reviewed: boolean;
  readonly confidence: number;
}

export interface ObiterPassageDetail {
  readonly obiter_id: string;
  readonly summary: string;
  readonly supporting_sections: readonly string[];
  readonly supporting_page_numbers: readonly number[];
  readonly supporting_document_units?: readonly string[];
  readonly passage_authority_level?: "current_court" | "lower_authority" | "unknown";
  readonly passage_origin?:
    | "current_court_original_reasoning"
    | "current_court_adopted_reasoning"
    | "lower_authority_reasoning"
    | "unknown";
  readonly pagination_type?: string;
  readonly page_reference_status?: string;
  readonly text_excerpt_hash: string;
  readonly relation_to_main_ground: string;
  readonly necessary_for_dispositive: boolean;
  readonly classification_reason: string;
  readonly confidence: number;
  readonly reviewed: boolean;
}

export interface CaseSourceComparison {
  readonly comparison_id?: string;
  readonly sources_compared: number;
  readonly comparison_status?: "compared" | "insufficient_sources";
  readonly official_source: string | null;
  readonly secondary_sources: readonly string[];
  readonly identity_match: boolean | null;
  readonly text_match_score: number | null;
  readonly structural_match_score: number | null;
  readonly missing_in_secondary: readonly string[];
  readonly additional_in_secondary: readonly string[];
  readonly contradictory_passages: readonly string[];
  readonly editorial_additions: readonly string[];
  readonly source_mismatch: readonly string[];
  readonly authoritative_source_selected: string | null;
  readonly comparison_confidence: number | null;
  readonly official_document_id?: string;
  readonly secondary_document_ids?: readonly string[];
}

export interface OfficialSwissCaseResolution {
  readonly resolution_id: string;
  readonly document_id?: string | null;
  readonly normalized_reference?: string;
  readonly source_adapter?: string | null;
  readonly source_status?: "official" | "unofficial" | "not_found";
  readonly requested_url?: string | null;
  readonly canonical_url?: string | null;
  readonly final_url?: string | null;
  readonly candidate_fingerprint?: string | null;
  readonly metadata_hash?: string | null;
  readonly document_hash?: string | null;
  readonly cache_key?: string;
  readonly retrieved_at?: string | null;
  readonly normalized: NormalizedCaseReference;
  readonly discovery_status: DiscoveryStatus;
  readonly document_availability_status?: DocumentAvailabilityStatus;
  readonly fetchability_status?: FetchabilityStatus;
  readonly selected_candidate_status?: SelectedCandidateStatus;
  readonly candidates: readonly OfficialCaseCandidate[];
  readonly candidate_count?: number;
  readonly selected_candidate_id?: string | null;
  readonly selected_candidate: OfficialCaseCandidate | null;
  readonly rejected_candidates: readonly OfficialCaseCandidate[];
  readonly ambiguity_status?: "unambiguous" | "ambiguous" | "none";
  readonly selection_reason?: string;
  readonly selection_blockers?: readonly string[];
  readonly required_user_disambiguation?: boolean;
  readonly candidate_fingerprints?: readonly string[];
  readonly created_at?: string;
  readonly updated_at?: string;
  readonly identity: IdentityVerification;
  readonly fetch: FullTextFetchResult | null;
  readonly completeness: CompletenessReport | null;
  readonly comparison: CaseSourceComparison | null;
  readonly legal_use: UniformLegalUseStatus;
  readonly cache_status: CacheStatus;
  readonly store_schema_version?: number;
  readonly cache_origin?: "live_http" | "test_http" | "stored" | "unknown";
  readonly persistence_verified?: boolean;
  readonly attempts: readonly {
    readonly adapter: string;
    readonly status: string;
    readonly reason: string;
    readonly url?: string;
  }[];
  readonly presentation: {
    readonly mode: "clean" | "professional" | "technical_control" | "debug";
    readonly summary: string;
    readonly technical_visible: boolean;
  };
  readonly warnings: readonly string[];
}

interface CaseAdapter {
  readonly id: string;
  canHandle(reference: NormalizedCaseReference, input: ResolveOfficialSwissCaseInput): boolean;
  buildSearchRequests(
    reference: NormalizedCaseReference,
    input: ResolveOfficialSwissCaseInput,
  ): readonly string[];
  parseSearchResults(
    reference: NormalizedCaseReference,
    input: ResolveOfficialSwissCaseInput,
  ): readonly OfficialCaseCandidate[];
}

interface CacheEntry {
  readonly normalized_reference: string;
  readonly source_url: string;
  readonly canonical_url: string;
  readonly document_hash: string | null;
  readonly metadata_hash: string;
  readonly retrieved_at: string | null;
  readonly verified_at: string | null;
  readonly reading_completed_at: string | null;
  readonly source_version: string | null;
  readonly extractor_version: string;
  readonly identity_status: IdentityStatus;
  readonly completeness_status: CompletenessStatus;
  readonly official_status: "official" | "unofficial" | "not_found";
  readonly superseded_by: string | null;
  readonly invalidation_reason: string | null;
  readonly live_http_verified?: boolean;
  readonly response_status?: number | null;
  readonly bytes_received?: number;
  readonly source_domain?: string | null;
  readonly official_domain_verified?: boolean;
  readonly fixture_or_mock?: boolean;
  readonly cache_origin?: "live_http" | "test_http" | "unknown";
}

export interface LiveDocumentMetadata {
  readonly reference: string | null;
  readonly decision_date: string | null;
  readonly court_family: CourtFamily | null;
  readonly title: string | null;
  readonly primary_reference?: string | null;
  readonly primary_reference_source?: string | null;
  readonly cited_references?: readonly string[];
  readonly related_proceeding_references?: readonly string[];
  readonly reviewed_decision_references?: readonly string[];
  readonly reference_extraction_confidence?: number;
  readonly decision_date_source?: string | null;
  readonly decision_date_confidence?: number;
  readonly candidate_decision_date?: string | null;
  readonly live_document_decision_date?: string | null;
  readonly date_mismatch?: boolean;
  readonly published_citation?: string | null;
  readonly case_reference?: string | null;
  readonly official_docid?: string | null;
  readonly publication_mapping_status?: PublicationMappingStatus;
  readonly publication_mapping_confidence?: number | null;
  readonly publication_mapping_evidence?: readonly string[];
}

const extractorVersion = "official-swiss-case-resolver-v1";

const cache = new Map<string, CacheEntry>();
let lastStoreWarning: string | null = null;

export function clearOfficialSwissCaseResolverCache(): void {
  cache.clear();
  lastStoreWarning = null;
  if (process["env"]["NODE_ENV"] === "test" || process["env"]["SWISS_LEGAL_CACHE_DIR"]) {
    try {
      fs.rmSync(storePath(), { force: true });
    } catch {
      // Test cleanup only; failed deletion leaves the in-memory cache cleared.
    }
  }
}

const storeSchemaVersion = 1;

interface StoredOfficialCaseDocument {
  readonly schema_version: number;
  readonly document_id: string;
  readonly resolution_id: string | null;
  readonly candidate_id: string | null;
  readonly normalized_reference: string;
  readonly source_adapter: string | null;
  readonly source_status: "official" | "unofficial" | "not_found";
  readonly requested_url: string;
  readonly canonical_url: string;
  readonly final_url: string;
  readonly mime_type: string | null;
  readonly status_code: number | null;
  readonly response_headers: Record<string, string>;
  readonly content_length: number;
  readonly bytes_received: number;
  readonly document_hash: string;
  readonly metadata_hash: string;
  readonly retrieved_at: string;
  readonly live_http_verified: boolean;
  readonly mock_or_fixture: boolean;
  readonly cache_origin: "live_http" | "test_http" | "unknown";
  readonly official_status: "official" | "unofficial" | "not_found";
  readonly text: string;
  readonly sections: Record<string, string>;
  readonly live_metadata?: LiveDocumentMetadata;
  readonly candidate?: OfficialCaseCandidate;
  readonly fetch: FullTextFetchResult;
}

interface StoredOfficialCaseResolution {
  readonly schema_version: number;
  readonly resolution_id: string;
  readonly candidate_id: string | null;
  readonly document_id: string | null;
  readonly normalized_reference: string;
  readonly source_adapter: string | null;
  readonly source_status: "official" | "unofficial" | "not_found";
  readonly requested_url: string | null;
  readonly canonical_url: string | null;
  readonly final_url: string | null;
  readonly candidate_fingerprint: string | null;
  readonly metadata_hash: string | null;
  readonly document_hash: string | null;
  readonly cache_key: string;
  readonly retrieved_at: string | null;
  readonly candidate: OfficialCaseCandidate | null;
  readonly candidates?: readonly OfficialCaseCandidate[];
  readonly selected_candidate_id?: string | null;
  readonly rejected_candidates?: readonly OfficialCaseCandidate[];
  readonly ambiguity_status?: "unambiguous" | "ambiguous" | "none";
  readonly selection_reason?: string;
  readonly selection_blockers?: readonly string[];
  readonly created_at?: string;
  readonly updated_at?: string;
  readonly identity?: IdentityVerification;
  readonly live_metadata?: LiveDocumentMetadata;
  readonly stored_at: string;
}

interface StoredOfficialCaseComparison {
  readonly schema_version: number;
  readonly comparison_id: string;
  readonly official_document_id: string | null;
  readonly secondary_document_ids: readonly string[];
  readonly comparison: CaseSourceComparison;
  readonly stored_at: string;
}

interface OfficialCaseStore {
  readonly schema_version: number;
  readonly resolutions: Record<string, StoredOfficialCaseResolution>;
  readonly candidates: Record<string, OfficialCaseCandidate>;
  readonly documents: Record<string, StoredOfficialCaseDocument>;
  readonly comparisons: Record<string, StoredOfficialCaseComparison>;
  readonly indexes: {
    readonly resolution_by_candidate_id: Record<string, string>;
    readonly document_by_candidate_id: Record<string, string>;
    readonly document_by_resolution_id: Record<string, string>;
    readonly document_by_canonical_url: Record<string, string>;
    readonly resolution_by_normalized_reference: Record<string, string>;
  };
}

function emptyStore(): OfficialCaseStore {
  return {
    schema_version: storeSchemaVersion,
    resolutions: {},
    candidates: {},
    documents: {},
    comparisons: {},
    indexes: {
      resolution_by_candidate_id: {},
      document_by_candidate_id: {},
      document_by_resolution_id: {},
      document_by_canonical_url: {},
      resolution_by_normalized_reference: {},
    },
  };
}

export function resolveOfficialCaseStorePath(
  options: {
    readonly env?: NodeJS.ProcessEnv;
    readonly platform?: NodeJS.Platform;
    readonly homedir?: string;
    readonly tmpdir?: string;
    readonly checkWritable?: boolean;
  } = {},
): {
  readonly directory: string;
  readonly file: string;
  readonly source: OfficialCaseCacheDiagnostics["cache_directory_source"];
} {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const homedir = options.homedir ?? os.homedir();
  const tmpdir = options.tmpdir ?? os.tmpdir();
  const explicit = env["SWISS_LEGAL_CACHE_DIR"];
  const xdg = env["XDG_CACHE_HOME"];
  const localAppData = env["LOCALAPPDATA"];
  let source: OfficialCaseCacheDiagnostics["cache_directory_source"];
  let directory: string;

  if (explicit !== undefined) {
    source = "SWISS_LEGAL_CACHE_DIR";
    directory = explicit;
  } else if (platform === "darwin" && homedir) {
    source = "macos_user_cache";
    directory = path.join(homedir, "Library", "Caches", "swiss-legal-mcp");
  } else if (platform === "linux" && xdg) {
    source = "linux_xdg_cache";
    directory = path.join(xdg, "swiss-legal-mcp");
  } else if (platform === "linux" && homedir) {
    source = "linux_home_cache";
    directory = path.join(homedir, ".cache", "swiss-legal-mcp");
  } else if (platform === "win32" && localAppData) {
    source = "windows_localappdata";
    directory = path.join(localAppData, "swiss-legal-mcp", "cache");
  } else {
    source = "tmpdir_fallback";
    directory = path.join(tmpdir, "swiss-legal-mcp-cache");
  }

  const absoluteDirectory = validateCacheDirectoryPath(directory);
  const canonicalDirectory =
    options.checkWritable === false
      ? absoluteDirectory
      : ensureWritableCacheDirectory(absoluteDirectory);
  return {
    directory: canonicalDirectory,
    file: path.join(canonicalDirectory, "official-swiss-case-store.json"),
    source,
  };
}

function storePath(): string {
  return resolveOfficialCaseStorePath().file;
}

function validateCacheDirectoryPath(directory: string): string {
  if (!directory.trim() || directory.startsWith("file:")) {
    throw new OfficialCaseCacheError("cache_path_invalid", "cache_path_invalid");
  }
  const absolute = path.resolve(directory);
  const parsed = path.parse(absolute);
  if (absolute === parsed.root || absolute === path.join(parsed.root, ".cache")) {
    throw new OfficialCaseCacheError("cache_path_invalid", "cache_path_invalid");
  }
  return absolute;
}

function ensureWritableCacheDirectory(directory: string): string {
  try {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  } catch (error) {
    throw new OfficialCaseCacheError(
      "cache_directory_creation_failed",
      "cache_directory_creation_failed",
      { cause: error },
    );
  }
  const canonicalDirectory = validateCacheDirectoryPath(fs.realpathSync.native(directory));
  const probe = path.join(directory, `.write-test-${process.pid}-${Date.now()}`);
  try {
    fs.writeFileSync(probe, "ok", { mode: 0o600 });
    fs.rmSync(probe, { force: true });
  } catch (error) {
    try {
      fs.rmSync(probe, { force: true });
    } catch {
      // Cleanup best effort.
    }
    throw new OfficialCaseCacheError(
      "cache_directory_not_writable",
      "cache_directory_not_writable",
      { cause: error },
    );
  }
  return canonicalDirectory;
}

function readStore(): OfficialCaseStore {
  const file = storePath();
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as OfficialCaseStore;
    return parsed.schema_version === storeSchemaVersion ? parsed : emptyStore();
  } catch (error) {
    if (error instanceof SyntaxError) {
      lastStoreWarning = renameCorruptStore(file)
        ? "cache_store_corrupt_renamed"
        : "cache_store_corrupt";
    }
    return emptyStore();
  }
}

function writeStore(store: OfficialCaseStore): void {
  const file = storePath();
  const directory = path.dirname(file);
  const tmp = path.join(directory, `.official-swiss-case-store-${process.pid}-${Date.now()}.tmp`);
  let fd: number | null = null;
  try {
    fd = fs.openSync(tmp, "wx", 0o600);
    fs.writeFileSync(fd, `${JSON.stringify(store, null, 2)}\n`);
    try {
      fs.fsyncSync(fd);
    } catch {
      // Some filesystems do not support fsync for this target.
    }
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmp, file);
    fs.chmodSync(file, 0o600);
  } catch (error) {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // Ignore close failure while preserving the structured write error.
      }
    }
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      // Ignore cleanup failure while preserving the structured write error.
    }
    throw new OfficialCaseCacheError("cache_atomic_write_failed", "cache_atomic_write_failed", {
      cause: error,
    });
  }
}

function mutateStore(mutator: (store: OfficialCaseStore) => void): void {
  withStoreLock(() => {
    const store = readStore();
    mutator(store);
    writeStore(store);
  });
}

function withStoreLock<T>(operation: () => T): T {
  const lockFile = `${storePath()}.lock`;
  let fd: number | null = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      fd = fs.openSync(lockFile, "wx", 0o600);
      break;
    } catch {
      sleepSync(10);
    }
  }
  if (fd === null) throw new OfficialCaseCacheError("cache_lock_failed", "cache_lock_failed");
  try {
    return operation();
  } finally {
    try {
      fs.closeSync(fd);
    } finally {
      fs.rmSync(lockFile, { force: true });
    }
  }
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function renameCorruptStore(file: string): boolean {
  try {
    if (!fs.existsSync(file)) return false;
    fs.renameSync(file, `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`);
    return true;
  } catch {
    // Keep startup available; next write will create a clean store.
    return false;
  }
}

export function getOfficialCaseCacheDiagnostics(): OfficialCaseCacheDiagnostics {
  const resolved = resolveOfficialCaseStorePath();
  const store = readStore();
  const initialized = fs.existsSync(resolved.file);
  const schemaVersion = initialized ? store.schema_version : storeSchemaVersion;
  const redactedPath = redactCachePath(resolved.file);
  return {
    cache_directory_source: resolved.source,
    cache_directory_writable: true,
    cache_store_initialized: initialized,
    cache_store_schema_version: schemaVersion,
    cache_path_redacted: redactedPath,
    cwd_independent: resolved.directory !== path.resolve(process.cwd(), ".cache"),
    warning: lastStoreWarning,
    store_schema_version: schemaVersion,
    cache_store_path_redacted: redactedPath,
    // If the store file already existed and contains at least one persisted
    // document before this call did anything, that data necessarily survived
    // from a prior, independent call into this module.
    persistence_between_independent_calls: initialized && Object.keys(store.documents).length > 0,
    persistence_after_process_restart: "not_tested",
    persistence_after_machine_restart: "not_tested",
  };
}

function redactCachePath(file: string): string {
  const home = os.homedir();
  return home && file.startsWith(home) ? file.replace(home, "~") : path.basename(file);
}

function isStoredDocumentValid(document: StoredOfficialCaseDocument | undefined): boolean {
  if (!document) return false;
  if (document.schema_version !== storeSchemaVersion) return false;
  if (!document.document_hash || !document.metadata_hash) return false;
  if (!document.retrieved_at || /^1970-01-01/.test(document.retrieved_at)) return false;
  if (document.bytes_received <= 0 || document.text.length === 0) return false;
  if (document.mock_or_fixture && isProductionRuntime()) return false;
  if (document.official_status === "official" && document.live_http_verified !== true) return false;
  return true;
}

function documentIdFor(fetch: FullTextFetchResult): string | null {
  return fetch.document_hash ? `doc_${fetch.document_hash.slice(0, 32)}` : null;
}

/**
 * Looks up whether a valid document for `normalizedReference` is already
 * persisted on disk, without performing any network fetch. Call this before
 * doing anything else in a fresh process invocation: if it returns a
 * document id, that document was necessarily written by a *previous, separate
 * process* (this call did not fetch anything), which is direct evidence of
 * persistence across process restarts. If it returns null on run 1 but a
 * matching id on run 2 of the same CLI, that is a genuine, verifiable
 * `persistence_after_process_restart` test rather than a self-reported flag.
 */
export function findPersistedDocumentIdForReference(normalizedReference: string): string | null {
  const store = readStore();
  const resolutionId = store.indexes.resolution_by_normalized_reference[normalizedReference];
  if (!resolutionId) return null;
  const documentId = store.indexes.document_by_resolution_id[resolutionId];
  if (!documentId) return null;
  return isStoredDocumentValid(store.documents[documentId]) ? documentId : null;
}

function comparisonIdFor(
  officialDocumentId: string | null,
  secondaryDocumentIds: readonly string[],
): string {
  return `cmp_${sha256([officialDocumentId ?? "none", ...secondaryDocumentIds].join(":")).slice(0, 24)}`;
}

export function setOfficialSwissCaseHttpTransportForTests(
  transport: OfficialCaseHttpTransport | null,
): void {
  const runtimeMode = process["env"]["NODE_ENV"];
  if (runtimeMode === "production") {
    throw new Error("mock_transport_detected_in_production");
  }
  officialCaseHttpTransport = transport ?? liveHttpFetch;
}

export function normalizeSwissCaseReference(raw: string): NormalizedCaseReference {
  const trimmed = raw.trim();
  const urlReference = extractUrl(trimmed);
  if (urlReference) {
    return {
      raw_reference: raw,
      normalized_reference: urlReference.toString(),
      citation_family: "url",
      court_family: inferCourtFamilyFromHost(urlReference.hostname),
      possible_courts: possibleCourtsForHost(urlReference.hostname),
      possible_cantons: [],
      decision_year: extractYear(trimmed),
      sequence_number: null,
      chamber_or_division: null,
      publication_type: "url",
      normalization_confidence: 0.7,
    };
  }

  const bge = /^(BGE|ATF|DTF)\s+(\d+)\s+([IVX]+)\s+(\d+)$/i.exec(trimmed);
  if (bge) {
    const [, reporter, volume, division, page] = bge as unknown as [
      string,
      string,
      string,
      string,
      string,
    ];
    const canonical = `BGE ${volume} ${division.toUpperCase()} ${page}`;
    return {
      raw_reference: raw,
      normalized_reference: canonical,
      citation_family: "published_federal_report",
      court_family: "swiss_federal_supreme_court",
      possible_courts: ["swiss_federal_supreme_court"],
      possible_cantons: [],
      decision_year: null,
      sequence_number: `${volume}-${division.toUpperCase()}-${page}`,
      chamber_or_division: division.toUpperCase(),
      publication_type: "official_report",
      normalization_confidence: 0.95,
      reporter: reporter.toUpperCase() as "BGE" | "ATF" | "DTF",
      published_report_volume: volume,
      published_report_division: division.toUpperCase(),
      published_report_page: page,
      canonical_published_citation: canonical,
    };
  }

  const legacyBger = /^([0-9][A-Z])[._\s-](\d+)\/(\d{4})$/i.exec(trimmed);
  if (legacyBger) {
    const [, chamber, sequence, year] = legacyBger as unknown as [string, string, string, string];
    const separator = trimmed.includes(".") ? "." : "_";
    return {
      raw_reference: raw,
      normalized_reference: `${chamber.toUpperCase()}${separator}${Number(sequence)}/${year}`,
      citation_family: "federal_case_number",
      court_family: "swiss_federal_supreme_court",
      possible_courts: ["swiss_federal_supreme_court"],
      possible_cantons: [],
      decision_year: Number(year),
      sequence_number: sequence,
      chamber_or_division: chamber.toUpperCase(),
      publication_type: "case_number",
      normalization_confidence: 0.94,
    };
  }

  const bger = /^([0-9][A-Z])[_\s-](\d+)\/(\d{4})$/i.exec(trimmed);
  if (bger) {
    const [, chamber, sequence, year] = bger as unknown as [string, string, string, string];
    return {
      raw_reference: raw,
      normalized_reference: `${chamber.toUpperCase()}_${sequence}/${year}`,
      citation_family: "federal_case_number",
      court_family: "swiss_federal_supreme_court",
      possible_courts: ["swiss_federal_supreme_court"],
      possible_cantons: [],
      decision_year: Number(year),
      sequence_number: sequence,
      chamber_or_division: chamber.toUpperCase(),
      publication_type: "case_number",
      normalization_confidence: 0.96,
    };
  }

  const incompleteBger = /^([0-9][A-Z])[_\s-](\d+)$/i.exec(trimmed);
  if (incompleteBger) {
    const [, chamber, sequence] = incompleteBger as unknown as [string, string, string];
    return {
      raw_reference: raw,
      normalized_reference: `${chamber.toUpperCase()}_${sequence}`,
      citation_family: "federal_case_number",
      court_family: "swiss_federal_supreme_court",
      possible_courts: ["swiss_federal_supreme_court"],
      possible_cantons: [],
      decision_year: null,
      sequence_number: sequence,
      chamber_or_division: chamber.toUpperCase(),
      publication_type: "case_number",
      normalization_confidence: 0.62,
    };
  }

  const bvger = /^([A-Z])-(\d+)\/(\d{4})$/i.exec(trimmed);
  if (bvger) {
    const [, division, sequence, year] = bvger as unknown as [string, string, string, string];
    return {
      raw_reference: raw,
      normalized_reference: `${division.toUpperCase()}-${sequence}/${year}`,
      citation_family: "bvger_case_number",
      court_family: "federal_administrative_court",
      possible_courts: ["federal_administrative_court"],
      possible_cantons: [],
      decision_year: Number(year),
      sequence_number: sequence,
      chamber_or_division: division.toUpperCase(),
      publication_type: "case_number",
      normalization_confidence: 0.94,
    };
  }

  const bstger = /^([A-Z]{1,3})\.(\d{4})\.(\d+)$/i.exec(trimmed);
  if (bstger) {
    const [, division, year, sequence] = bstger as unknown as [string, string, string, string];
    return {
      raw_reference: raw,
      normalized_reference: `${division.toUpperCase()}.${year}.${sequence}`,
      citation_family: "bstger_case_number",
      court_family: "federal_criminal_court",
      possible_courts: ["federal_criminal_court"],
      possible_cantons: [],
      decision_year: Number(year),
      sequence_number: sequence,
      chamber_or_division: division.toUpperCase(),
      publication_type: "case_number",
      normalization_confidence: 0.94,
    };
  }

  const incompleteBstger = /^([A-Z]{1,3})\.(\d{4})$/i.exec(trimmed);
  if (incompleteBstger) {
    const [, division, year] = incompleteBstger as unknown as [string, string, string];
    return {
      raw_reference: raw,
      normalized_reference: `${division.toUpperCase()}.${year}`,
      citation_family: "bstger_case_number",
      court_family: "federal_criminal_court",
      possible_courts: ["federal_criminal_court"],
      possible_cantons: [],
      decision_year: Number(year),
      sequence_number: null,
      chamber_or_division: division.toUpperCase(),
      publication_type: "case_number",
      normalization_confidence: 0.62,
    };
  }

  const arCase = /^([A-Z][0-9][A-Z]|AB)\s+(\d{2})\s+(\d{1,4})$/i.exec(trimmed);
  if (arCase) {
    const [, division, year, sequence] = arCase as unknown as [string, string, string, string];
    return {
      raw_reference: raw,
      normalized_reference: `${division.toUpperCase()} ${year} ${Number(sequence)}`,
      citation_family: "cantonal_case_number",
      court_family: "cantonal_court",
      possible_courts: ["Obergericht Appenzell Ausserrhoden"],
      possible_cantons: ["AR"],
      decision_year: 2000 + Number(year),
      sequence_number: String(Number(sequence)),
      chamber_or_division: division.toUpperCase(),
      publication_type: "case_number",
      normalization_confidence: 0.9,
    };
  }

  const cantonal = /^([A-Z]{1,3})[./](\d{2,4}(?:\.\d+)?)(?:\/(\d{4}))?$/i.exec(trimmed);
  if (cantonal) {
    const [, division, sequence, year] = cantonal as unknown as [
      string,
      string,
      string,
      string | undefined,
    ];
    return {
      raw_reference: raw,
      normalized_reference: trimmed.toUpperCase(),
      citation_family: "cantonal_case_number",
      court_family: "cantonal_court",
      possible_courts: [],
      possible_cantons: [],
      decision_year: year ? Number(year) : extractYear(trimmed),
      sequence_number: sequence,
      chamber_or_division: division.toUpperCase(),
      publication_type: "case_number",
      normalization_confidence: 0.56,
    };
  }

  return {
    raw_reference: raw,
    normalized_reference: trimmed,
    citation_family: "unknown",
    court_family: "unknown",
    possible_courts: [],
    possible_cantons: [],
    decision_year: extractYear(trimmed),
    sequence_number: null,
    chamber_or_division: null,
    publication_type: "unknown",
    normalization_confidence: 0.15,
  };
}

export async function resolveOfficialSwissCase(
  input: ResolveOfficialSwissCaseInput,
  _signal?: AbortSignal,
): Promise<OfficialSwissCaseResolution> {
  if (input.resolution_id && !input.case_reference) {
    return resolveStoredOfficialSwissCase(
      input.resolution_id,
      input.presentation_mode ?? "technical_control",
    );
  }
  if (!input.case_reference) {
    return emptyStoredResolution(
      input.resolution_id ?? "missing_identifier",
      "missing_identifier",
      input.presentation_mode ?? "technical_control",
    );
  }
  const normalized = normalizeSwissCaseReference(input.case_reference);
  const cacheKey = `${normalized.normalized_reference}:${input.source_url_hint ?? ""}`;
  const prior = cache.get(cacheKey);
  const attempts: {
    adapter: string;
    status: string;
    reason: string;
    url?: string;
  }[] = [];
  const rawCandidates = adapters()
    .flatMap((adapter) => {
      if (!adapter.canHandle(normalized, input)) return [];
      const requests = adapter.buildSearchRequests(normalized, input);
      attempts.push(
        ...requests.map((url) => ({
          adapter: adapter.id,
          status: "attempted",
          reason: "candidate search request built",
          url,
        })),
      );
      return adapter.parseSearchResults(normalized, input);
    })
    .filter((candidate) => isAllowedCandidateUrl(candidate.source_url));
  // Pre-fetch structural deduplication: merges candidates that different
  // adapters produced for the exact same decision (e.g. a case_reference
  // search candidate + a source_url_hint direct-URL candidate) BEFORE they
  // are scored, so they cannot land as two independent, falsely-ambiguous
  // candidates. See `mergePreFetchDuplicates` for the full rationale.
  const preFetchDedup = mergePreFetchDuplicates(rawCandidates);
  const candidates = rankCandidates(preFetchDedup.candidates, normalized, input);
  const discovery = selectCandidate(candidates);
  let selected = discovery.selected;

  if (
    !selected &&
    input.allow_unofficial_fallback === true &&
    input.require_official_source !== true
  ) {
    selected = candidates.find((candidate) => !candidate.official) ?? null;
  }
  if (input.require_official_source === true && selected && !selected.official) {
    selected = null;
  }

  const identity = selected
    ? verifySwissCaseIdentity({
        normalized,
        candidate: selected,
        strict: input.strict_identity_match === true,
      })
    : emptyIdentity(
        discovery.status === "candidate_ambiguous"
          ? "identity_ambiguous"
          : "identity_not_verifiable",
      );
  const fetch =
    selected && input.retrieval_mode !== "metadata_only" && input.retrieval_mode !== "cache_only"
      ? await fetchOfficialSwissCaseFullText({
          candidate: selected,
          requireOfficial: input.require_official_source === true,
          requireFullText: input.require_full_text === true,
        })
      : null;
  const candidateNotFound =
    fetch?.warnings.some((warning) =>
      /candidate_not_found|portal_accessible_no_result/i.test(warning),
    ) === true;
  const exactArCandidateNotFound =
    candidateNotFound && selected?.source_adapter === "canton_appenzell_ausserrhoden";
  const mappedSelected =
    selected && fetch ? applyFetchPublicationMappingToCandidate(selected, fetch) : selected;
  const effectiveSelected = exactArCandidateNotFound ? null : mappedSelected;
  const effectiveDiscoveryStatus: DiscoveryStatus = exactArCandidateNotFound
    ? "no_candidate"
    : discovery.status;
  const selectionBlockers = exactArCandidateNotFound
    ? uniqueStrings([...discovery.reasons, "candidate_not_found"])
    : discovery.reasons;
  const documentAvailability = classifyDocumentAvailability(
    fetch,
    effectiveSelected,
    input.retrieval_mode,
  );
  const fetchability = classifyFetchability(documentAvailability);
  const selectedCandidateStatus = classifySelectedCandidateStatus(effectiveSelected, fetchability);
  const completeness = fetch ? verifyCompleteness(fetch) : null;
  const fallbackIdentity = exactArCandidateNotFound
    ? emptyIdentity("identity_not_verifiable")
    : identity;
  const verifiedIdentity =
    effectiveSelected && fetch?.live_metadata && fetch.fetch_status !== "fetch_failed"
      ? verifySwissCaseIdentity({
          normalized,
          candidate: effectiveSelected,
          liveDocumentMetadata: fetch.live_metadata,
          strict: input.strict_identity_match === true,
        })
      : effectiveSelected &&
          fetch &&
          fetch.fetch_status !== "fetch_success" &&
          fetch.fetch_status !== "fetch_partial"
        ? emptyIdentity("identity_not_verifiable")
        : fallbackIdentity;
  const secondaryCandidates = candidates.filter(
    (candidate) => candidate !== effectiveSelected && !candidate.official,
  );
  const comparison =
    effectiveSelected && effectiveSelected.official
      ? compareSwissCaseSources({
          official: effectiveSelected,
          official_document: fetch ?? undefined,
          secondary: secondaryCandidates,
        })
      : null;
  const legalUse = legalUseStatus({
    discovery_status: effectiveDiscoveryStatus,
    selected: effectiveSelected,
    identity: verifiedIdentity,
    fetch,
    completeness,
    requireOfficial: input.require_official_source === true,
  });
  const currentEntry = effectiveSelected
    ? makeCacheEntry(effectiveSelected, fetch, verifiedIdentity, completeness, legalUse)
    : null;
  const cacheStatus = classifyCache(prior, currentEntry, input.retrieval_mode === "refresh");
  if (currentEntry && input.retrieval_mode !== "cache_only") cache.set(cacheKey, currentEntry);
  const documentId = fetch ? documentIdFor(fetch) : null;
  const resolutionId = makeResolutionId(
    normalized.normalized_reference,
    effectiveSelected?.canonical_url ?? input.source_url_hint ?? "",
  );
  const warnings = [
    ...preFetchDedup.notes,
    ...(discovery.reasons.length > 0 ? discovery.reasons : []),
    ...(effectiveSelected === null && input.require_official_source
      ? ["official_source_not_found"]
      : []),
    ...(fetch?.warnings ?? []),
    ...(completeness?.extraction_errors ?? []),
    ...(comparison?.source_mismatch ?? []),
  ];

  const resolution = presentResolution(
    {
      resolution_id: resolutionId,
      document_id: documentId,
      normalized_reference: normalized.normalized_reference,
      source_adapter: effectiveSelected?.source_adapter ?? effectiveSelected?.source ?? null,
      source_status: legalUse.source_status,
      requested_url: fetch?.requested_url ?? effectiveSelected?.source_url ?? null,
      canonical_url: effectiveSelected?.canonical_url ?? null,
      final_url: fetch?.final_url ?? effectiveSelected?.canonical_url ?? null,
      candidate_fingerprint: effectiveSelected?.candidate_fingerprint ?? null,
      metadata_hash: fetch?.metadata_hash ?? currentEntry?.metadata_hash ?? null,
      document_hash: fetch?.document_hash ?? null,
      cache_key: cacheKey,
      retrieved_at: fetch?.retrieved_at ?? null,
      normalized,
      discovery_status: effectiveDiscoveryStatus,
      document_availability_status: documentAvailability,
      fetchability_status: fetchability,
      selected_candidate_status: selectedCandidateStatus,
      candidates,
      candidate_count: candidates.length,
      selected_candidate_id: effectiveSelected?.candidate_id ?? null,
      selected_candidate: effectiveSelected,
      rejected_candidates: candidates.filter((candidate) => candidate !== effectiveSelected),
      ambiguity_status:
        effectiveDiscoveryStatus === "candidate_ambiguous"
          ? "ambiguous"
          : effectiveDiscoveryStatus === "candidate_selected"
            ? "unambiguous"
            : "none",
      selection_reason: effectiveSelected?.selection_reason ?? selectionBlockers.join(","),
      selection_blockers: selectionBlockers,
      required_user_disambiguation: selectionBlockers.includes("required_user_disambiguation"),
      candidate_fingerprints: candidates.map(
        (candidate) => candidate.candidate_fingerprint ?? candidate.candidate_id,
      ),
      identity: verifiedIdentity,
      fetch,
      completeness,
      comparison,
      legal_use: legalUse,
      cache_status: cacheStatus,
      store_schema_version: storeSchemaVersion,
      cache_origin:
        fetch?.cache_status === "cache_hit_valid"
          ? "stored"
          : fetch?.network_transport === "live_http" || fetch?.network_transport === "test_http"
            ? fetch.network_transport
            : "unknown",
      persistence_verified: Boolean(documentId),
      attempts,
      presentation: {
        mode: input.presentation_mode ?? "technical_control",
        summary: "",
        technical_visible: true,
      },
      warnings,
    },
    input.presentation_mode ?? "technical_control",
  );
  persistResolution(resolution);
  return resolution;
}

function resolveStoredOfficialSwissCase(
  resolutionId: string,
  presentationMode: "clean" | "professional" | "technical_control" | "debug",
): OfficialSwissCaseResolution {
  const store = readStore();
  const stored = store.resolutions[resolutionId];
  if (!stored) return emptyStoredResolution(resolutionId, "resolution_not_found", presentationMode);
  const normalized = normalizeSwissCaseReference(stored.normalized_reference);
  const candidates = stored.candidates ?? [];
  const selected =
    stored.selected_candidate_id && stored.candidate
      ? stored.candidate
      : stored.selected_candidate_id
        ? (candidates.find(
            (candidate) => candidate.candidate_id === stored.selected_candidate_id,
          ) ?? null)
        : null;
  const fetchDocumentId = store.indexes.document_by_resolution_id[resolutionId];
  const fetchDocument = fetchDocumentId ? store.documents[fetchDocumentId] : undefined;
  const fetch = fetchDocument ? storedDocumentToFetch(fetchDocument, "cache_hit_valid") : null;
  const selectionBlockers = stored.selection_blockers ?? [];
  const discoveryStatus: DiscoveryStatus =
    stored.ambiguity_status === "ambiguous"
      ? "candidate_ambiguous"
      : selected
        ? "candidate_selected"
        : "no_candidate";
  const identity =
    stored.identity ??
    (selected
      ? verifySwissCaseIdentity({
          normalized,
          candidate: selected,
          liveDocumentMetadata: fetch?.live_metadata ?? stored.live_metadata,
          strict: true,
        })
      : emptyIdentity(
          discoveryStatus === "candidate_ambiguous"
            ? "identity_ambiguous"
            : "identity_not_verifiable",
        ));
  const completeness = fetch ? verifyCompleteness(fetch) : null;
  const documentAvailability = classifyDocumentAvailability(
    fetch,
    selected,
    fetch ? "full_text" : "metadata_only",
  );
  const fetchability = classifyFetchability(documentAvailability);
  const legalUse = legalUseStatus({
    discovery_status: discoveryStatus,
    selected,
    identity,
    fetch,
    completeness,
    requireOfficial: true,
  });
  return presentResolution(
    {
      resolution_id: resolutionId,
      document_id: fetch?.document_id ?? stored.document_id ?? null,
      normalized_reference: stored.normalized_reference,
      source_adapter: stored.source_adapter,
      source_status: legalUse.source_status,
      requested_url: stored.requested_url,
      canonical_url: stored.canonical_url,
      final_url: fetch?.final_url ?? stored.final_url,
      candidate_fingerprint: stored.candidate_fingerprint,
      metadata_hash: fetch?.metadata_hash ?? stored.metadata_hash,
      document_hash: fetch?.document_hash ?? stored.document_hash,
      cache_key: stored.cache_key,
      retrieved_at: fetch?.retrieved_at ?? stored.retrieved_at,
      normalized,
      discovery_status: discoveryStatus,
      document_availability_status: documentAvailability,
      fetchability_status: fetchability,
      selected_candidate_status: classifySelectedCandidateStatus(selected, fetchability),
      candidates,
      candidate_count: candidates.length,
      selected_candidate_id: selected?.candidate_id ?? null,
      selected_candidate: selected,
      rejected_candidates:
        stored.rejected_candidates ?? candidates.filter((candidate) => candidate !== selected),
      ambiguity_status: stored.ambiguity_status,
      selection_reason: stored.selection_reason,
      selection_blockers: selectionBlockers,
      required_user_disambiguation: selectionBlockers.includes("required_user_disambiguation"),
      candidate_fingerprints: candidates.map(
        (candidate) => candidate.candidate_fingerprint ?? candidate.candidate_id,
      ),
      created_at: stored.created_at ?? stored.stored_at,
      updated_at: stored.updated_at ?? stored.stored_at,
      identity,
      fetch,
      completeness,
      comparison: null,
      legal_use: legalUse,
      cache_status: "cache_hit_valid",
      store_schema_version: store.schema_version,
      cache_origin: "stored",
      persistence_verified: true,
      attempts: [],
      presentation: {
        mode: presentationMode,
        summary: "",
        technical_visible: true,
      },
      warnings: selectionBlockers,
    },
    presentationMode,
  );
}

function emptyStoredResolution(
  resolutionId: string,
  warning: string,
  presentationMode: "clean" | "professional" | "technical_control" | "debug",
): OfficialSwissCaseResolution {
  const normalized = normalizeSwissCaseReference(resolutionId);
  const identity = emptyIdentity("identity_not_verifiable");
  const legalUse = legalUseStatus({
    discovery_status: "no_candidate",
    selected: null,
    identity,
    fetch: null,
    completeness: null,
    requireOfficial: true,
  });
  return presentResolution(
    {
      resolution_id: resolutionId,
      normalized_reference: normalized.normalized_reference,
      normalized,
      discovery_status: "no_candidate",
      document_availability_status: "unknown",
      fetchability_status: "not_fetchable",
      selected_candidate_status: "no_candidate_selected",
      candidates: [],
      candidate_count: 0,
      selected_candidate_id: null,
      selected_candidate: null,
      rejected_candidates: [],
      ambiguity_status: "none",
      selection_reason: warning,
      selection_blockers: [warning],
      required_user_disambiguation: false,
      candidate_fingerprints: [],
      identity,
      fetch: null,
      completeness: null,
      comparison: null,
      legal_use: legalUse,
      cache_status: "cache_miss",
      store_schema_version: storeSchemaVersion,
      cache_origin: "stored",
      persistence_verified: false,
      attempts: [],
      presentation: {
        mode: presentationMode,
        summary: "",
        technical_visible: true,
      },
      warnings: [warning],
    },
    presentationMode,
  );
}

export function verifySwissCaseIdentity(input: {
  readonly normalized: NormalizedCaseReference;
  readonly candidate: OfficialCaseCandidate;
  readonly liveDocumentMetadata?: LiveDocumentMetadata;
  readonly searchResultMetadata?: LiveDocumentMetadata;
  readonly strict?: boolean;
}): IdentityVerification {
  const yearIdentity = buildYearIdentity(
    input.normalized,
    input.candidate,
    input.liveDocumentMetadata,
  );
  const matched: string[] = [];
  const mismatched: string[] = [];
  const missing: string[] = [];
  const ambiguity: string[] = [];

  const evidenceSources = new Set<string>(["user_reference"]);
  if (input.normalized.citation_family === "published_federal_report") {
    compareField(
      "published_citation",
      input.normalized.canonical_published_citation ?? input.normalized.normalized_reference,
      input.candidate.published_citation ?? input.candidate.reference,
      matched,
      mismatched,
      missing,
    );
    // Los campos opcionales de archivo (case_reference, official_docid) se
    // usan como evidencia positiva cuando estan presentes; su ausencia NO
    // penaliza la confianza -- son metadatos de indexacion secundaria que
    // muchos proveedores de busqueda no devuelven, y penalizarlos rebajaba
    // incorrectamente decisiones BGE verificadas a "identity_probable".
    if (input.candidate.case_reference) matched.push("official_case_reference");
    if (input.candidate.official_docid) matched.push("official_docid");
  } else {
    // Canonicalize case numbers for reliable comparison
    const normalizedRefCanonical =
      input.normalized.citation_family === "federal_case_number"
        ? (canonicalizeSwissCaseNumber(input.normalized.normalized_reference) ??
          input.normalized.normalized_reference)
        : input.normalized.normalized_reference;
    const candidateRefCanonical =
      input.candidate.reference && input.normalized.citation_family === "federal_case_number"
        ? (canonicalizeSwissCaseNumber(input.candidate.reference) ?? input.candidate.reference)
        : input.candidate.reference;

    compareField(
      "reference",
      normalizedRefCanonical,
      candidateRefCanonical,
      matched,
      mismatched,
      missing,
    );
  }
  compareField(
    "court_family",
    input.normalized.court_family,
    input.candidate.court_family,
    matched,
    mismatched,
    missing,
  );
  if (yearIdentity.reference_year) matched.push("reference_year");
  if (yearIdentity.decision_year) matched.push("decision_year");
  if (input.normalized.chamber_or_division) {
    compareField(
      "chamber_or_division",
      input.normalized.chamber_or_division,
      input.candidate.chamber,
      matched,
      mismatched,
      missing,
    );
  }
  if (input.candidate.title === null) missing.push("title");
  else matched.push("candidate_title");
  if (input.candidate.canonical_url) matched.push("candidate_canonical_url");
  else missing.push("candidate_canonical_url");

  if (input.liveDocumentMetadata) {
    evidenceSources.add("live_document");
    if (input.normalized.citation_family === "published_federal_report") {
      compareField(
        "live_published_citation",
        input.normalized.canonical_published_citation ?? input.normalized.normalized_reference,
        input.liveDocumentMetadata.published_citation ?? null,
        matched,
        mismatched,
        missing,
      );
      // Positivo-only: si el documento en vivo no expone estos campos de
      // archivo, no se penaliza la confianza (mismo racional que arriba).
      if (input.liveDocumentMetadata.case_reference) matched.push("live_official_case_reference");
      if (input.liveDocumentMetadata.official_docid) matched.push("live_official_docid");
    } else {
      // Canonicalize case numbers for reliable comparison
      const normalizedRefCanonical =
        input.normalized.citation_family === "federal_case_number"
          ? (canonicalizeSwissCaseNumber(input.normalized.normalized_reference) ??
            input.normalized.normalized_reference)
          : input.normalized.normalized_reference;
      const liveDocRefCanonical =
        input.liveDocumentMetadata.reference &&
        input.normalized.citation_family === "federal_case_number"
          ? (canonicalizeSwissCaseNumber(input.liveDocumentMetadata.reference) ??
            input.liveDocumentMetadata.reference)
          : input.liveDocumentMetadata.reference;

      compareField(
        "live_document_reference",
        normalizedRefCanonical,
        liveDocRefCanonical,
        matched,
        mismatched,
        missing,
      );
    }
    if (input.liveDocumentMetadata.court_family) {
      compareField(
        "live_document_court_family",
        input.normalized.court_family,
        input.liveDocumentMetadata.court_family,
        matched,
        mismatched,
        missing,
      );
    }
  }
  if (input.searchResultMetadata) evidenceSources.add("official_search_result");

  if (
    input.normalized.citation_family === "cantonal_case_number" &&
    input.candidate.canton === null
  ) {
    ambiguity.push("cantonal reference requires court or canton context");
  }

  const score = Math.max(0, matched.length - mismatched.length * 2 - missing.length * 0.25);
  const denominator = matched.length + mismatched.length + missing.length || 1;
  const confidence = Number(Math.min(1, Math.max(0, score / denominator)).toFixed(2));
  const independentEvidenceCount = evidenceSources.size;
  const circularVerification = independentEvidenceCount < 2;
  const status: IdentityStatus = circularVerification
    ? "identity_not_verifiable"
    : mismatched.length > 0
      ? "identity_mismatch"
      : ambiguity.length > 0
        ? "identity_ambiguous"
        : confidence >= 0.82 && input.candidate.official
          ? "identity_verified"
          : confidence >= 0.62
            ? "identity_probable"
            : "identity_not_verifiable";
  const finalStatus = input.strict && status !== "identity_verified" ? "identity_mismatch" : status;
  return {
    status: finalStatus,
    matched_fields: matched,
    mismatched_fields: mismatched,
    missing_fields: missing,
    ambiguity_reasons: ambiguity,
    identity_score: Number(score.toFixed(2)),
    identity_confidence: confidence,
    official_identity_verified:
      status === "identity_verified" && input.candidate.official && !circularVerification,
    requires_human_review: status !== "identity_verified",
    identity_evidence_sources: [...evidenceSources],
    independent_evidence_count: independentEvidenceCount,
    metadata_extracted_from_live_document: input.liveDocumentMetadata !== undefined,
    metadata_extracted_from_search_result: input.searchResultMetadata !== undefined,
    circular_verification_detected: circularVerification,
    ...yearIdentity,
  };
}

function buildYearIdentity(
  normalized: NormalizedCaseReference,
  candidate: OfficialCaseCandidate,
  liveDocumentMetadata?: LiveDocumentMetadata,
): Pick<
  IdentityVerification,
  | "reference_year"
  | "reference_year_source"
  | "decision_year"
  | "decision_year_source"
  | "year_relationship"
  | "year_mismatch"
  | "year_mismatch_blocking"
> {
  const referenceYear = isReferenceYearFamily(normalized.citation_family)
    ? normalized.decision_year
    : null;
  const liveDecisionYear = liveDocumentMetadata?.decision_date
    ? Number(liveDocumentMetadata.decision_date.slice(0, 4))
    : null;
  const candidateDecisionYear = candidate.decision_date
    ? Number(candidate.decision_date.slice(0, 4))
    : null;
  const decisionYear = liveDecisionYear ?? candidateDecisionYear;
  const decisionYearSource = liveDecisionYear
    ? (liveDocumentMetadata?.decision_date_source ?? "live_document")
    : candidateDecisionYear
      ? "official_search_result_metadata"
      : null;
  const relationship =
    referenceYear && decisionYear
      ? decisionYear === referenceYear
        ? "same_year"
        : decisionYear > referenceYear
          ? "decision_after_reference_year"
          : "decision_before_reference_year"
      : referenceYear || decisionYear
        ? "insufficient_data"
        : "insufficient_data";
  return {
    reference_year: referenceYear,
    reference_year_source: referenceYear ? "case_reference" : null,
    decision_year: decisionYear,
    decision_year_source: decisionYearSource,
    year_relationship: relationship,
    year_mismatch: false,
    year_mismatch_blocking: false,
  };
}

function isReferenceYearFamily(citationFamily: CitationFamily): boolean {
  return (
    citationFamily === "federal_case_number" ||
    citationFamily === "bvger_case_number" ||
    citationFamily === "bstger_case_number" ||
    citationFamily === "cantonal_case_number"
  );
}

export async function verifySwissCaseIdentityByIdentifier(input: {
  readonly resolution_id?: string;
  readonly document_id?: string;
  readonly normalized_reference?: string;
  readonly requested_reference?: string;
  readonly case_reference?: string;
  readonly user_hints?: Record<string, string | number | boolean | null>;
  readonly strict?: boolean;
}): Promise<IdentityVerification> {
  const reference = input.requested_reference ?? input.case_reference ?? input.normalized_reference;
  const store = readStore();
  const directDocument =
    input.document_id !== undefined ? store.documents[input.document_id] : undefined;
  if (directDocument) {
    const normalized = normalizeSwissCaseReference(
      reference ?? directDocument.normalized_reference,
    );
    return verifySwissCaseIdentity({
      normalized,
      candidate: directDocument.candidate ?? candidateFromStoredDocument(directDocument),
      liveDocumentMetadata: directDocument.live_metadata,
      searchResultMetadata: {
        reference: directDocument.normalized_reference,
        decision_date: directDocument.live_metadata?.decision_date ?? null,
        court_family: directDocument.live_metadata?.court_family ?? null,
        title: directDocument.live_metadata?.title ?? null,
      },
      strict: input.strict ?? true,
    });
  }
  if (reference) {
    const normalizedReference = normalizeSwissCaseReference(reference).normalized_reference;
    const storedResolutionId =
      store.indexes.resolution_by_normalized_reference[normalizedReference];
    const storedResolution = storedResolutionId ? store.resolutions[storedResolutionId] : undefined;
    if (storedResolution?.identity) return storedResolution.identity;
  }
  const cached = selectStoredDocument(store, input);
  if (cached.document) {
    const normalized = normalizeSwissCaseReference(
      reference ?? cached.document.normalized_reference,
    );
    return verifySwissCaseIdentity({
      normalized,
      candidate: cached.document.candidate ?? candidateFromStoredDocument(cached.document),
      liveDocumentMetadata: cached.document.live_metadata,
      searchResultMetadata: {
        reference: cached.document.normalized_reference,
        decision_date: cached.document.live_metadata?.decision_date ?? null,
        court_family: cached.document.live_metadata?.court_family ?? null,
        title: cached.document.live_metadata?.title ?? null,
      },
      strict: input.strict ?? true,
    });
  }
  if (input.resolution_id) {
    const stored = store.resolutions[input.resolution_id];
    if (stored?.candidate) {
      return verifySwissCaseIdentity({
        normalized: normalizeSwissCaseReference(reference ?? stored.normalized_reference),
        candidate: stored.candidate,
        strict: input.strict ?? true,
      });
    }
  }
  if (reference) {
    const normalized = normalizeSwissCaseReference(reference);
    return verifySwissCaseIdentity({
      normalized,
      candidate: {
        candidate_id: "reference-only",
        source: "manual_reference",
        source_url: normalized.normalized_reference,
        canonical_url: normalized.normalized_reference,
        official: false,
        court: normalized.court_family,
        court_family: normalized.court_family,
        canton: null,
        reference: normalized.normalized_reference,
        decision_date: null,
        decision_date_status: "not_verified",
        chamber: normalized.chamber_or_division,
        language: null,
        title: null,
        mime_type: null,
        content_kind: "unknown",
        score: 0,
        matched_features: [],
        mismatched_features: [],
        missing_features: [],
        selection_reason: "reference only identity check",
        rejected_reason: null,
      },
      strict: input.strict ?? true,
    });
  }
  return emptyIdentity("identity_not_verifiable");
}

export async function fetchOfficialSwissCaseFullText(
  input: {
    readonly candidate: OfficialCaseCandidate;
    readonly requireOfficial?: boolean;
    readonly requireFullText?: boolean;
    // Pagination parameters for large document support
    readonly chunk_index?: number;
    readonly chunk_token?: string;
  },
  signal?: AbortSignal,
): Promise<FullTextFetchResult> {
  const candidate = input.candidate;
  if (input.requireOfficial && !candidate.official) {
    return failedFetch(candidate, "fetch_failed", ["official_source_required"]);
  }
  if (!isAllowedCandidateUrl(candidate.source_url)) {
    return failedFetch(candidate, "fetch_failed", ["network_policy_blocked"]);
  }
  if (candidate.content_kind === "error")
    return failedFetch(candidate, "content_not_case", ["content_not_case"]);

  if (candidate.content !== undefined) {
    if (Buffer.byteLength(candidate.content) > maxOfficialCaseResponseBytes) {
      return failedFetch(candidate, "fetch_failed", ["response_too_large"]);
    }
    const synthetic = detectSyntheticContent(candidate.content, candidate);
    if (isProductionRuntime() || synthetic.length > 0) {
      return failedFetch(candidate, "fetch_failed", synthetic);
    }
    const fixtureFetch = await fetchFromHttpResponse(
      candidate,
      {
        requested_url: candidate.source_url,
        final_url: candidate.canonical_url,
        status_code: 200,
        redirect_chain:
          candidate.source_url === candidate.canonical_url ? [] : [candidate.canonical_url],
        response_headers: {
          "content-type": candidate.mime_type ?? "text/plain",
          "x-swiss-legal-mcp-test-transport": "true",
        },
        mime_type: candidate.mime_type,
        content_length: Buffer.byteLength(candidate.content),
        bytes_received: Buffer.byteLength(candidate.content),
        retrieved_at: new Date().toISOString(),
        body: new TextEncoder().encode(candidate.content),
        network_transport: "test_http",
        mock_or_fixture: true,
      },
      ["fixture_content_detected_in_test"],
      input.chunk_index,
      input.chunk_token,
    );
    return finalizeFetch(candidate, fixtureFetch, "cache_miss");
  }

  let response: OfficialCaseHttpResponse;
  try {
    response = await fetchOfficialCandidateBytes(candidate, signal);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/rate limit|too many requests|HTTP 429/i.test(message))
      return failedFetch(candidate, "rate_limited", ["rate_limited", message]);
    if (/login|sign in|captcha|challenge|HTTP 403|HTTP 401/i.test(message))
      return failedFetch(candidate, "access_restricted", ["access_restricted", message]);
    if (/no_exact_official_document_link_found/i.test(message)) {
      return failedFetch(candidate, "fetch_failed", [
        "document_fetch_failed",
        "redirect_to_search_page",
        "invalid_download_url",
        message,
      ]);
    }
    if (/candidate_not_found|portal_accessible_no_result/i.test(message)) {
      return failedFetch(candidate, "fetch_failed", [
        "document_fetch_failed",
        "candidate_not_found",
        message,
      ]);
    }
    return failedFetch(candidate, "fetch_failed", [message]);
  }

  if (response.mock_or_fixture && isProductionRuntime()) {
    return failedFetch(candidate, "fetch_failed", ["mock_transport_detected_in_production"]);
  }
  const fetch = await fetchFromHttpResponse(
    candidate,
    response,
    [],
    input.chunk_index,
    input.chunk_token,
  );
  return finalizeFetch(candidate, fetch, "cache_miss");
}

export async function fetchOfficialSwissCaseFullTextByIdentifier(
  input: {
    readonly resolution_id?: string;
    readonly candidate_id?: string;
    readonly document_id?: string;
    readonly canonical_url?: string;
    readonly normalized_reference?: string;
    readonly case_reference?: string;
    readonly requireOfficial?: boolean;
    readonly requireFullText?: boolean;
    // Pagination parameters for large document support
    readonly chunk_index?: number;
    readonly chunk_token?: string;
  },
  signal?: AbortSignal,
): Promise<FullTextFetchResult> {
  const store = readStore();
  const cached = selectStoredDocument(store, input);
  if (cached.status === "invalid") {
    return emptyIdentifierFetch(input, cached.reason ?? "invalid_identifier");
  }
  if (cached.document) return storedDocumentToFetch(cached.document, "cache_hit_valid");

  const candidate = selectStoredCandidate(store, input);
  if (candidate.status === "invalid") {
    return emptyIdentifierFetch(input, candidate.reason ?? "invalid_identifier");
  }
  if (candidate.candidate) {
    return fetchOfficialSwissCaseFullText(
      {
        candidate: candidate.candidate,
        requireOfficial: input.requireOfficial ?? true,
        requireFullText: input.requireFullText ?? true,
        chunk_index: input.chunk_index,
        chunk_token: input.chunk_token,
      },
      signal,
    );
  }

  const reference = input.normalized_reference ?? input.case_reference;
  if (input.canonical_url) {
    const normalized = normalizeSwissCaseReference(reference ?? input.canonical_url);
    const direct = makeCandidate({
      reference: normalized,
      source: isOfficialHost(new URL(input.canonical_url).hostname)
        ? "direct_official_url"
        : "direct_unofficial_url",
      sourceUrl: input.canonical_url,
      official: isOfficialHost(new URL(input.canonical_url).hostname),
      contentKind: "html",
    });
    return fetchOfficialSwissCaseFullText(
      {
        candidate: direct,
        requireOfficial: input.requireOfficial ?? true,
        requireFullText: input.requireFullText ?? true,
        chunk_index: input.chunk_index,
        chunk_token: input.chunk_token,
      },
      signal,
    );
  }
  if (reference) {
    const resolved = await resolveOfficialSwissCase({
      case_reference: reference,
      require_official_source: input.requireOfficial ?? true,
      require_full_text: input.requireFullText ?? true,
      retrieval_mode: "full_text",
    });
    return resolved.fetch ?? emptyIdentifierFetch(input, "source_not_found");
  }
  return emptyIdentifierFetch(input, "missing_identifier");
}

async function fetchFromHttpResponse(
  candidate: OfficialCaseCandidate,
  response: OfficialCaseHttpResponse,
  extraWarnings: readonly string[],
  chunk_index?: number,
  chunk_token?: string,
): Promise<FullTextFetchResult> {
  const originalBody = new Uint8Array(response.body);
  const isPdf = isPdfMime(response.mime_type) || hasPdfMagicBytes(originalBody);
  let decoded: string;
  const pdfWarnings: string[] = [];
  let pdfPages: readonly { pageNumber: number; text: string; textLength: number }[] = [];
  let physicalPageCount: number | null = null;
  if (isPdf) {
    try {
      const pdf = await extractPdfText(new Uint8Array(originalBody));
      decoded = pdf.text;
      pdfPages =
        pdf.pages ??
        Array.from({ length: pdf.pageCount }, (_, index) => ({
          pageNumber: index + 1,
          text: pdf.text,
          textLength: pdf.text.trim().length,
        }));
      physicalPageCount = pdf.pageCount;
      if (pdf.security.status === "safe_with_warnings") pdfWarnings.push(...pdf.security.warnings);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ...failedFetch(candidate, "unsupported_format", ["pdf_extraction_failed", message]),
        requested_url: response.requested_url,
        final_url: response.final_url,
        status_code: response.status_code,
        redirects: response.redirect_chain,
        response_headers: response.response_headers,
        mime_type: response.mime_type,
        content_length: response.content_length,
        bytes_received: response.bytes_received,
        network_transport: response.network_transport,
        mock_or_fixture: response.mock_or_fixture,
        severity: "warning",
      };
    }
  } else {
    decoded = decodeBytes(response.body, response.mime_type);
  }
  const synthetic = detectSyntheticContent(decoded, candidate);
  const warnings = [...extraWarnings, ...pdfWarnings, ...synthetic];
  const blockingWarning = warnings.some((warning) =>
    /synthetic_content_detected|fixture_content_detected_in_production|mock_transport_detected_in_production|fictional_official_url_rejected/i.test(
      warning,
    ),
  );
  if (blockingWarning) {
    return {
      ...failedFetch(candidate, "fetch_failed", warnings),
      requested_url: response.requested_url,
      final_url: response.final_url,
      status_code: response.status_code,
      redirects: response.redirect_chain,
      response_headers: response.response_headers,
      mime_type: response.mime_type,
      content_length: response.content_length,
      bytes_received: response.bytes_received,
      network_transport: response.network_transport,
      mock_or_fixture: response.mock_or_fixture,
      severity: "blocker",
    };
  }
  if (/rate limit|too many requests/i.test(decoded))
    return failedFetch(candidate, "rate_limited", ["rate_limited"]);
  if (isAccessRestrictionPage(decoded))
    return failedFetch(candidate, "access_restricted", ["access_restricted"]);
  if ((response.mime_type ?? "").includes("javascript"))
    return failedFetch(candidate, "unsupported_format", ["executable_content_rejected"]);
  if (response.bytes_received === 0)
    return failedFetchFromResponse(candidate, response, "empty_document", [
      "empty_response",
      "document_fetch_failed",
    ]);
  if (!response.retrieved_at || /^1970-01-01/.test(response.retrieved_at)) {
    return failedFetch(candidate, "fetch_failed", ["invalid_retrieved_at"]);
  }
  const content = decoded;
  if (content.length === 0)
    return failedFetchFromResponse(candidate, response, "empty_document", [
      "empty_response",
      "document_fetch_failed",
    ]);
  if (response.bytes_received > maxOfficialCaseResponseBytes)
    return failedFetch(candidate, "fetch_failed", ["response_too_large"]);
  const { sections, evidence: sectionDetectionEvidence } = extractSectionsWithEvidence(content);
  const htmlPages = isPdf ? [] : extractBgeHtmlPages(content);
  const pageMetrics = isPdf
    ? buildPdfPageMetrics(
        typeof physicalPageCount === "number"
          ? physicalPageCount
          : pdfPages.length > 0
            ? pdfPages.length
            : null,
        pdfPages,
      )
    : buildHtmlPageMetrics(htmlPages);
  const sectionEvidence = buildSectionEvidence(
    sections,
    isPdf ? pdfPages : htmlPages,
    sectionDetectionEvidence,
  );
  const language = detectDocumentLanguage(content, response.final_url, candidate.language);
  const hash = sha256Bytes(originalBody);
  const liveMetadata = extractLiveDocumentMetadata(content, response.final_url, candidate);
  const metadataHash = sha256(
    JSON.stringify({
      reference: liveMetadata.reference,
      decision_date: liveMetadata.decision_date,
      court_family: liveMetadata.court_family,
      title: liveMetadata.title,
      final_url: response.final_url,
    }),
  );
  const fullResult: FullTextFetchResult = {
    fetch_status: Object.keys(sections).length >= 3 ? "fetch_success" : "fetch_partial",
    source_url: candidate.source_url,
    requested_url: response.requested_url,
    final_url: response.final_url,
    status_code: response.status_code,
    redirects: response.redirect_chain,
    response_headers: response.response_headers,
    mime_type: response.mime_type,
    content_length: response.content_length,
    bytes_received: response.bytes_received,
    document_hash: hash,
    metadata_hash: metadataHash,
    network_transport: response.network_transport,
    mock_or_fixture: response.mock_or_fixture,
    severity: "info" as const,
    retrieved_at: response.retrieved_at,
    extractor_version: extractorVersion,
    source_version: hash.slice(0, 16),
    text: stripTags(content),
    sections,
    section_evidence: sectionEvidence,
    ...pageMetrics,
    requested_locale: extractRequestedLocale(response.final_url),
    portal_interface_language: extractPortalInterfaceLanguage(response.requested_url),
    document_language_detected: language.language,
    document_language_confidence: language.confidence,
    document_language_sources: language.sources,
    language_mismatch: language.mismatch,
    live_metadata: liveMetadata,
    published_citation: liveMetadata.published_citation ?? candidate.published_citation ?? null,
    case_reference: liveMetadata.case_reference ?? candidate.case_reference ?? null,
    official_docid: liveMetadata.official_docid ?? candidate.official_docid ?? null,
    publication_mapping_status:
      liveMetadata.publication_mapping_status ??
      candidate.publication_mapping_status ??
      "not_applicable",
    publication_mapping_confidence:
      liveMetadata.publication_mapping_confidence ??
      candidate.publication_mapping_confidence ??
      null,
    publication_mapping_evidence: [
      ...(candidate.publication_mapping_evidence ?? []),
      ...(liveMetadata.publication_mapping_evidence ?? []),
    ],
    primary_reference: liveMetadata.primary_reference ?? liveMetadata.reference,
    primary_reference_source: liveMetadata.primary_reference_source ?? null,
    cited_references: liveMetadata.cited_references ?? [],
    related_proceeding_references: liveMetadata.related_proceeding_references ?? [],
    reviewed_decision_references: liveMetadata.reviewed_decision_references ?? [],
    reference_extraction_confidence: liveMetadata.reference_extraction_confidence ?? 0,
    decision_date: liveMetadata.decision_date,
    decision_date_source: liveMetadata.decision_date_source ?? null,
    decision_date_confidence: liveMetadata.decision_date_confidence ?? 0,
    candidate_decision_date: candidate.decision_date,
    live_document_decision_date: liveMetadata.decision_date,
    date_mismatch:
      candidate.decision_date !== null &&
      liveMetadata.decision_date !== null &&
      candidate.decision_date !== liveMetadata.decision_date,
    response_body_type: isPdf ? "pdf" : response.bytes_received === 0 ? "empty" : "html",
    access_restrictions: [],
    parser_status: "parsed",
    warnings,
  };

  // Handle chunking for large documents
  if (
    (chunk_index !== undefined || chunk_token !== undefined) &&
    fullResult.text &&
    fullResult.text.length > maxOfficialCaseResponseBytes
  ) {
    const chunkSizeChars = Math.floor(maxOfficialCaseResponseBytes / 2); // rough chars per byte
    let actualChunkIndex = chunk_index !== undefined ? chunk_index : 0;
    if (chunk_token !== undefined) {
      try {
        actualChunkIndex = parseInt(chunk_token.split(":")[1] || "0", 10);
      } catch {
        actualChunkIndex = 0;
      }
    }
    const startPos = actualChunkIndex * chunkSizeChars;
    if (startPos >= fullResult.text.length) {
      // beyond end, return empty chunk with null text
      return {
        ...fullResult,
        text_chunk: null as string | null,
        chunk_index: actualChunkIndex,
        total_chunks: Math.ceil(fullResult.text.length / chunkSizeChars),
        next_chunk_token: null as string | null,
        is_chunked: true,
        text: "",
        content_length: 0,
        bytes_received: 0,
      };
    } else {
      const endPos = Math.min(startPos + chunkSizeChars, fullResult.text.length);
      const chunkText = fullResult.text.substring(startPos, endPos);
      return {
        ...fullResult,
        text_chunk: chunkText,
        chunk_index: actualChunkIndex,
        total_chunks: Math.ceil(fullResult.text.length / chunkSizeChars),
        next_chunk_token:
          endPos < fullResult.text.length
            ? `offset:${actualChunkIndex + 1}`
            : (null as string | null),
        is_chunked: true,
        text: chunkText,
        content_length: Buffer.byteLength(chunkText),
        bytes_received: Buffer.byteLength(chunkText),
      };
    }
  }

  return fullResult;
}

async function fetchOfficialCandidateBytes(
  candidate: OfficialCaseCandidate,
  signal?: AbortSignal,
): Promise<OfficialCaseHttpResponse> {
  if (candidate.source_adapter === "federal_administrative_court") {
    return fetchBvgerOfficialCandidateBytes(candidate, signal);
  }
  if (candidate.source_adapter === "federal_criminal_court") {
    return fetchBstgerOfficialCandidateBytes(candidate, signal);
  }
  if (candidate.source_adapter === "canton_appenzell_ausserrhoden") {
    return fetchArOfficialCandidateBytes(candidate, signal);
  }

  // For Swiss Federal Supreme Court, try official full-text endpoints first
  if (
    candidate.source_adapter === "swiss_federal_supreme_court" &&
    candidate.reference &&
    candidate.decision_date
  ) {
    // Try to fetch official full text from Bundesgericht endpoints
    const officialFullText = await fetchOfficialFullTextFromBger(
      candidate.reference,
      candidate.decision_date,
      candidate.language || "de",
      signal,
    );

    if (officialFullText) {
      return {
        status_code: officialFullText.status,
        final_url: officialFullText.finalUrl,
        body: officialFullText.body,
        mime_type: officialFullText.mimeType,
        content_length: officialFullText.body.length,
        bytes_received: officialFullText.body.length,
        network_transport: "live_http",
        mock_or_fixture: false,
        retrieved_at: new Date().toISOString(),
        requested_url: candidate.source_url,
        redirect_chain: officialFullText.redirectChain,
        response_headers: {},
      };
    }
    // If official full-text fails, fall through to existing logic
  }

  const first = await officialCaseHttpTransport(candidate.source_url, {}, signal);
  if (
    candidate.source_adapter === "swiss_federal_supreme_court" &&
    isBgerSearchUrl(first.final_url)
  ) {
    const searchText = decodeBytes(first.body, first.mime_type);
    const publishedMapping = findBgerPublishedDocumentMapping(searchText, candidate.reference);
    const documentUrl =
      publishedMapping?.document_url ?? findBgerExactDocumentUrl(searchText, candidate.reference);
    if (!documentUrl) {
      throw new Error("no_exact_official_document_link_found");
    }
    const second = await officialCaseHttpTransport(documentUrl, {}, signal);
    return {
      ...second,
      requested_url: candidate.source_url,
      redirect_chain: [...first.redirect_chain, first.final_url, ...second.redirect_chain],
    };
  }
  return first;
}

async function fetchBvgerOfficialCandidateBytes(
  candidate: OfficialCaseCandidate,
  signal?: AbortSignal,
): Promise<OfficialCaseHttpResponse> {
  const reference = candidate.reference;
  if (!reference) throw new Error("bvger_missing_reference");
  const searchUrl = makeBvgerSearchApiUrl();
  const searchBody = JSON.stringify(makeBvgerSearchRequestBody(reference));
  const search = await officialCaseHttpTransport(
    searchUrl,
    {
      method: "POST",
      body: searchBody,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    },
    signal,
  );
  const parsed = parseBvgerSearchResponse(decodeBytes(search.body, search.mime_type));
  const exact = findBvgerExactSearchResult(parsed.documents, reference);
  if (!exact) {
    if (parsed.parseFailure)
      throw new Error(`bvger_search_response_unparseable:${parsed.parseFailure}`);
    if (parsed.documents.length === 0) throw new Error("portal_accessible_no_result");
    throw new Error("candidate_not_found");
  }
  const pdfUrl = new URL(exact.originalUrl, "https://bvger.weblaw.ch").toString();
  if (!isAllowedCandidateUrl(pdfUrl)) throw new Error("network_policy_blocked");
  const document = await officialCaseHttpTransport(
    pdfUrl,
    {
      headers: {
        Accept: "application/pdf,text/html;q=0.9,*/*;q=0.1",
      },
    },
    signal,
  );
  return {
    ...document,
    requested_url: candidate.source_url,
    redirect_chain: [...search.redirect_chain, search.final_url, ...document.redirect_chain],
  };
}

async function fetchBstgerOfficialCandidateBytes(
  candidate: OfficialCaseCandidate,
  signal?: AbortSignal,
): Promise<OfficialCaseHttpResponse> {
  const reference = candidate.reference;
  if (!reference) throw new Error("bstger_missing_reference");
  const searchUrl = makeBstgerSearchApiUrl();
  const searchBody = JSON.stringify(makeBstgerSearchRequestBody(reference));
  const search = await officialCaseHttpTransport(
    searchUrl,
    {
      method: "POST",
      body: searchBody,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    },
    signal,
  );
  const parsed = parseBstgerSearchResponse(decodeBytes(search.body, search.mime_type));
  const exact = findBstgerExactSearchResult(parsed.documents, reference);
  if (!exact) {
    if (parsed.parseFailure)
      throw new Error(`bstger_search_response_unparseable:${parsed.parseFailure}`);
    if (parsed.documents.length === 0) throw new Error("portal_accessible_no_result");
    throw new Error("candidate_not_found");
  }
  const documentUrl = makeBstgerDocumentFileUrl(exact.leid, exact.language ?? "de");
  if (!isAllowedCandidateUrl(documentUrl)) throw new Error("network_policy_blocked");
  const document = await officialCaseHttpTransport(
    documentUrl,
    {
      method: "POST",
      body: JSON.stringify({ documentTitle: exact.fileName }),
      headers: {
        Accept: "application/pdf,text/html;q=0.9,*/*;q=0.1",
        "Content-Type": "application/json",
      },
    },
    signal,
  );
  return {
    ...document,
    requested_url: candidate.source_url,
    redirect_chain: [...search.redirect_chain, search.final_url, ...document.redirect_chain],
  };
}

async function fetchArOfficialCandidateBytes(
  candidate: OfficialCaseCandidate,
  signal?: AbortSignal,
): Promise<OfficialCaseHttpResponse> {
  const reference = candidate.reference;
  if (!reference) throw new Error("ar_missing_reference");
  const searchUrl = makeArSearchApiUrl();
  const searchBody = JSON.stringify(makeArSearchRequestBody(reference));
  const search = await officialCaseHttpTransport(
    searchUrl,
    {
      method: "POST",
      body: searchBody,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    },
    signal,
  );
  const parsed = parseArSearchResponse(decodeBytes(search.body, search.mime_type));
  const exact = findArExactSearchResult(parsed.documents, reference);
  if (!exact) {
    if (parsed.parseFailure)
      throw new Error(`ar_search_response_unparseable:${parsed.parseFailure}`);
    if (parsed.documents.length === 0) throw new Error("portal_accessible_no_result");
    throw new Error("candidate_not_found");
  }
  const documentUrl = exact.originalUrl;
  if (!isAllowedCandidateUrl(documentUrl)) throw new Error("network_policy_blocked");
  const document = await officialCaseHttpTransport(
    documentUrl,
    {
      headers: {
        Accept: "application/pdf,text/html;q=0.9,*/*;q=0.1",
      },
    },
    signal,
  );
  return {
    ...document,
    requested_url: candidate.source_url,
    redirect_chain: [...search.redirect_chain, search.final_url, ...document.redirect_chain],
  };
}

function isBgerSearchUrl(raw: string): boolean {
  const url = safeUrl(raw);
  const type = url?.searchParams.get("type");
  return (
    url?.hostname.endsWith("bger.ch") === true && (type === "search" || type === "simple_query")
  );
}

function findBgerExactDocumentUrl(html: string, reference: string | null): string | null {
  const publishedMapping = findBgerPublishedDocumentMapping(html, reference);
  if (publishedMapping) return publishedMapping.document_url;
  if (!reference) return null;
  const docIdVariants = bgerDocIdVariants(reference);
  const hrefs = [
    ...html.matchAll(/href=["']([^"']*(?:type=show_document|highlight_docid)[^"']+)["']/gi),
  ]
    .map((match) => decodeHtmlAttribute(match[1] ?? ""))
    .map((href) => href.replaceAll("&amp;", "&"))
    .map((href) => safeDecodeUriComponent(href));
  const exact = hrefs.find((href) => docIdVariants.some((variant) => href.includes(variant)));
  if (!exact) return null;
  return new URL(exact, "https://search.bger.ch").toString();
}

function bgerDocIdVariants(reference: string): readonly string[] {
  const trimmed = reference.trim();
  return [
    trimmed.replace("/", "-"),
    trimmed.replace(/[._/]/g, "-"),
    trimmed.replace(".", "_").replace("/", "-"),
  ];
}

interface BgerPublishedDocumentMapping {
  readonly published_citation: string;
  readonly case_reference: string | null;
  readonly official_docid: string;
  readonly document_url: string;
  readonly decision_date: string | null;
  readonly evidence: readonly string[];
  readonly confidence: number;
}

function findBgerPublishedDocumentMapping(
  html: string,
  reference: string | null,
): BgerPublishedDocumentMapping | null {
  const parts = parsePublishedBgerCitation(reference);
  if (!parts) return null;
  const canonicalCitation = `BGE ${parts.volume} ${parts.division} ${parts.page}`;
  const docid = `atf://${parts.volume}-${parts.division}-${parts.page}:de`;
  const encodedDocid = encodeURIComponent(docid);
  const hrefs = [
    ...html.matchAll(
      /href=["']([^"']*(?:type=highlight_simple_query|type=show_document)[^"']+)["']/gi,
    ),
  ]
    .map((match) => decodeHtmlAttribute(match[1] ?? ""))
    .map((href) => href.replaceAll("&amp;", "&"))
    .map((href) => safeDecodeUriComponent(href));
  const exactHref = hrefs.find((href) => href.includes(docid) || href.includes(encodedDocid));
  if (!exactHref) return null;
  const documentUrl = makeBgerPublishedDocumentUrl(docid);
  const plain = stripTags(html).replace(/\s+/g, " ");
  const citationIndex = plain.indexOf(`${parts.volume} ${parts.division} ${parts.page}`);
  const windowText =
    citationIndex >= 0
      ? plain.slice(citationIndex, Math.min(plain.length, citationIndex + 1200))
      : plain;
  const caseReference = extractBgerCaseReference(windowText);
  const decisionDate = extractSwissLongDate(windowText);
  return {
    published_citation: canonicalCitation,
    case_reference: caseReference,
    official_docid: docid,
    document_url: documentUrl,
    decision_date: decisionDate,
    evidence: [
      "official_bger_clir_search_result",
      `matched_docid:${docid}`,
      ...(caseReference ? [`case_reference:${caseReference}`] : []),
      ...(decisionDate ? [`decision_date:${decisionDate}`] : []),
    ],
    confidence: caseReference ? 0.98 : 0.9,
  };
}

function makeBgerPublishedDocumentUrl(docid: string): string {
  const url = new URL("https://search.bger.ch/ext/eurospider/live/de/php/clir/http/index.php");
  url.searchParams.set("lang", "de");
  url.searchParams.set("type", "show_document");
  url.searchParams.set("highlight_docid", docid);
  return url.toString();
}

function parsePublishedBgerCitation(reference: string | null): {
  readonly volume: string;
  readonly division: string;
  readonly page: string;
} | null {
  if (!reference) return null;
  const match = /^(?:BGE|ATF|DTF)?\s*(\d+)\s+([IVX]+)\s+(\d+)$/i.exec(
    reference.replace(/\s+/g, " ").trim(),
  );
  if (!match) return null;
  return {
    volume: match[1]!,
    division: match[2]!.toUpperCase(),
    page: match[3]!,
  };
}

function extractBgerCaseReference(text: string): string | null {
  const modern = /\b\d+[A-Z]_\d+\/(?:19|20)\d{2}\b/i.exec(text)?.[0] ?? null;
  if (modern) return normalizeLiveBgerReference(modern);
  const legacy = /\b\d+[A-Z]\.\d+\/(?:19|20)\d{2}\b/i.exec(text)?.[0] ?? null;
  return legacy ? normalizeLiveBgerReference(legacy) : null;
}

interface BvgerSearchDocument {
  readonly leid: string;
  readonly title: readonly string[];
  readonly originalUrl: string;
  readonly language: string | null;
  readonly rulingDate: string | null;
}

function makeBvgerSearchApiUrl(): string {
  return "https://bvger.weblaw.ch/api/.netlify/functions/searchQueryService";
}

function makeBvgerDashboardUrl(reference: string): string {
  const url = new URL("https://bvger.weblaw.ch/dashboard");
  url.searchParams.set("guiLanguage", "de");
  url.searchParams.set("sort-field", "relevance");
  url.searchParams.set("sort-direction", "relevance");
  url.searchParams.set("searchTerm", reference);
  return url.toString();
}

function makeBvgerSearchRequestBody(reference: string): Record<string, unknown> {
  return {
    queryString: reference,
    guiLanguage: "de",
    aggs: {
      fields: [
        "panel",
        "language",
        "rulingType",
        "subject",
        "bvgeKeywords",
        "bvgeStandards",
        "jud-ch-bund-bvgeList",
        "jud-ch-bund-bvgerList",
        "ch-jurivocList",
        "year",
        "lex-ch-bund-srList",
        "srCategoryList",
        "jud-ch-bund-bgeList",
        "jud-ch-bund-bguList",
        "jud-ch-bund-tpfList",
        "jud-ch-bund-bstgerList",
        "lex-ch-bund-asList",
        "lex-ch-bund-bblList",
        "lex-ch-bund-abList",
      ],
      size: 10,
    },
  };
}

function parseBvgerSearchResponse(raw: string): {
  readonly documents: readonly BvgerSearchDocument[];
  readonly parseFailure: string | null;
} {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed["documents"])) {
      return { documents: [], parseFailure: "search_response_missing_documents" };
    }
    const documents = parsed["documents"].flatMap((document): BvgerSearchDocument[] => {
      if (!isRecord(document)) return [];
      const meta = recordProperty(document, "metadataKeywordTextMap") ?? {};
      const dateMap = recordProperty(document, "metadataDateMap") ?? {};
      const leid =
        firstString(stringArrayProperty(meta, "leid")) ??
        (typeof document["leid"] === "string" ? document["leid"] : null);
      const originalUrl = firstString(stringArrayProperty(meta, "originalUrl"));
      const title = stringArrayProperty(meta, "title") ?? [];
      if (!leid || !originalUrl || title.length === 0) return [];
      return [
        {
          leid,
          title,
          originalUrl,
          language: firstString(stringArrayProperty(meta, "language")),
          rulingDate: isoDateOnly(
            typeof dateMap["rulingDate"] === "string" ? dateMap["rulingDate"] : null,
          ),
        },
      ];
    });
    return { documents, parseFailure: null };
  } catch (error) {
    return {
      documents: [],
      parseFailure: error instanceof Error ? error.message : String(error),
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordProperty(
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const value = record[key];
  return isRecord(value) ? value : null;
}

function stringArrayProperty(
  record: Record<string, unknown>,
  key: string,
): readonly string[] | undefined {
  const value = record[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

function findBvgerExactSearchResult(
  documents: readonly BvgerSearchDocument[],
  reference: string,
): BvgerSearchDocument | null {
  const normalized = normalizeBvgerComparableReference(reference);
  const exact = documents.filter((document) => {
    const titles = document.title.map((title) =>
      normalizeBvgerComparableReference(stripTags(decodeHtmlAttribute(title))),
    );
    const fileReference = normalizeBvgerComparableReference(path.basename(document.originalUrl));
    return titles.includes(normalized) || fileReference === normalized;
  });
  const uniqueByLeid = new Map(exact.map((document) => [document.leid, document]));
  return uniqueByLeid.size === 1 ? [...uniqueByLeid.values()][0]! : null;
}

function normalizeBvgerComparableReference(value: string): string {
  const plain = value
    .replaceAll("&#x2F;", "/")
    .replace(/TAF|BVGer/gi, "")
    .replace(/_web\.pdf$/i, "")
    .replace(/\.pdf$/i, "")
    .replace(/_\d{4}-\d{2}-\d{2}_.+$/i, "")
    .replace(/[^A-Z0-9/-]/gi, "")
    .toUpperCase();
  const match = /^([A-Z])[-_]?0*(\d+)[/-]?(\d{4})/.exec(plain.replace("-", ""));
  if (match) return `${match[1]}-${Number(match[2])}/${match[3]}`;
  const dashed = /^([A-Z])-0*(\d+)\/(\d{4})/.exec(plain);
  return dashed ? `${dashed[1]}-${Number(dashed[2])}/${dashed[3]}` : plain;
}

function firstString(values: readonly string[] | undefined): string | null {
  return values?.find((value) => typeof value === "string") ?? null;
}

function isoDateOnly(value: string | null): string | null {
  return value?.slice(0, 10) ?? null;
}

interface BstgerSearchDocument {
  readonly leid: string;
  readonly title: readonly string[];
  readonly fileName: string;
  readonly court: string | null;
  readonly language: "de" | "fr" | "it" | null;
  readonly rulingDate: string | null;
}

function makeBstgerSearchApiUrl(): string {
  return "https://bstger.weblaw.ch/api/getDocuments?withAggregations=true";
}

function makeBstgerDashboardUrl(reference: string): string {
  const url = new URL("https://bstger.weblaw.ch/");
  url.searchParams.set("guiLanguage", "de");
  url.searchParams.set("sort-field", "relevance");
  url.searchParams.set("sort-direction", "relevance");
  url.searchParams.set("searchTerm", reference);
  return url.toString();
}

function makeBstgerDocumentFileUrl(leid: string, language: string): string {
  const url = new URL(`https://bstger.weblaw.ch/api/getDocumentFile/${encodeURIComponent(leid)}`);
  url.searchParams.set("locale", ["de", "fr", "it"].includes(language) ? language : "de");
  url.searchParams.set("userID", "");
  return url.toString();
}

function makeBstgerSearchRequestBody(reference: string): Record<string, unknown> {
  return {
    guiLanguage: "de",
    queryString: reference,
    from: 0,
    aggs: {
      fields: [],
      size: 10,
    },
  };
}

function parseBstgerSearchResponse(raw: string): {
  readonly documents: readonly BstgerSearchDocument[];
  readonly parseFailure: string | null;
} {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { documents: [], parseFailure: "search_response_not_object" };
    const data = recordProperty(parsed, "data");
    if (!data) return { documents: [], parseFailure: "search_response_missing_data" };
    if (typeof data["status"] === "number" && data["status"] >= 400) {
      return {
        documents: [],
        parseFailure:
          typeof data["detail"] === "string" ? data["detail"] : "search_endpoint_invalid",
      };
    }
    if (!Array.isArray(data["documents"])) {
      return { documents: [], parseFailure: "search_response_missing_documents" };
    }
    const documents = data["documents"].flatMap((document): BstgerSearchDocument[] => {
      if (!isRecord(document)) return [];
      const leid = typeof document["leid"] === "string" ? document["leid"] : null;
      const meta = recordProperty(document, "metadataKeywordTextMap") ?? {};
      const dates = recordProperty(document, "metadataDateMap") ?? {};
      const title = stringArrayProperty(meta, "title") ?? [];
      const fileName = firstString(stringArrayProperty(meta, "fileName"));
      if (!leid || !fileName || title.length === 0) return [];
      const language = firstString(stringArrayProperty(meta, "language"));
      return [
        {
          leid,
          title,
          fileName: stripTags(decodeHtmlAttribute(fileName)).replace(/\s+/g, ""),
          court: firstString(stringArrayProperty(meta, "court")),
          language: language === "de" || language === "fr" || language === "it" ? language : null,
          rulingDate: isoDateOnly(
            typeof dates["rulingDate"] === "string" ? dates["rulingDate"] : null,
          ),
        },
      ];
    });
    return { documents, parseFailure: null };
  } catch (error) {
    return {
      documents: [],
      parseFailure: error instanceof Error ? error.message : String(error),
    };
  }
}

function findBstgerExactSearchResult(
  documents: readonly BstgerSearchDocument[],
  reference: string,
): BstgerSearchDocument | null {
  const normalized = normalizeBstgerComparableReference(reference);
  const exact = documents.filter((document) => {
    const titles = document.title.map((title) =>
      normalizeBstgerComparableReference(stripTags(decodeHtmlAttribute(title))),
    );
    const fileReference = normalizeBstgerComparableReference(document.fileName);
    return titles.includes(normalized) || fileReference === normalized;
  });
  const uniqueByLeid = new Map(exact.map((document) => [document.leid, document]));
  return uniqueByLeid.size === 1 ? [...uniqueByLeid.values()][0]! : null;
}

function normalizeBstgerComparableReference(value: string): string {
  const plain = stripTags(decodeHtmlAttribute(value))
    .replace(/\.pdf$/i, "")
    .replace(/^\d{8}_/i, "")
    .replace(/_/g, ".")
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.]/gi, "")
    .toUpperCase();
  const match = /^([A-Z]{1,3})\.?0*(\d{4})\.?0*(\d+[A-Z]?)/.exec(plain);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : plain;
}

interface ArSearchDocument {
  readonly leid: string;
  readonly title: readonly string[];
  readonly fileName: string;
  readonly originalUrl: string;
  readonly court: string | null;
  readonly category: string | null;
  readonly decisionDate: string | null;
  readonly publicationDate: string | null;
}

function makeArSearchApiUrl(): string {
  return "https://rechtsprechung.ar.ch/api/.netlify/functions/searchQueryService";
}

function makeArDashboardUrl(reference: string): string {
  const url = new URL("https://rechtsprechung.ar.ch/");
  url.searchParams.set("guiLanguage", "de");
  url.searchParams.set("sort-field", "relevance");
  url.searchParams.set("sort-direction", "relevance");
  url.searchParams.set("searchTerm", reference);
  return url.toString();
}

function makeArSearchRequestBody(reference: string): Record<string, unknown> {
  return {
    queryString: reference,
    guiLanguage: "de",
    aggs: {
      fields: [
        "treePath",
        "decisionDate",
        "publicationDate",
        "entscheidKategorie",
        "argvpBehoerde",
        "gvpNumber",
        "pubYearGvp",
      ],
      size: 10,
    },
  };
}

function parseArSearchResponse(raw: string): {
  readonly documents: readonly ArSearchDocument[];
  readonly parseFailure: string | null;
} {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { documents: [], parseFailure: "search_response_not_object" };
    if (!Array.isArray(parsed["documents"])) {
      return { documents: [], parseFailure: "search_response_missing_documents" };
    }
    const documents = parsed["documents"].flatMap((document): ArSearchDocument[] => {
      if (!isRecord(document)) return [];
      const meta = recordProperty(document, "metadataKeywordTextMap") ?? {};
      const dates = recordProperty(document, "metadataDateMap") ?? {};
      const leid =
        typeof document["leid"] === "string"
          ? document["leid"]
          : firstString(stringArrayProperty(meta, "leid"));
      const title = stringArrayProperty(meta, "title") ?? [];
      const fileName = firstString(stringArrayProperty(meta, "fileName"));
      const originalUrl = firstString(stringArrayProperty(meta, "originalUrl"));
      if (!leid || title.length === 0 || !fileName || !originalUrl) return [];
      return [
        {
          leid,
          title,
          fileName: stripTags(decodeHtmlAttribute(fileName)).replace(/\s+/g, ""),
          originalUrl,
          court: firstString(stringArrayProperty(meta, "argvpBehoerde")),
          category: firstString(stringArrayProperty(meta, "entscheidKategorie")),
          decisionDate: isoDateOnly(
            typeof dates["decisionDate"] === "string" ? dates["decisionDate"] : null,
          ),
          publicationDate: isoDateOnly(
            typeof dates["publicationDate"] === "string" ? dates["publicationDate"] : null,
          ),
        },
      ];
    });
    return { documents, parseFailure: null };
  } catch (error) {
    return {
      documents: [],
      parseFailure: error instanceof Error ? error.message : String(error),
    };
  }
}

function findArExactSearchResult(
  documents: readonly ArSearchDocument[],
  reference: string,
): ArSearchDocument | null {
  const normalized = normalizeArComparableReference(reference);
  const exact = documents.filter((document) => {
    const titles = document.title.map((title) =>
      normalizeArComparableReference(stripTags(decodeHtmlAttribute(title))),
    );
    const fileReference = normalizeArComparableReference(document.fileName);
    const isArOfficial =
      safeUrl(document.originalUrl)?.hostname === "rechtsprechung.ar.ch" &&
      document.originalUrl.includes("/download/");
    return isArOfficial && (titles.includes(normalized) || fileReference === normalized);
  });
  const uniqueByLeid = new Map(exact.map((document) => [document.leid, document]));
  return uniqueByLeid.size === 1 ? [...uniqueByLeid.values()][0]! : null;
}

function normalizeArComparableReference(value: string): string {
  const plain = stripTags(decodeHtmlAttribute(value))
    .replace(/\.pdf$/i, "")
    .replace(/^OG-\d{8}-/i, "")
    .replace(/-\d{8}(?:-ARGVP-\d{4}-\d+)?$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^OG\s+/i, "")
    .trim()
    .toUpperCase();
  const match = /^([A-Z][0-9][A-Z]|AB)\s+0*(\d{2})\s+0*(\d{1,4})$/.exec(plain);
  return match ? `${match[1]} ${match[2]} ${Number(match[3])}` : plain;
}

function buildPdfPageMetrics(
  physicalPageCount: number | null,
  pages: readonly { pageNumber: number; text: string; textLength: number }[],
): Pick<
  FullTextFetchResult,
  | "physical_page_count"
  | "extracted_page_count"
  | "pages_with_text"
  | "pages_without_text"
  | "pages_failed"
  | "physical_page_coverage"
  | "extraction_page_coverage"
  | "document_unit_count"
  | "scanned_document_detected"
  | "ocr_required"
  | "ocr_performed"
  | "ocr_language"
  | "ocr_confidence"
  | "pages_requiring_ocr"
> {
  if (physicalPageCount == null) {
    return {
      physical_page_count: null,
      extracted_page_count: null,
      pages_with_text: [],
      pages_without_text: [],
      pages_failed: [],
      physical_page_coverage: null,
      extraction_page_coverage: null,
      document_unit_count: undefined,
      scanned_document_detected: false,
      ocr_required: false,
      ocr_performed: false,
      ocr_language: null,
      ocr_confidence: null,
      pages_requiring_ocr: [],
    };
  }
  const pageNumbers = Array.from({ length: physicalPageCount }, (_, index) => index + 1);
  const textByPage = new Map(pages.map((page) => [page.pageNumber, page.textLength]));
  const pagesWithText = pageNumbers.filter((page) => (textByPage.get(page) ?? 0) >= 20);
  const pagesWithoutText = pageNumbers.filter((page) => (textByPage.get(page) ?? 0) < 20);
  const extractedPageCount = pages.length;
  const pagesFailed = pageNumbers.filter((page) => !textByPage.has(page));
  const pagesRequiringOcr = [...new Set([...pagesWithoutText, ...pagesFailed])].sort(
    (a, b) => a - b,
  );
  const physicalCoverage =
    physicalPageCount > 0 ? Number((pagesWithText.length / physicalPageCount).toFixed(2)) : null;
  const extractionCoverage =
    physicalPageCount > 0 ? Number((extractedPageCount / physicalPageCount).toFixed(2)) : null;
  return {
    physical_page_count: physicalPageCount,
    extracted_page_count: extractedPageCount,
    pages_with_text: pagesWithText,
    pages_without_text: pagesWithoutText,
    pages_failed: pagesFailed,
    physical_page_coverage: physicalCoverage,
    extraction_page_coverage: extractionCoverage,
    document_unit_count: undefined,
    scanned_document_detected: pagesRequiringOcr.length > 0,
    ocr_required: pagesRequiringOcr.length > 0,
    ocr_performed: false,
    ocr_language: null,
    ocr_confidence: null,
    pages_requiring_ocr: pagesRequiringOcr,
  };
}

function buildHtmlPageMetrics(
  pages: readonly { pageNumber: number; text: string; textLength: number }[] = [],
): Pick<
  FullTextFetchResult,
  | "physical_page_count"
  | "extracted_page_count"
  | "pages_with_text"
  | "pages_without_text"
  | "pages_failed"
  | "physical_page_coverage"
  | "extraction_page_coverage"
  | "document_unit_count"
  | "scanned_document_detected"
  | "ocr_required"
  | "ocr_performed"
  | "ocr_language"
  | "ocr_confidence"
  | "pages_requiring_ocr"
> {
  if (pages.length > 0) {
    const pageNumbers = pages.map((page) => page.pageNumber);
    return {
      physical_page_count: pages.length,
      extracted_page_count: pages.length,
      pages_with_text: pageNumbers,
      pages_without_text: [],
      pages_failed: [],
      physical_page_coverage: 1,
      extraction_page_coverage: 1,
      document_unit_count: pages.length,
      scanned_document_detected: false,
      ocr_required: false,
      ocr_performed: false,
      ocr_language: null,
      ocr_confidence: null,
      pages_requiring_ocr: [],
    };
  }
  return {
    physical_page_count: null,
    extracted_page_count: null,
    pages_with_text: [],
    pages_without_text: [],
    pages_failed: [],
    physical_page_coverage: null,
    extraction_page_coverage: null,
    document_unit_count: 1,
    scanned_document_detected: false,
    ocr_required: false,
    ocr_performed: false,
    ocr_language: null,
    ocr_confidence: null,
    pages_requiring_ocr: [],
  };
}

function extractBgeHtmlPages(
  html: string,
): readonly { pageNumber: number; text: string; textLength: number }[] {
  const markerPattern = /<a\s+name=["']page(\d+)["'][^>]*><\/a>/gi;
  const markers = [...html.matchAll(markerPattern)].map((match) => ({
    pageNumber: Number(match[1]),
    index: match.index ?? 0,
  }));
  if (markers.length === 0) return [];
  return markers.map((marker, index) => {
    const next = markers[index + 1]?.index ?? html.length;
    const chunk = stripTags(html.slice(marker.index, next)).replace(/\s+/g, " ").trim();
    return {
      pageNumber: marker.pageNumber,
      text: chunk,
      textLength: chunk.length,
    };
  });
}

function buildSectionEvidence(
  sections: Record<string, string>,
  pages: readonly { pageNumber: number; text: string; textLength: number }[],
  detectionEvidence?: Record<string, SectionDetectionInfo>,
): readonly SectionEvidence[] {
  const joined = pages.map((page) => page.text).join("\n");
  const pageOffsets: { pageNumber: number; start: number; end: number }[] = [];
  let cursor = 0;
  for (const page of pages) {
    const start = cursor;
    const end = start + page.text.length;
    pageOffsets.push({ pageNumber: page.pageNumber, start, end });
    cursor = end + 1;
  }
  return Object.entries(sections).map(([sectionId, text]) => {
    const needle = text.trim().slice(0, Math.min(120, text.length));
    const startIndex = needle ? joined.indexOf(needle) : -1;
    const endIndex = startIndex >= 0 ? startIndex + text.length : -1;
    const pageNumbers =
      startIndex >= 0
        ? pageOffsets
            .filter((page) => page.end >= startIndex && page.start <= endIndex)
            .map((page) => page.pageNumber)
        : guessSectionPagesByNormalizedText(text, pages);
    const detection = detectionEvidence?.[sectionId] ?? null;
    return {
      section_id: sectionId,
      heading: sectionId,
      // No real physical page marker matched this section (either because the document has no
      // page markers at all, e.g. unpaginated HTML, or because the match/guess failed even
      // though pages exist elsewhere in the document): report null, never a fabricated "page 1".
      page_start: pageNumbers.length > 0 ? Math.min(...pageNumbers) : null,
      page_end: pageNumbers.length > 0 ? Math.max(...pageNumbers) : null,
      text_hash: sha256(text),
      extraction_status: text.trim().length > 0 ? "extracted" : "missing",
      detected_language: detection?.detected_language ?? null,
      // Sin evidencia de deteccion disponible (llamadores que aun pasan un
      // `Record<string,string>` plano en vez del resultado de
      // `extractSectionsWithEvidence`): se reporta `text_pattern` como el
      // metodo mas conservador (nunca se afirma `heading`/`dom` sin
      // evidencia real de ello).
      detection_method: detection?.detection_method ?? "text_pattern",
    };
  });
}

function guessSectionPagesByNormalizedText(
  sectionText: string,
  pages: readonly { pageNumber: number; text: string; textLength: number }[],
): readonly number[] {
  const section = sectionText.replace(/\s+/g, " ").trim();
  if (!section || pages.length === 0) return [];
  const probes = [
    section.slice(0, 80),
    section.slice(
      Math.max(0, Math.floor(section.length / 2) - 40),
      Math.floor(section.length / 2) + 40,
    ),
    section.slice(Math.max(0, section.length - 80)),
  ].filter((probe) => probe.trim().length >= 20);
  return pages
    .filter((page) => {
      const pageText = page.text.replace(/\s+/g, " ");
      return probes.some((probe) => pageText.includes(probe));
    })
    .map((page) => page.pageNumber);
}

function detectDocumentLanguage(
  content: string,
  finalUrl: string,
  candidateLanguage: "de" | "fr" | "it" | null,
): {
  readonly language: "de" | "fr" | "it" | null;
  readonly confidence: number;
  readonly sources: readonly string[];
  readonly mismatch: boolean;
} {
  const text = stripTags(content).toLowerCase();
  const scores = {
    de: countMatches(
      text,
      /\b(urteil|entscheid|erwägungen|sachverhalt|beschwerde|gerichtskosten|demnach erkennt|obergericht|bundesgericht)\b/g,
    ),
    fr: countMatches(
      text,
      /\b(arrêt|jugement|considérant|faits|recours|frais judiciaires|la cour prononce|tribunal fédéral)\b/g,
    ),
    it: countMatches(
      text,
      /\b(sentenza|decisione|considerandi|fatti|ricorso|spese giudiziarie|tribunale federale)\b/g,
    ),
  };
  const entries = Object.entries(scores) as ["de" | "fr" | "it", number][];
  const [language, score] = entries.sort((a, b) => b[1] - a[1])[0]!;
  const detected = score > 0 ? language : null;
  const requested = extractRequestedLocale(finalUrl);
  const sources = [
    ...(detected ? ["content_dominant_terms"] : []),
    ...(candidateLanguage ? ["official_search_result_metadata"] : []),
    ...(requested ? ["url_locale"] : []),
  ];
  return {
    language: detected,
    confidence: detected ? Math.min(0.99, Number((0.55 + score / 20).toFixed(2))) : 0,
    sources,
    mismatch: Boolean(requested && detected && requested !== detected),
  };
}

function countMatches(text: string, pattern: RegExp): number {
  return Array.from(text.matchAll(pattern)).length;
}

function extractRequestedLocale(raw: string): string | null {
  const url = safeUrl(raw);
  return url?.searchParams.get("locale") ?? url?.searchParams.get("lang") ?? null;
}

function extractPortalInterfaceLanguage(raw: string): string | null {
  const url = safeUrl(raw);
  return url?.searchParams.get("guiLanguage") ?? url?.searchParams.get("lang") ?? null;
}

function safeDecodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function decodeBytes(bytes: Uint8Array, mimeType: string | null): string {
  const type = mimeType ?? "";
  if (/charset=iso-8859-1/i.test(type)) return new TextDecoder("latin1").decode(bytes);
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function isPdfMime(mimeType: string | null): boolean {
  return /^application\/pdf\b/i.test(mimeType ?? "");
}

function hasPdfMagicBytes(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 5 && new TextDecoder("latin1").decode(bytes.slice(0, 5)) === "%PDF-";
}

function isAccessRestrictionPage(content: string): boolean {
  const text = stripTags(content).toLowerCase();
  return (
    /\b(captcha|challenge page|security challenge|bot challenge)\b/i.test(text) ||
    /\blogin required\b/i.test(text) ||
    (/\b(login|sign in|password|passwort|anmelden)\b/i.test(text) &&
      /\b(unauthorized|forbidden|access denied|zugriff verweigert|authentifizierung|authentication)\b/i.test(
        text,
      ))
  );
}

function detectSyntheticContent(
  content: string,
  candidate: OfficialCaseCandidate,
): readonly string[] {
  const warnings: string[] = [];
  if (/Synthetic official|synthetic_content|mock|fixture/i.test(content)) {
    warnings.push("synthetic_content_detected");
  }
  if (/fixture/i.test(candidate.source) || /fixture/i.test(candidate.source_url)) {
    warnings.push("fixture_content_detected_in_production");
  }
  if (candidate.official && candidate.source_url.includes("/case/")) {
    warnings.push("fictional_official_url_rejected");
  }
  return [...new Set(warnings)];
}

function extractLiveDocumentMetadata(
  content: string,
  finalUrl: string,
  candidate?: OfficialCaseCandidate,
): LiveDocumentMetadata {
  const text = stripTags(content).replace(/\s+/g, " ").trim();
  const metadataText = collapsePdfLetterSpacing(text);
  const hostFamily = inferCourtFamilyFromHost(safeUrl(finalUrl)?.hostname ?? "");
  const looksBvger =
    hostFamily === "federal_administrative_court" ||
    /Bundesverwaltungsgericht|Tribunal administratif fédéral|Tribunale amministrativo federale|Tribunal administrativ federal/i.test(
      metadataText,
    );
  const looksBstger =
    hostFamily === "federal_criminal_court" ||
    /Bundesstrafgericht|Tribunal pénal fédéral|Tribunale penale federale|Tribunal penal federal/i.test(
      metadataText,
    );
  const looksAr =
    hostFamily === "cantonal_court" &&
    /Obergericht Appenzell Ausserrhoden|Kantonsgericht Appenzell Ausserrhoden|Appenzell Ausserrhoden/i.test(
      metadataText,
    );
  const headerText = metadataText.slice(0, Math.min(metadataText.length, 2500));
  const bodyReferences = extractAllCaseReferences(metadataText);
  const headerReferences = extractAllCaseReferences(headerText);
  const primary = selectPrimaryReference({
    finalUrl,
    candidate,
    headerText,
    headerReferences,
    bodyReferences,
    courtFamily: candidate?.court_family ?? hostFamily,
    looksAr,
    looksBstger,
    looksBvger,
  });
  const publishedMapping = extractBgerPublishedMetadata(metadataText, finalUrl, candidate);
  const reference = primary.reference;
  const dateSelection = selectDecisionDate({
    metadataText,
    finalUrl,
    candidate,
    looksAr,
    looksBstger,
    looksBvger,
  });
  const courtFamily =
    hostFamily !== "unknown"
      ? hostFamily
      : /Obergericht Appenzell Ausserrhoden|Kantonsgericht Appenzell Ausserrhoden/i.test(text)
        ? "cantonal_court"
        : /Bundesstrafgericht|Tribunal pénal fédéral|Tribunale penale federale|Tribunal penal federal/i.test(
              text,
            )
          ? "federal_criminal_court"
          : /Bundesverwaltungsgericht|Tribunal administratif fédéral|Tribunale amministrativo federale|Tribunal administrativ federal/i.test(
                text,
              )
            ? "federal_administrative_court"
            : /Bundesgericht|Tribunal fédéral|Tribunale federale|Tribunal federal/i.test(text)
              ? "swiss_federal_supreme_court"
              : hostFamily;
  const title = /Obergericht Appenzell Ausserrhoden|Kantonsgericht Appenzell Ausserrhoden/i.test(
    text,
  )
    ? "Appenzell Ausserrhoden cantonal judgment"
    : /Bundesstrafgericht|Tribunal pénal fédéral|Tribunale penale federale/i.test(text)
      ? "Swiss Federal Criminal Court judgment"
      : /Bundesverwaltungsgericht|Tribunal administratif fédéral|Tribunale amministrativo federale/i.test(
            text,
          )
        ? "Swiss Federal Administrative Court judgment"
        : /Bundesgericht|Tribunal fédéral|Tribunale federale/i.test(text)
          ? "Swiss Federal Supreme Court judgment"
          : null;
  return {
    reference,
    decision_date: dateSelection.date,
    court_family: courtFamily === "unknown" ? null : courtFamily,
    title,
    primary_reference: reference,
    primary_reference_source: primary.source,
    cited_references: bodyReferences.filter((item) => item !== reference),
    related_proceeding_references: classifyRelatedReferences(
      metadataText,
      bodyReferences,
      reference,
    ),
    reviewed_decision_references: classifyReviewedDecisionReferences(
      metadataText,
      bodyReferences,
      reference,
    ),
    reference_extraction_confidence: primary.confidence,
    decision_date_source: dateSelection.source,
    decision_date_confidence: dateSelection.confidence,
    candidate_decision_date: candidate?.decision_date ?? null,
    live_document_decision_date: dateSelection.date,
    date_mismatch:
      candidate?.decision_date !== undefined &&
      candidate.decision_date !== null &&
      dateSelection.date !== null &&
      candidate.decision_date !== dateSelection.date,
    published_citation: publishedMapping.published_citation,
    case_reference: publishedMapping.case_reference,
    official_docid: publishedMapping.official_docid,
    publication_mapping_status: publishedMapping.status,
    publication_mapping_confidence: publishedMapping.confidence,
    publication_mapping_evidence: publishedMapping.evidence,
  };
}

function extractBgerPublishedMetadata(
  metadataText: string,
  finalUrl: string,
  candidate?: OfficialCaseCandidate,
): {
  readonly published_citation: string | null;
  readonly case_reference: string | null;
  readonly official_docid: string | null;
  readonly status: PublicationMappingStatus;
  readonly confidence: number | null;
  readonly evidence: readonly string[];
} {
  const candidateCitation =
    candidate?.published_citation ??
    candidate?.normalized_reference ??
    candidate?.reference ??
    null;
  const docidFromUrl = /highlight_docid=([^&#]+)/i.exec(finalUrl)?.[1];
  const decodedDocid = docidFromUrl ? decodeURIComponent(docidFromUrl) : null;
  const candidateIsPublished =
    candidate?.published_citation != null ||
    (candidate?.publication_mapping_status !== undefined &&
      candidate.publication_mapping_status !== "not_applicable") ||
    decodedDocid?.startsWith("atf://") === true;
  if (!candidateIsPublished) {
    return {
      published_citation: null,
      case_reference: null,
      official_docid: null,
      status: "not_applicable",
      confidence: null,
      evidence: [],
    };
  }
  const parts =
    parsePublishedBgerCitation(candidateCitation) ??
    parsePublishedBgerCitation(
      /\b(?:BGE\s*)?\d+\s+[IVX]+\s+\d+\b/i.exec(metadataText)?.[0] ?? null,
    );
  if (!parts) {
    return {
      published_citation: null,
      case_reference: null,
      official_docid: null,
      status: "not_applicable",
      confidence: null,
      evidence: [],
    };
  }
  const expectedDocid = `atf://${parts.volume}-${parts.division}-${parts.page}:de`;
  const publishedCitation = `BGE ${parts.volume} ${parts.division} ${parts.page}`;
  const caseReference =
    extractBgerCaseReference(metadataText.slice(0, 2500)) ?? candidate?.case_reference ?? null;
  const docidMatches = decodedDocid === expectedDocid;
  const citationMatches = new RegExp(
    `\\b${escapeRegExp(parts.volume)}\\s+${escapeRegExp(parts.division)}\\s+${escapeRegExp(parts.page)}\\b`,
    "i",
  ).test(metadataText.slice(0, 2500));
  const status: PublicationMappingStatus =
    docidMatches && citationMatches
      ? "mapping_verified"
      : decodedDocid || candidate?.publication_mapping_status === "mapping_verified"
        ? "mapping_unverified"
        : "mapping_not_found";
  return {
    published_citation: publishedCitation,
    case_reference: caseReference,
    official_docid: decodedDocid ?? expectedDocid,
    status,
    confidence: status === "mapping_verified" && caseReference ? 0.99 : 0.7,
    evidence: [
      ...(docidMatches ? [`official_docid:${expectedDocid}`] : []),
      ...(citationMatches ? [`published_citation:${publishedCitation}`] : []),
      ...(caseReference ? [`case_reference:${caseReference}`] : []),
    ],
  };
}

function selectPrimaryReference(input: {
  readonly finalUrl: string;
  readonly candidate?: OfficialCaseCandidate;
  readonly headerText: string;
  readonly headerReferences: readonly string[];
  readonly bodyReferences: readonly string[];
  readonly courtFamily: CourtFamily;
  readonly looksAr: boolean;
  readonly looksBstger: boolean;
  readonly looksBvger: boolean;
}): {
  readonly reference: string | null;
  readonly source: string | null;
  readonly confidence: number;
} {
  const bgerFromUrl = extractBgerReferenceFromUrl(input.finalUrl);
  if (input.courtFamily === "swiss_federal_supreme_court" && bgerFromUrl) {
    return { reference: bgerFromUrl, source: "official_url_docid", confidence: 0.98 };
  }
  if (input.candidate?.reference) {
    return {
      reference: input.candidate.reference,
      source: "official_search_result_metadata",
      confidence: 0.92,
    };
  }
  const arHeader = normalizeLiveArReference(
    /\b(?:Verfahren\s+Nr\.\s*)?(?:O[1-4][A-Z]|AB)\s+\d{2}\s+\d{1,4}\b/i.exec(
      input.headerText,
    )?.[0] ?? null,
  );
  if (input.looksAr && arHeader)
    return { reference: arHeader, source: "header_structural", confidence: 0.95 };
  const bstgerHeader = normalizeLiveBstgerReference(
    /\b[A-Z]{1,3}\s*\.\s*\d{4}\s*\.\s*\d+[A-Z]?\b/i.exec(input.headerText)?.[0] ?? null,
  );
  if (input.looksBstger && bstgerHeader)
    return { reference: bstgerHeader, source: "header_structural", confidence: 0.94 };
  const bvgerHeader = normalizeLiveBvgerReference(
    /\b[A-Z][-\s]?\d{1,6}\s*\/\s*\d{4}\b/i.exec(input.headerText)?.[0] ?? null,
  );
  if (input.looksBvger && bvgerHeader)
    return { reference: bvgerHeader, source: "header_structural", confidence: 0.94 };
  const header = input.headerReferences[0];
  if (header) return { reference: header, source: "header_unstructured", confidence: 0.72 };
  return { reference: null, source: null, confidence: 0 };
}

function selectDecisionDate(input: {
  readonly metadataText: string;
  readonly finalUrl: string;
  readonly candidate?: OfficialCaseCandidate;
  readonly looksAr: boolean;
  readonly looksBstger: boolean;
  readonly looksBvger: boolean;
}): { readonly date: string | null; readonly source: string | null; readonly confidence: number } {
  const headerDate =
    (input.looksAr ? extractArJudgmentDate(input.metadataText) : null) ??
    (input.looksBstger ? extractBstgerJudgmentDate(input.metadataText) : null) ??
    (input.looksBvger ? extractBvgerJudgmentDate(input.metadataText) : null) ??
    extractBgerDocIdDate(input.finalUrl);
  if (headerDate) return { date: headerDate, source: "header_or_official_docid", confidence: 0.96 };
  const urlDate = extractBvgerPdfUrlDate(input.finalUrl);
  if (urlDate) return { date: urlDate, source: "official_filename", confidence: 0.88 };
  if (input.candidate?.decision_date)
    return {
      date: input.candidate.decision_date,
      source: "official_search_result_metadata",
      confidence: 0.82,
    };
  const iso = extractIsoLikeDate(input.metadataText);
  if (iso) return { date: iso, source: "document_full_iso_date", confidence: 0.65 };
  const long = extractSwissLongDate(input.metadataText);
  if (long) return { date: long, source: "document_full_long_date", confidence: 0.6 };
  return { date: null, source: null, confidence: 0 };
}

function extractBgerReferenceFromUrl(raw: string): string | null {
  const decoded = decodeURIComponent(raw);
  const match = /aza:\/?\/?\d{2}-\d{2}-(?:19|20)\d{2}-(\d+[A-Z])([_-])(\d+)-((?:19|20)\d{2})/i.exec(
    decoded,
  );
  if (!match) return null;
  const chamber = match[1]!.toUpperCase();
  const separator = match[2] === "_" ? "_" : ".";
  return `${chamber}${separator}${Number(match[3])}/${match[4]}`;
}

function extractAllCaseReferences(text: string): readonly string[] {
  const found = [
    ...text.matchAll(/\b\d+[A-Z]_\d+\/\d{4}\b/gi),
    ...text.matchAll(/\b[A-Z]{1,3}\.\d{4}\.\d+[A-Z]?\b/gi),
    ...text.matchAll(/\b[A-Z]-\d{1,6}\/\d{4}\b/gi),
    ...text.matchAll(/\b(?:O[1-4][A-Z]|AB)\s+\d{2}\s+\d{1,4}\b/gi),
  ].map((match) => normalizeDetectedReference(match[0]));
  return [...new Set(found)];
}

function normalizeDetectedReference(value: string): string {
  return (
    normalizeLiveBgerReference(value) ??
    normalizeLiveBstgerReference(value) ??
    normalizeLiveBvgerReference(value) ??
    normalizeLiveArReference(value) ??
    value
  );
}

function normalizeLiveBgerReference(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = /^(\d+[A-Z])_0*(\d+)\/((?:19|20)\d{2})$/i.exec(trimmed);
  if (match) return `${match[1]!.toUpperCase()}_${Number(match[2])}/${match[3]}`;
  const legacy = /^(\d+[A-Z])\.0*(\d+)\/((?:19|20)\d{2})$/i.exec(trimmed);
  return legacy ? `${legacy[1]!.toUpperCase()}.${Number(legacy[2])}/${legacy[3]}` : null;
}

function classifyRelatedReferences(
  text: string,
  references: readonly string[],
  primary: string | null,
): readonly string[] {
  return references.filter(
    (reference) =>
      reference !== primary &&
      new RegExp(
        `(?:dossiers?|proc[ée]dure|Verfahren|cause).{0,80}${escapeRegExp(reference)}`,
        "i",
      ).test(text),
  );
}

function classifyReviewedDecisionReferences(
  text: string,
  references: readonly string[],
  primary: string | null,
): readonly string[] {
  return references.filter(
    (reference) =>
      reference !== primary &&
      new RegExp(
        `(?:jugement|arr[êe]t|Entscheid|Urteil|decision).{0,120}${escapeRegExp(reference)}`,
        "i",
      ).test(text),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLiveBvgerReference(value: string | null): string | null {
  if (!value) return null;
  const match = /^([A-Z])[-\s]?0*(\d+)\s*\/\s*(\d{4})$/i.exec(value.trim());
  return match ? `${match[1]!.toUpperCase()}-${Number(match[2])}/${match[3]}` : null;
}

function normalizeLiveBstgerReference(value: string | null): string | null {
  if (!value) return null;
  const match = /^([A-Z]{1,3})\s*\.\s*0*(\d{4})\s*\.\s*0*(\d+[A-Z]?)$/i.exec(
    value.replace(/\s+/g, "").trim(),
  );
  return match ? `${match[1]!.toUpperCase()}.${match[2]}.${match[3]!.toUpperCase()}` : null;
}

function normalizeLiveArReference(value: string | null): string | null {
  if (!value) return null;
  const match = /(?:Verfahren\s+Nr\.\s*)?([A-Z][0-9][A-Z]|AB)\s+0*(\d{2})\s+0*(\d{1,4})/i.exec(
    value.trim(),
  );
  return match ? `${match[1]!.toUpperCase()} ${match[2]} ${Number(match[3])}` : null;
}

function collapsePdfLetterSpacing(text: string): string {
  return text.replace(/(?<=\b\p{L})\s+(?=\p{L}\b)/gu, "").replace(/(?<=\b\d)\s+(?=\d\b)/g, "");
}

function extractBvgerJudgmentDate(text: string): string | null {
  const compactNoSpaces = text.replace(/\s+/g, "");
  const compactMatch =
    /(?:Urteilvom|Arrêtdu|Sentenzadel|Decisionedel)(\d{1,2})\.([A-Za-zÄÖÜäöüéèêûôà]+)(\d{4})/i.exec(
      compactNoSpaces,
    );
  if (compactMatch) {
    return extractSwissLongDate(`${compactMatch[1]}. ${compactMatch[2]} ${compactMatch[3]}`);
  }
  const compact = text.replace(/\s+/g, " ");
  const focused =
    /\b(?:Urteil\s+vom|Arrêt\s+du|Sentenza\s+del|Decisione\s+del)\s+(.{0,80}?)(?:Besetzung|Composition|Composizione|Parteien|Parties|Parti)/i.exec(
      compact,
    )?.[1] ?? null;
  return focused ? extractSwissLongDate(focused) : null;
}

function extractBstgerJudgmentDate(text: string): string | null {
  const compact = text.replace(/\s+/g, " ");
  const focused =
    /\b(?:Urteil\s+vom|Beschluss\s+vom|Entscheid\s+vom|Jugement\s+du|Arrêt\s+du|Décision\s+du|Sentenza\s+del|Decisione\s+del)\s+(.{0,80}?)(?:Cour|Kammer|Composition|Besetzung|Parties|Parteien|Parti)/i.exec(
      compact,
    )?.[1] ?? null;
  return focused ? extractSwissLongDate(focused) : null;
}

function extractArJudgmentDate(text: string): string | null {
  const compact = text.replace(/\s+/g, " ");
  const focused =
    /\b(?:Zirkular\s*-?\s*Urteil\s+vom|Urteil\s+vom|Entscheid\s+vom|Zirkular\s*-?\s*Entscheid\s+vom)\s+(.{0,80}?)(?:Mitwirkende|Verfahren|Sitzungsort|Beschwerde|Berufung)/i.exec(
      compact,
    )?.[1] ?? null;
  return focused ? extractSwissLongDate(focused) : null;
}

function extractIsoLikeDate(text: string): string | null {
  const match = /\b(19|20)\d{2}-\d{2}-\d{2}\b/.exec(text);
  return match?.[0] ?? null;
}

function extractSwissLongDate(text: string): string | null {
  const monthMap: Record<string, string> = {
    januar: "01",
    janvier: "01",
    gennaio: "01",
    februar: "02",
    février: "02",
    febbraio: "02",
    märz: "03",
    mars: "03",
    marzo: "03",
    april: "04",
    avril: "04",
    aprile: "04",
    mai: "05",
    maggio: "05",
    juni: "06",
    juin: "06",
    giugno: "06",
    juli: "07",
    juillet: "07",
    luglio: "07",
    august: "08",
    août: "08",
    agosto: "08",
    september: "09",
    septembre: "09",
    settembre: "09",
    oktober: "10",
    octobre: "10",
    ottobre: "10",
    november: "11",
    novembre: "11",
    novembre_it: "11",
    dezember: "12",
    décembre: "12",
    dicembre: "12",
  };
  const match = /\b(\d{1,2})\.?\s*([A-Za-zÄÖÜäöüéèêûôàâîïûùç]+)\s*((?:19|20)\d{2})\b/i.exec(text);
  if (!match) return null;
  const month = monthMap[match[2]!.toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${month}-${match[1]!.padStart(2, "0")}`;
}

function extractBgerDocIdDate(raw: string): string | null {
  const decoded = decodeURIComponent(raw);
  const match = /aza:\/?\/?(\d{2})-(\d{2})-((?:19|20)\d{2})-/i.exec(decoded);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function extractBvgerPdfUrlDate(raw: string): string | null {
  const decoded = decodeURIComponent(raw);
  const match = /_[12]\d{3}-\d{2}-\d{2}_/.exec(decoded);
  return match ? match[0].slice(1, 11) : null;
}

export function verifyCompleteness(fetch: FullTextFetchResult): CompletenessReport {
  if (fetch.fetch_status !== "fetch_success" && fetch.fetch_status !== "fetch_partial") {
    return emptyCompleteness(["fetch_not_successful"], "unknown");
  }
  // Una decision es "BGE publicado" si: (a) el mapeo de publicacion fue
  // verificado Y el docid empieza por "atf://" (ruta primaria, alta precision),
  // O (b) el texto del documento contiene una referencia BGE/ATF/DTF tipica
  // de la coleccion publicada (ruta secundaria para decisiones obtenidas
  // directamente de bger.ch sin pasar por el indice de publicacion). La ruta
  // secundaria solo aplica cuando el texto confirma el formato de coleccion
  // (volumen + serie romana + pagina) -- nunca se activa por referencias
  // sueltas de terceros dentro del texto del razonamiento.
  const publishedBge =
    (fetch.publication_mapping_status === "mapping_verified" &&
      fetch.official_docid?.startsWith("atf://") === true) ||
    (fetch.publication_mapping_status !== "mapping_not_found" &&
      /\b(?:BGE|ATF|DTF)\s+\d{2,3}\s+[IVX]+\s+\d+\b/i.test(fetch.text ?? ""));
  // Determine if party_arguments and lower_authority_reasoning are required based on decision type and content
  const requiresPartyArguments =
    !fetch.text?.toLowerCase().includes("nicht eingetreten") &&
    !fetch.text?.toLowerCase().includes("not entered") &&
    !fetch.text?.toLowerCase().includes("irrecevable") &&
    !fetch.text?.toLowerCase().includes("inammissibile");

  const requiresLowerAuthorityReasoning =
    fetch.text?.toLowerCase().includes("beschwerde") ||
    fetch.text?.toLowerCase().includes("appeal") ||
    fetch.text?.toLowerCase().includes("recours");

  const required = publishedBge
    ? ["header", "facts", "reasoning", "final_reasoning", "dispositive"]
    : [
        "header",
        "facts",
        "procedural_history",
        ...(requiresPartyArguments ? ["party_arguments"] : []),
        ...(requiresLowerAuthorityReasoning ? ["lower_authority_reasoning"] : []),
        "reasoning",
        "final_reasoning",
        "dispositive",
        "costs",
      ];
  const sectionsRead = Object.keys(fetch.sections);
  const missing = required.filter((section) => !sectionsRead.includes(section));
  const text = fetch.text ?? "";
  const suspiciouslySmall =
    (fetch.bytes_received ?? fetch.content_length) < 1_500 &&
    sectionsRead.length >= 3 &&
    fetch.mock_or_fixture !== true;
  const truncated = sectionsRead.filter((section) =>
    fetch.sections[section]!.includes("[TRUNCATED]"),
  );
  const globallyTruncated = /\[TRUNCATED\]/.test(text);
  const ocrDefective = /\uFFFD|OCR_DEFECTIVE|�/.test(text);
  const synthetic = /Synthetic official|synthetic_content|fixture|mock/i.test(text);
  const physicalPageCount = fetch.physical_page_count ?? null;
  const pagesWithText = fetch.pages_with_text ?? [];
  const pagesWithoutText = fetch.pages_without_text ?? [];
  const pagesFailed = fetch.pages_failed ?? [];
  const ocrRequired = fetch.ocr_required === true;
  const physicalCoverage = fetch.physical_page_coverage ?? null;
  const extractionCoverage = fetch.extraction_page_coverage ?? null;
  const separateOpinion = sectionsRead.includes("separate_opinion");
  // Multilingue (de/fr/it): antes solo cubria ingles/aleman, lo que podia dejar
  // ciego este gate para sentencias en frances/italiano con motivacion
  // autonoma multiple (ver Fase 2, causa raiz "regex DE-first").
  const independentGroundCandidates = [
    ...text.matchAll(
      /(?:independent ground|autonomous ground|selbständig(?:e|en|er)?\s+(?:tragend(?:e|en|er)?\s+)?Begründung(?:en)?|selbständig\s+tragend|motif(?:s)?\s+indépendant(?:s)?|motivation\s+indépendante|motivo\s+(?:autonomo|indipendente))[^.?!]*(?:[.?!]|$)/gi,
    ),
  ]
    .map((match) => match[0])
    .filter((excerpt) => classifyAutonomousGroundExcerpt(excerpt).autonomous);
  const independentGrounds = independentGroundCandidates.length;
  const independentGroundsRead = independentGroundCandidates.filter((excerpt) =>
    /reviewed|geprüft|examiné[e]?|revu[e]?|esaminat[oa]|verificat[oa]/i.test(excerpt),
  ).length;
  const verifiedStructuredAutonomousGrounds = extractStructuredAutonomousGrounds(text).filter(
    (excerpt) => classifyAutonomousGroundExcerpt(excerpt).autonomous,
  ).length;
  const verifiedCurrentCourtAutonomousGrounds = extractCurrentCourtAutonomousGrounds(text).filter(
    (excerpt) => classifyAutonomousGroundExcerpt(excerpt).autonomous,
  ).length;
  const effectiveIndependentGrounds = Math.max(
    independentGrounds,
    verifiedStructuredAutonomousGrounds,
    verifiedCurrentCourtAutonomousGrounds,
  );
  const effectiveIndependentGroundsRead = Math.max(
    independentGroundsRead,
    verifiedStructuredAutonomousGrounds,
    verifiedCurrentCourtAutonomousGrounds,
  );
  // Fix Fase 2 (2026-08-07): un mismatch confirmado entre el locale
  // solicitado/del portal y el idioma realmente detectado en el contenido
  // extraido sigue siendo una senal real y se conserva integramente como
  // warning (`document_language_mismatch_unresolved`, ver mas abajo) -- eso
  // NUNCA se elimina ni se silencia. Pero, verificado empiricamente
  // (validacion en vivo del 2026-08-07, ver _day1-validation-output), este
  // gate estaba bloqueando `complete` incluso cuando las 9 secciones
  // obligatorias SI se habian localizado y leido integramente: el idioma
  // detectado del CONTENIDO no coincidia con el `locale` de la URL del
  // portal de busqueda (que refleja el idioma de la INTERFAZ solicitada, no
  // necesariamente el idioma real de la resolucion -- ver
  // `extractRequestedLocale`), lo cual es una señal de calidad-de-metadatos,
  // no evidencia de que el texto este incompleto. Mantener este gate
  // duplicaba el proposito de `missing`/`truncated`/`ocrDefective` (que ya
  // exigen que las secciones EXISTAN y esten integras) sin aportar
  // verificacion adicional real. Por tanto: `languageMismatch` ya NO bloquea
  // `complete` por si solo cuando todas las secciones obligatorias fueron
  // realmente encontradas; el warning se preserva para que cualquier
  // consumidor pueda decidir tratarlo con mas cautela si lo necesita.
  const languageMismatch = fetch.language_mismatch === true;
  const complete =
    missing.length === 0 &&
    !suspiciouslySmall &&
    truncated.length === 0 &&
    !globallyTruncated &&
    !ocrDefective &&
    !synthetic &&
    !ocrRequired &&
    pagesFailed.length === 0 &&
    (physicalCoverage === null || physicalCoverage === 1) &&
    (extractionCoverage === null || extractionCoverage === 1) &&
    (!separateOpinion || sectionsRead.includes("separate_opinion")) &&
    effectiveIndependentGroundsRead >= effectiveIndependentGrounds;
  const status: CompletenessStatus = complete
    ? "complete"
    : ocrDefective || synthetic || suspiciouslySmall || ocrRequired
      ? "ocr_defective"
      : truncated.length > 0 || globallyTruncated
        ? "truncated"
        : missing.includes("dispositive")
          ? "missing_dispositive"
          : missing.includes("facts")
            ? "missing_facts"
            : missing.includes("final_reasoning")
              ? "missing_final_reasoning"
              : "partial";
  const sectionCoverage = Number(((required.length - missing.length) / required.length).toFixed(2));
  // Fase 2, punto 4: distingue "seccion ausente en el documento" de "seccion
  // no detectada por el parser". Nunca fabrica contenido de la seccion --
  // solo comprueba, sobre el texto ya extraido, si existe vocabulario
  // multilingue (de/fr/it) tipico de esa seccion en ALGUNA parte del
  // documento aunque el extractor no la haya podido delimitar. Si el
  // vocabulario esta presente, se anota como sospecha de fallo de
  // extraccion (no como prueba de ausencia juridica); si no hay ningun
  // indicio textual, se deja el `missing_<section>` simple.
  const SECTION_PRESENCE_MARKERS: Record<string, RegExp> = {
    header: /Bundesgericht|Tribunal fédéral|Tribunale federale/i,
    facts: /Sachverhalt|Faits|Fatti/i,
    procedural_history: /Verfahren|procédure|procedura/i,
    party_arguments: /Rechtsbegehren|Anträge|Conclusions?|Conclusioni|Istanze/i,
    lower_authority_reasoning: /Vorinstanz|autorité inférieure|autorità inferiore/i,
    reasoning: /Erwägung|Considérant|Considerand/i,
    final_reasoning: /Erwägung|Considérant|Considerand/i,
    dispositive: /Demnach erkennt|Par ces motifs|Per questi motivi|Dispositiv/i,
    costs: /Kosten|frais judiciaires|spese giudiziarie/i,
  };
  const extractionFailureSuspects = missing.filter((section) =>
    SECTION_PRESENCE_MARKERS[section]?.test(text),
  );
  return {
    total_pages: physicalPageCount,
    pages_read: pagesWithText,
    page_coverage: physicalCoverage ?? (fetch.document_unit_count ? 1 : 0),
    physical_page_count: physicalPageCount,
    extracted_page_count: fetch.extracted_page_count ?? null,
    pages_with_text: pagesWithText,
    pages_without_text: pagesWithoutText,
    pages_failed: pagesFailed,
    physical_page_coverage: physicalCoverage,
    extraction_page_coverage: extractionCoverage,
    document_unit_count: fetch.document_unit_count,
    scanned_document_detected: fetch.scanned_document_detected ?? false,
    ocr_required: ocrRequired,
    ocr_performed: fetch.ocr_performed ?? false,
    ocr_language: fetch.ocr_language ?? null,
    ocr_confidence: fetch.ocr_confidence ?? null,
    pages_requiring_ocr: fetch.pages_requiring_ocr ?? [],
    total_sections: required.length,
    sections_read: sectionsRead,
    section_coverage: sectionCoverage,
    missing_pages: [],
    missing_sections: missing,
    truncated_sections: truncated,
    extraction_errors: [
      ...missing.map((section) => `missing_${section}`),
      ...extractionFailureSuspects.map((section) => `${section}_marker_present_but_not_extracted`),
      ...(ocrDefective ? ["ocr_defective"] : []),
      ...(synthetic ? ["synthetic_content_detected"] : []),
      ...(suspiciouslySmall ? ["suspiciously_small_document"] : []),
      ...(ocrRequired ? ["ocr_required_not_performed"] : []),
      ...(pagesFailed.length > 0 ? ["page_extraction_failed"] : []),
      ...(globallyTruncated ? ["truncated_text"] : []),
      ...(effectiveIndependentGroundsRead < effectiveIndependentGrounds
        ? ["missing_independent_ground_review"]
        : []),
      ...(languageMismatch ? ["document_language_mismatch_unresolved"] : []),
    ],
    dispositive_present: !missing.includes("dispositive"),
    factual_section_present: !missing.includes("facts"),
    reasoning_section_present: !missing.includes("reasoning"),
    final_reasoning_section_present: !missing.includes("final_reasoning"),
    separate_opinions_present: separateOpinion,
    separate_opinions_read: separateOpinion ? sectionsRead.includes("separate_opinion") : true,
    independent_grounds_count: effectiveIndependentGrounds,
    independent_grounds_read: effectiveIndependentGroundsRead,
    completeness_score: sectionCoverage,
    completeness_status: status,
    section_evidence: fetch.section_evidence,
  };
}

export function compareSwissCaseSources(input: {
  readonly official: OfficialCaseCandidate;
  readonly official_document?: FullTextFetchResult;
  readonly secondary: readonly OfficialCaseCandidate[];
  readonly secondary_documents?: readonly FullTextFetchResult[];
}): CaseSourceComparison {
  const officialText = input.official_document?.text ?? input.official.content ?? "";
  const officialSections = extractSections(officialText);
  const secondarySources = input.secondary.map((source) => source.source_url);
  const missing = new Set<string>();
  const additional = new Set<string>();
  const editorial = new Set<string>();
  const mismatch = new Set<string>();
  const officialDocumentId = input.official_document
    ? documentIdFor(input.official_document)
    : null;

  if (input.secondary.length === 0 && (input.secondary_documents?.length ?? 0) === 0) {
    return {
      comparison_id: comparisonIdFor(officialDocumentId, []),
      sources_compared: 1,
      comparison_status: "insufficient_sources",
      official_source: input.official.source_url,
      secondary_sources: [],
      identity_match: null,
      text_match_score: null,
      structural_match_score: null,
      missing_in_secondary: [],
      additional_in_secondary: [],
      contradictory_passages: [],
      editorial_additions: [],
      source_mismatch: ["secondary_source_missing"],
      // Contract: authoritative_source_selected is the official SOURCE URL
      // (matches the "compared" branch below and result.selected_candidate.source_url).
      // The document identifier is exposed separately via official_document_id —
      // it must never overwrite this field, even when a document_id is available.
      authoritative_source_selected: input.official.source_url,
      comparison_confidence: null,
      official_document_id: officialDocumentId ?? undefined,
      secondary_document_ids: [],
    };
  }

  const secondaryDocuments = input.secondary_documents ?? [];
  input.secondary.forEach((secondary, index) => {
    const secondaryText = secondaryDocuments[index]?.text ?? secondary.content ?? "";
    const secondarySections = extractSections(secondaryText);
    for (const key of Object.keys(officialSections)) {
      if (!(key in secondarySections)) missing.add(key);
    }
    for (const key of Object.keys(secondarySections)) {
      if (!(key in officialSections)) additional.add(key);
    }
    if (/headnote|redaktion|editorial/i.test(secondaryText)) editorial.add(secondary.source_url);
    if (!("dispositive" in secondarySections)) {
      mismatch.add("secondary_source_incomplete");
      mismatch.add("full_text_source_mismatch");
    }
  });

  const textMatch =
    input.secondary.length === 0
      ? 0
      : Number(
          (
            input.secondary.reduce((sum, source, index) => {
              const secondaryText = secondaryDocuments[index]?.text ?? source.content ?? "";
              return sum + similarity(stripTags(officialText), stripTags(secondaryText));
            }, 0) / input.secondary.length
          ).toFixed(2),
        );
  const structuralMatch =
    input.secondary.length === 0
      ? 1
      : Number(
          (
            input.secondary.reduce((sum, source, index) => {
              const secondaryText = secondaryDocuments[index]?.text ?? source.content ?? "";
              const sourceSections = Object.keys(extractSections(secondaryText));
              const officialKeys = Object.keys(officialSections);
              return (
                sum +
                sourceSections.filter((key) => officialKeys.includes(key)).length /
                  Math.max(1, officialKeys.length)
              );
            }, 0) / input.secondary.length
          ).toFixed(2),
        );

  const secondaryDocumentIds = secondaryDocuments.flatMap((document) => {
    const id = documentIdFor(document);
    return id ? [id] : [];
  });
  const result: CaseSourceComparison = {
    comparison_id: comparisonIdFor(officialDocumentId, secondaryDocumentIds),
    sources_compared: 1 + input.secondary.length,
    comparison_status: "compared",
    official_source: input.official.source_url,
    secondary_sources: secondarySources,
    identity_match: input.secondary.every(
      (source) => source.reference === input.official.reference,
    ),
    text_match_score: textMatch,
    structural_match_score: structuralMatch,
    missing_in_secondary: [...missing],
    additional_in_secondary: [...additional],
    contradictory_passages: [],
    editorial_additions: [...editorial],
    source_mismatch: [...mismatch],
    authoritative_source_selected: input.official.source_url,
    comparison_confidence:
      input.secondary.length === 0 ? 0.75 : Math.min(textMatch, structuralMatch),
    official_document_id: officialDocumentId ?? undefined,
    secondary_document_ids: secondaryDocumentIds,
  };
  persistComparison(result);
  return result;
}

export async function compareSwissCaseSourcesByIdentifier(
  input: {
    readonly case_reference?: string;
    readonly official_document_id?: string;
    readonly secondary_document_id?: string;
    readonly official_resolution_id?: string;
    readonly secondary_resolution_id?: string;
    readonly official_url?: string;
    readonly secondary_url?: string;
    readonly allow_secondary_discovery?: boolean;
  },
  signal?: AbortSignal,
): Promise<CaseSourceComparison> {
  const officialFetch = await fetchOfficialSwissCaseFullTextByIdentifier(
    {
      document_id: input.official_document_id,
      resolution_id: input.official_resolution_id,
      canonical_url: input.official_url,
      case_reference: input.case_reference,
      requireOfficial: true,
      requireFullText: true,
    },
    signal,
  );
  if (officialFetch.fetch_status !== "fetch_success") {
    return insufficientComparison("official_source_not_found", null);
  }
  const store = readStore();
  const officialCandidate =
    selectStoredCandidate(store, {
      document_id: officialFetch.document_id,
      resolution_id: officialFetch.resolution_id,
    }).candidate ??
    candidateFromFetch(
      officialFetch,
      input.case_reference ?? officialFetch.live_metadata?.reference,
    );

  const secondaryDocuments: FullTextFetchResult[] = [];
  if (input.secondary_document_id || input.secondary_resolution_id || input.secondary_url) {
    const secondaryFetch = await fetchOfficialSwissCaseFullTextByIdentifier(
      {
        document_id: input.secondary_document_id,
        resolution_id: input.secondary_resolution_id,
        canonical_url: input.secondary_url,
        case_reference: input.case_reference ?? officialFetch.live_metadata?.reference ?? undefined,
        requireOfficial: false,
        requireFullText: false,
      },
      signal,
    );
    if (secondaryFetch.fetch_status === "fetch_success") secondaryDocuments.push(secondaryFetch);
  } else if (input.allow_secondary_discovery && input.case_reference) {
    const secondary = await fetchOfficialSwissCaseFullTextByIdentifier(
      {
        canonical_url: `https://entscheidsuche.ch/case/${encodeURIComponent(input.case_reference)}`,
        case_reference: input.case_reference,
        requireOfficial: false,
        requireFullText: false,
      },
      signal,
    );
    if (secondary.fetch_status === "fetch_success") secondaryDocuments.push(secondary);
  }

  if (secondaryDocuments.length === 0) {
    return insufficientComparison(
      "secondary_source_missing",
      officialFetch.document_id ?? null,
      officialCandidate.source_url,
    );
  }

  const secondaryCandidates = secondaryDocuments.map((document) =>
    candidateFromFetch(document, input.case_reference ?? document.live_metadata?.reference),
  );
  return compareSwissCaseSources({
    official: officialCandidate,
    official_document: officialFetch,
    secondary: secondaryCandidates,
    secondary_documents: secondaryDocuments,
  });
}

function persistResolution(resolution: OfficialSwissCaseResolution): void {
  mutateStore((store) => {
    const selected = resolution.selected_candidate;
    for (const candidate of resolution.candidates) {
      store.candidates[candidate.candidate_id] = candidate;
      if (candidate.resolution_id) {
        store.indexes.resolution_by_candidate_id[candidate.candidate_id] = candidate.resolution_id;
      }
    }
    if (resolution.fetch && selected) {
      persistDocumentInStore(
        store,
        selected,
        resolution.fetch,
        resolution.legal_use,
        resolution.resolution_id,
      );
    }
    const previous = store.resolutions[resolution.resolution_id];
    const now = new Date().toISOString();
    store.resolutions[resolution.resolution_id] = {
      schema_version: storeSchemaVersion,
      resolution_id: resolution.resolution_id,
      candidate_id: selected?.candidate_id ?? null,
      document_id: resolution.document_id ?? null,
      normalized_reference: resolution.normalized.normalized_reference,
      source_adapter: selected?.source_adapter ?? selected?.source ?? null,
      source_status: resolution.legal_use.source_status,
      requested_url: resolution.fetch?.requested_url ?? selected?.source_url ?? null,
      canonical_url: selected?.canonical_url ?? null,
      final_url: resolution.fetch?.final_url ?? selected?.canonical_url ?? null,
      candidate_fingerprint: selected?.candidate_fingerprint ?? null,
      metadata_hash: resolution.fetch?.metadata_hash ?? null,
      document_hash: resolution.fetch?.document_hash ?? null,
      cache_key: resolution.cache_key ?? "",
      retrieved_at: resolution.fetch?.retrieved_at ?? null,
      candidate: selected,
      candidates: resolution.candidates,
      selected_candidate_id: selected?.candidate_id ?? null,
      rejected_candidates: resolution.rejected_candidates,
      ambiguity_status: resolution.ambiguity_status,
      selection_reason: resolution.selection_reason,
      selection_blockers: resolution.selection_blockers,
      identity: resolution.identity,
      live_metadata: resolution.fetch?.live_metadata,
      created_at: previous?.created_at ?? previous?.stored_at ?? now,
      updated_at: now,
      stored_at: now,
    };
    store.indexes.resolution_by_normalized_reference[resolution.normalized.normalized_reference] =
      resolution.resolution_id;
  });
}

function persistDocumentInStore(
  store: OfficialCaseStore,
  candidate: OfficialCaseCandidate,
  fetch: FullTextFetchResult,
  legalUse: UniformLegalUseStatus,
  resolutionId: string | null = candidate.resolution_id ?? null,
): string | null {
  const documentId = documentIdFor(fetch);
  if (!documentId || !fetch.document_hash || !fetch.metadata_hash || !fetch.retrieved_at) {
    return null;
  }
  const liveVerified = isLiveVerifiedFetch(fetch);
  const document: StoredOfficialCaseDocument = {
    schema_version: storeSchemaVersion,
    document_id: documentId,
    resolution_id: resolutionId,
    candidate_id: candidate.candidate_id,
    normalized_reference: candidate.reference ?? fetch.live_metadata?.reference ?? "",
    source_adapter: candidate.source_adapter ?? candidate.source,
    source_status: legalUse.source_status,
    requested_url: fetch.requested_url ?? candidate.source_url,
    canonical_url: candidate.canonical_url,
    final_url: fetch.final_url,
    mime_type: fetch.mime_type,
    status_code: fetch.status_code ?? null,
    response_headers: fetch.response_headers ?? {},
    content_length: fetch.content_length,
    bytes_received: fetch.bytes_received ?? 0,
    document_hash: fetch.document_hash,
    metadata_hash: fetch.metadata_hash,
    retrieved_at: fetch.retrieved_at,
    live_http_verified: liveVerified,
    mock_or_fixture: fetch.mock_or_fixture ?? false,
    cache_origin:
      fetch.network_transport === "live_http" || fetch.network_transport === "test_http"
        ? fetch.network_transport
        : "unknown",
    official_status: legalUse.source_status,
    text: fetch.text ?? "",
    sections: fetch.sections,
    live_metadata: fetch.live_metadata,
    candidate: {
      ...candidate,
      decision_date: fetch.live_metadata?.decision_date ?? candidate.decision_date,
      decision_date_status: fetch.live_metadata?.decision_date
        ? "verified_from_live_document"
        : candidate.decision_date_status,
    },
    fetch: {
      ...fetch,
      document_id: documentId,
      resolution_id: resolutionId ?? undefined,
      candidate_id: candidate.candidate_id,
    },
  };
  if (!isStoredDocumentValid(document)) return null;
  store.documents[documentId] = document;
  store.indexes.document_by_candidate_id[candidate.candidate_id] = documentId;
  if (resolutionId) store.indexes.document_by_resolution_id[resolutionId] = documentId;
  store.indexes.document_by_canonical_url[candidate.canonical_url] = documentId;
  return documentId;
}

function persistComparison(comparison: CaseSourceComparison): void {
  if (!comparison.comparison_id) return;
  mutateStore((store) => {
    store.comparisons[comparison.comparison_id!] = {
      schema_version: storeSchemaVersion,
      comparison_id: comparison.comparison_id!,
      official_document_id: comparison.official_document_id ?? null,
      secondary_document_ids: comparison.secondary_document_ids ?? [],
      comparison,
      stored_at: new Date().toISOString(),
    };
  });
}

function finalizeFetch(
  candidate: OfficialCaseCandidate,
  fetch: FullTextFetchResult,
  cacheStatus: CacheStatus,
): FullTextFetchResult {
  const initialDocumentId = documentIdFor(fetch);
  // Create preliminary enriched object for documentId (needed for verification)
  const preliminaryEnriched: FullTextFetchResult = {
    ...fetch,
    cache_status: cacheStatus,
    resolution_id: candidate.resolution_id,
    candidate_id: candidate.candidate_id,
    ...(initialDocumentId ? { document_id: initialDocumentId } : {}),
  };

  // Use preliminary enriched object for verification and ratio analysis
  const completeness = verifyCompleteness(preliminaryEnriched);
  const ratio = analyzeRatio(preliminaryEnriched, completeness);
  const documentId = documentIdFor(preliminaryEnriched);
  const readingStatus: ReadingStatus =
    preliminaryEnriched.fetch_status === "fetch_success" &&
    completeness.completeness_status === "complete"
      ? candidate.official && isLiveVerifiedFetch(preliminaryEnriched)
        ? "full_text_verified_official"
        : "full_text_read_unofficial"
      : "extraction_incomplete";
  const enriched: FullTextFetchResult = {
    ...preliminaryEnriched,
    completeness_status: completeness.completeness_status,
    reading_status: readingStatus,
    warnings: [...preliminaryEnriched.warnings, ...ratio.warnings],
  };
  if (documentId && fetch.fetch_status === "fetch_success") {
    mutateStore((store) => {
      persistDocumentInStore(store, candidate, enriched, {
        discovery_status: "candidate_selected",
        identity_status: "identity_verified",
        source_status: candidate.official ? "official" : "unofficial",
        fetch_status: enriched.fetch_status,
        completeness_status: completeness.completeness_status,
        reading_status: readingStatus,
        official_verification_status:
          candidate.official &&
          isLiveVerifiedFetch(enriched) &&
          completeness.completeness_status === "complete"
            ? "full_text_verified_official"
            : "not_verified",
        ratio_status: ratio.ratio_status,
        ratio_analysis: ratio,
        comparability_eligibility:
          ratio.ratio_status === "ratio_confirmed" ? "eligible" : "blocked",
        drafting_eligibility: ratio.ratio_status === "ratio_confirmed" ? "eligible" : "blocked",
        strategy_eligibility: ratio.ratio_status === "ratio_confirmed" ? "eligible" : "blocked",
        citation_eligibility: ratio.ratio_status === "ratio_confirmed" ? "eligible" : "blocked",
      });
    });
  }
  return enriched;
}

function selectStoredDocument(
  store: OfficialCaseStore,
  input: {
    readonly document_id?: string;
    readonly resolution_id?: string;
    readonly candidate_id?: string;
    readonly canonical_url?: string;
  },
): { document?: StoredOfficialCaseDocument; status: "miss" | "invalid"; reason?: string } {
  const id =
    input.document_id ??
    (input.resolution_id
      ? store.indexes.document_by_resolution_id[input.resolution_id]
      : undefined) ??
    (input.candidate_id ? store.indexes.document_by_candidate_id[input.candidate_id] : undefined) ??
    (input.canonical_url
      ? store.indexes.document_by_canonical_url[input.canonical_url]
      : undefined);
  if (!id) return { status: "miss" };
  const document = store.documents[id];
  if (!isStoredDocumentValid(document)) return { status: "invalid", reason: "stale_identifier" };
  return { document, status: "miss" };
}

function selectStoredCandidate(
  store: OfficialCaseStore,
  input: {
    readonly document_id?: string;
    readonly resolution_id?: string;
    readonly candidate_id?: string;
    readonly normalized_reference?: string;
    readonly case_reference?: string;
  },
): { candidate?: OfficialCaseCandidate; status: "miss" | "invalid"; reason?: string } {
  if (input.document_id) {
    const document = store.documents[input.document_id];
    if (!document || !isStoredDocumentValid(document)) {
      return { status: "invalid", reason: "stale_identifier" };
    }
    const validDocument = document;
    return {
      candidate: validDocument.candidate ?? candidateFromStoredDocument(validDocument),
      status: "miss",
    };
  }
  if (input.candidate_id) {
    const candidate = store.candidates[input.candidate_id];
    return candidate
      ? { candidate, status: "miss" }
      : { status: "invalid", reason: "invalid_identifier" };
  }
  if (input.resolution_id) {
    const resolution = store.resolutions[input.resolution_id];
    return resolution?.candidate
      ? { candidate: resolution.candidate, status: "miss" }
      : resolution
        ? { status: "invalid", reason: "resolution_has_no_selected_candidate" }
        : { status: "invalid", reason: "invalid_identifier" };
  }
  const reference = input.normalized_reference ?? input.case_reference;
  if (reference) {
    const resolutionId = store.indexes.resolution_by_normalized_reference[reference];
    const candidate = resolutionId ? store.resolutions[resolutionId]?.candidate : undefined;
    if (candidate) return { candidate, status: "miss" };
  }
  return { status: "miss" };
}

function storedDocumentToFetch(
  document: StoredOfficialCaseDocument,
  cacheStatus: CacheStatus,
): FullTextFetchResult {
  return {
    ...document.fetch,
    cache_status: cacheStatus,
    resolution_id: document.resolution_id ?? undefined,
    candidate_id: document.candidate_id ?? undefined,
    document_id: document.document_id,
    requested_url: document.requested_url,
    final_url: document.final_url,
    status_code: document.status_code ?? undefined,
    response_headers: document.response_headers,
    mime_type: document.mime_type,
    content_length: document.content_length,
    bytes_received: document.bytes_received,
    document_hash: document.document_hash,
    metadata_hash: document.metadata_hash,
    retrieved_at: document.retrieved_at,
    text: document.text,
    sections: document.sections,
    live_metadata: document.live_metadata,
  };
}

function emptyIdentifierFetch(
  input: {
    readonly resolution_id?: string;
    readonly candidate_id?: string;
    readonly document_id?: string;
    readonly canonical_url?: string;
    readonly normalized_reference?: string;
    readonly case_reference?: string;
  },
  warning: string,
): FullTextFetchResult {
  const source = input.canonical_url ?? input.normalized_reference ?? input.case_reference ?? "";
  return {
    fetch_status: "fetch_failed",
    cache_status: warning === "stale_identifier" ? "cache_hit_stale" : "cache_miss",
    resolution_id: input.resolution_id,
    candidate_id: input.candidate_id,
    document_id: input.document_id,
    requested_url: source,
    source_url: source,
    final_url: source,
    redirects: [],
    response_headers: {},
    mime_type: null,
    content_length: 0,
    bytes_received: 0,
    document_hash: null,
    metadata_hash: null,
    network_transport: "none",
    mock_or_fixture: false,
    retrieved_at: null,
    extractor_version: extractorVersion,
    source_version: null,
    text: null,
    sections: {},
    completeness_status: "unknown",
    reading_status: "extraction_incomplete",
    warnings: [warning],
  };
}

function candidateFromStoredDocument(document: StoredOfficialCaseDocument): OfficialCaseCandidate {
  return candidateFromFetch(
    document.fetch,
    document.normalized_reference,
    document.source_status === "official",
  );
}

function candidateFromFetch(
  fetch: FullTextFetchResult,
  reference?: string | null,
  official = isOfficialHost(safeUrl(fetch.final_url)?.hostname ?? ""),
): OfficialCaseCandidate {
  const normalized = normalizeSwissCaseReference(
    reference ?? fetch.live_metadata?.reference ?? fetch.final_url,
  );
  return makeCandidate({
    reference: normalized,
    source: official ? "stored_official_document" : "stored_secondary_document",
    sourceUrl: fetch.final_url,
    official,
    contentKind: "html",
  });
}

function applyFetchPublicationMappingToCandidate(
  candidate: OfficialCaseCandidate,
  fetch: FullTextFetchResult,
): OfficialCaseCandidate {
  if (
    !fetch.published_citation &&
    !fetch.case_reference &&
    !fetch.official_docid &&
    !fetch.publication_mapping_status
  ) {
    return candidate;
  }
  return {
    ...candidate,
    published_citation: fetch.published_citation ?? candidate.published_citation ?? null,
    case_reference: fetch.case_reference ?? candidate.case_reference ?? null,
    official_docid: fetch.official_docid ?? candidate.official_docid ?? null,
    publication_mapping_status:
      fetch.publication_mapping_status ?? candidate.publication_mapping_status ?? "not_applicable",
    publication_mapping_confidence:
      fetch.publication_mapping_confidence ?? candidate.publication_mapping_confidence ?? null,
    publication_mapping_evidence: [
      ...(candidate.publication_mapping_evidence ?? []),
      ...(fetch.publication_mapping_evidence ?? []),
    ],
    reference: fetch.published_citation ?? candidate.reference,
    canonical_url: fetch.final_url,
    download_url: fetch.final_url,
    decision_date: fetch.decision_date ?? candidate.decision_date,
    decision_date_status: fetch.decision_date
      ? "verified_from_live_document"
      : candidate.decision_date_status,
    primary_document:
      fetch.publication_mapping_status === "mapping_verified" ? true : candidate.primary_document,
    full_text_available:
      fetch.fetch_status === "fetch_success" ? true : candidate.full_text_available,
  };
}

function insufficientComparison(
  reason: "official_source_not_found" | "secondary_source_missing",
  officialDocumentId: string | null,
  officialSourceUrl: string | null = null,
): CaseSourceComparison {
  return {
    comparison_id: comparisonIdFor(officialDocumentId, []),
    sources_compared: officialDocumentId ? 1 : 0,
    comparison_status: "insufficient_sources",
    official_source: officialSourceUrl,
    secondary_sources: [],
    identity_match: null,
    text_match_score: null,
    structural_match_score: null,
    missing_in_secondary: [],
    additional_in_secondary: [],
    contradictory_passages: [],
    editorial_additions: [],
    source_mismatch: [reason],
    // Same contract as compareSwissCaseSources: this field carries the
    // official SOURCE URL, never the document_id (see official_document_id).
    authoritative_source_selected: officialSourceUrl,
    comparison_confidence: null,
    official_document_id: officialDocumentId ?? undefined,
    secondary_document_ids: [],
  };
}

function inferSourceFormat(
  fetch: Pick<FullTextFetchResult, "mime_type" | "response_body_type">,
): "html" | "pdf" | "text" | "unknown" {
  if (fetch.response_body_type === "pdf") return "pdf";
  if (fetch.response_body_type === "html") return "html";
  if (fetch.response_body_type === "text") return "text";
  if (fetch.mime_type?.includes("pdf")) return "pdf";
  if (fetch.mime_type?.includes("html")) return "html";
  return "unknown";
}

function buildPageReferenceMetadata(
  fetch: Pick<FullTextFetchResult, "mime_type" | "response_body_type" | "physical_page_count">,
  sectionEvidence?: SectionEvidence | null,
): {
  readonly supporting_page_numbers: readonly number[];
  readonly pagination_type: string;
  readonly page_reference_status: string;
} {
  const sourceFormat = inferSourceFormat(fetch);
  const hasVerifiableSectionPages =
    sectionEvidence?.page_start != null && sectionEvidence?.page_end != null;
  const pageNumbers =
    hasVerifiableSectionPages &&
    sectionEvidence?.page_start != null &&
    sectionEvidence?.page_end != null
      ? (() => {
          const start = sectionEvidence.page_start;
          const end = sectionEvidence.page_end;
          return Array.from({ length: end - start + 1 }, (_, index) => start + index);
        })()
      : [];
  if (sourceFormat === "html" && (fetch.physical_page_count ?? null) === null) {
    return {
      supporting_page_numbers: [],
      pagination_type: "html_unpaginated",
      page_reference_status: "not_applicable_html",
    };
  }
  if (pageNumbers.length > 0) {
    return {
      supporting_page_numbers: pageNumbers,
      pagination_type: "section_pages",
      page_reference_status: "verified",
    };
  }
  if (sourceFormat === "pdf" && (fetch.physical_page_count ?? null) !== null) {
    return {
      supporting_page_numbers: [],
      pagination_type: "physical_pages",
      page_reference_status: "verified",
    };
  }
  return {
    supporting_page_numbers: [],
    pagination_type: "unknown",
    page_reference_status: "unknown",
  };
}

function extractDocumentUnitReference(excerpt: string, sectionText?: string | null): string | null {
  const normalizedExcerpt = excerpt.replace(/\s+/g, " ").trim();
  const explicitDocumentUnitMatch =
    /(?:\bE\.?\s*([0-9]+(?:\.[0-9]+)+)|\b([0-9]+(?:\.[0-9]+)+)\b)/.exec(normalizedExcerpt);
  const explicitDocumentUnit = explicitDocumentUnitMatch?.[1] ?? explicitDocumentUnitMatch?.[2];
  if (explicitDocumentUnit) {
    return explicitDocumentUnit.startsWith("E.")
      ? explicitDocumentUnit
      : `E.${explicitDocumentUnit}`;
  }
  if (!sectionText) return null;
  const normalizedSectionText = sectionText.replace(/\s+/g, " ").trim();
  const excerptKey = normalizedExcerpt.replace(
    /^Autonomer Entscheidgrund des Bundesgerichts:\s*/i,
    "",
  );
  const excerptIndex = excerptKey ? normalizedSectionText.indexOf(excerptKey) : -1;
  if (excerptIndex < 0) return null;
  const prefix = normalizedSectionText.slice(0, excerptIndex);
  const precedingDocumentUnits = Array.from(prefix.matchAll(/\b(?:E\.)?\d+(?:\.\d+)+\b/g));
  const inferredDocumentUnit = precedingDocumentUnits.at(-1)?.[0];
  return inferredDocumentUnit
    ? inferredDocumentUnit.startsWith("E.")
      ? inferredDocumentUnit
      : `E.${inferredDocumentUnit}`
    : null;
}

function resolveSupportingSectionIds(
  fetch: Pick<FullTextFetchResult, "sections">,
  authorityOrigin: {
    readonly authority: NonNullable<RatioGroundDetail["passage_authority_level"]>;
    readonly origin: NonNullable<RatioGroundDetail["passage_origin"]>;
  },
  sectionId: string,
  normalizedExcerpt: string,
): readonly string[] {
  if (authorityOrigin.authority === "current_court" && sectionId === "lower_authority_reasoning") {
    // "lower_authority_reasoning" can be an alias copy of the court's own reasoning text
    // (see extractJudgmentSectionsHeuristically, which duplicates "reasoning" into
    // "lower_authority_reasoning" whenever the reasoning mentions the lower instance at all).
    // A passage whose own wording was independently classified as current-court original or
    // adopted reasoning must never be labeled with the lower-authority section name; re-derive
    // the real section from where the excerpt text actually lives.
    const finalReasoningText = fetch.sections["final_reasoning"];
    if (finalReasoningText?.replace(/\s+/g, " ").includes(normalizedExcerpt)) {
      return ["final_reasoning"];
    }
    return ["reasoning"];
  }
  if (
    authorityOrigin.origin === "lower_authority_reasoning" &&
    sectionId === "lower_authority_reasoning"
  ) {
    return ["reasoning"];
  }
  return [sectionId];
}

function buildPassageTraceabilityMetadata(
  fetch: Pick<
    FullTextFetchResult,
    "mime_type" | "response_body_type" | "physical_page_count" | "sections"
  >,
  sectionId: string,
  excerpt: string,
  sectionEvidence?: SectionEvidence | null,
  fallbackDocumentUnit?: string | null,
  sectionText?: string | null,
): PassageTraceabilityMetadata {
  const normalizedExcerpt = excerpt.replace(/\s+/g, " ").trim();
  const pageReferenceMetadata = buildPageReferenceMetadata(fetch, sectionEvidence);
  const currentCourtOriginal =
    /(?:Erforderlich ist|Kein Vorsteuerabzug|Mit Ausnahme|Autonomer Entscheidgrund des Bundesgerichts)/i.test(
      normalizedExcerpt,
    ) &&
    /Beschwerde.*abzuweisen|Vorsteuerabzug|Entgeltlichkeit|Ausgangsumsätze|Bundesgericht/i.test(
      normalizedExcerpt,
    );
  const currentCourtAdopted =
    /Die Vorinstanz(?:\s+stellt\s+zu\s+Recht\s+fest|\s+hat\s+zutreffend\s+erkannt)/i.test(
      normalizedExcerpt,
    ) &&
    /Beschwerde.*abzuweisen|auf die Beschwerde|deshalb|Demnach|erkennt|entscheidet/i.test(
      normalizedExcerpt,
    );
  const currentCourtAdoptedFallback =
    /(?:Kein Vorsteuerabzug|Entgeltlichkeit|mangels|deshalb)/i.test(normalizedExcerpt) &&
    /Beschwerde.*abzuweisen|auf die Beschwerde|mangels/i.test(normalizedExcerpt);
  const explicitLowerAuthorityPhrase =
    /Die Vorinstanz(?:\s+stellt\s+zu\s+Recht\s+fest|\s+hat\s+zutreffend\s+erkannt)/i.test(
      normalizedExcerpt,
    ) &&
    !/Beschwerde.*abzuweisen|auf die Beschwerde|Deshalb|Demnach|erkennt|entscheidet|mangels/i.test(
      normalizedExcerpt,
    );
  const authorityOrigin =
    currentCourtAdopted || currentCourtAdoptedFallback
      ? { authority: "current_court" as const, origin: "current_court_adopted_reasoning" as const }
      : currentCourtOriginal
        ? {
            authority: "current_court" as const,
            origin: "current_court_original_reasoning" as const,
          }
        : explicitLowerAuthorityPhrase
          ? { authority: "lower_authority" as const, origin: "lower_authority_reasoning" as const }
          : /lower_authority_reasoning|Vorinstanz|Vorinstanz\s+(?:stellt|hat)/i.test(sectionId) ||
              /Vorinstanz|Vorinstanz\s+(?:stellt|hat)/i.test(normalizedExcerpt)
            ? {
                authority: "lower_authority" as const,
                origin: "lower_authority_reasoning" as const,
              }
            : { authority: "unknown" as const, origin: "unknown" as const };
  const supportingSections = resolveSupportingSectionIds(
    fetch,
    authorityOrigin,
    sectionId,
    normalizedExcerpt,
  );
  const supportingDocumentUnits = extractDocumentUnitReference(normalizedExcerpt, sectionText)
    ? [extractDocumentUnitReference(normalizedExcerpt, sectionText)!]
    : fallbackDocumentUnit
      ? [fallbackDocumentUnit]
      : [sectionId];
  return {
    supporting_sections: supportingSections,
    supporting_document_units: supportingDocumentUnits,
    supporting_page_numbers: pageReferenceMetadata.supporting_page_numbers,
    passage_authority_level: authorityOrigin.authority,
    passage_origin: authorityOrigin.origin,
    pagination_type: pageReferenceMetadata.pagination_type,
    page_reference_status: pageReferenceMetadata.page_reference_status,
  };
}

function analyzeRatio(fetch: FullTextFetchResult, completeness: CompletenessReport): RatioAnalysis {
  const independentGrounds = completeness.independent_grounds_count;
  const independentReviewed = completeness.independent_grounds_read;
  const obiterDetails = detectObiterPassages(fetch);
  const dispositiveLink =
    completeness.dispositive_present && completeness.final_reasoning_section_present
      ? "final_reasoning_to_dispositive"
      : null;
  const mainGround =
    cleanRatioSection(fetch.sections["final_reasoning"])?.slice(0, 500) ??
    cleanRatioSection(fetch.sections["reasoning"])?.slice(0, 500) ??
    null;
  const ratioSummary = mainGround ? summarizeRatio(mainGround) : null;
  const evidence = buildRatioEvidence(fetch, ["final_reasoning", "reasoning", "dispositive"]);
  const mainEvidence = evidence.find((item) => item.section_id !== "dispositive");
  const mainEvidenceTraceability = mainEvidence
    ? buildPassageTraceabilityMetadata(
        fetch,
        mainEvidence.section_id,
        mainEvidence.excerpt,
        undefined,
        undefined,
        fetch.sections[mainEvidence.section_id],
      )
    : null;
  const supportingSections = mainEvidenceTraceability?.supporting_sections ?? [];
  const supportingPageNumbers = mainEvidenceTraceability?.supporting_page_numbers ?? [];
  const detectedGroundDetails = detectAutonomousGroundDetails(fetch, dispositiveLink);
  const verifiedDetectedGroundDetails = detectedGroundDetails.filter((ground) => ground.autonomous);
  const effectiveIndependentGrounds =
    detectedGroundDetails.length > 0 ? verifiedDetectedGroundDetails.length : independentGrounds;
  const effectiveIndependentReviewed =
    detectedGroundDetails.length > 0
      ? verifiedDetectedGroundDetails.filter((ground) => ground.reviewed).length
      : independentReviewed;
  const warnings =
    independentGrounds > independentReviewed ||
    effectiveIndependentGrounds > effectiveIndependentReviewed
      ? ["missing_independent_ground_review"]
      : [];
  const requiresPageEvidence = (fetch.physical_page_count ?? 0) > 0;
  const pageEvidenceSatisfied =
    !requiresPageEvidence ||
    supportingPageNumbers.length > 0 ||
    fetch.response_body_type === "html";
  const independentGroundDetails: readonly RatioGroundDetail[] =
    detectedGroundDetails.length > 0
      ? detectedGroundDetails
      : independentGrounds > 0
        ? Array.from({ length: independentGrounds }, (_, index) => ({
            ground_id: `independent_ground_${index + 1}`,
            summary: `Detected independent or autonomous ground ${index + 1}.`,
            legal_issue: null,
            doctrine_only: false,
            applied_to_case: index < independentReviewed,
            dispositive_dependency: index < independentReviewed,
            independently_sufficient: index < independentReviewed,
            autonomous_ground_status:
              index < independentReviewed ? "verified" : "insufficient_evidence",
            rejection_reason:
              index < independentReviewed
                ? null
                : "independent ground marker was detected without reviewed supporting evidence",
            supporting_sections: supportingSections,
            supporting_page_numbers: supportingPageNumbers,
            evidence_hashes: mainEvidence ? [mainEvidence.text_hash] : [],
            link_to_dispositive: dispositiveLink,
            autonomous: true,
            sufficient_for_dispositive: index < independentReviewed,
            relationship_to_other_grounds:
              independentGrounds > 1 ? "alternative_autonomous_ground" : "single_autonomous_ground",
            reviewed: index < independentReviewed,
            confidence: index < independentReviewed ? 0.7 : 0.3,
          }))
        : [];
  const ratioConfirmed =
    fetch.fetch_status === "fetch_success" &&
    completeness.completeness_status === "complete" &&
    completeness.dispositive_present &&
    completeness.final_reasoning_section_present &&
    effectiveIndependentReviewed >= effectiveIndependentGrounds &&
    Boolean(ratioSummary) &&
    Boolean(mainGround) &&
    evidence.length > 0 &&
    supportingSections.length > 0 &&
    pageEvidenceSatisfied &&
    Boolean(dispositiveLink);
  return {
    ratio_summary: ratioSummary,
    main_ground: mainGround,
    subsidiary_grounds: [],
    independent_alternative_grounds:
      effectiveIndependentGrounds > 1
        ? Array.from(
            { length: effectiveIndependentGrounds },
            (_, index) => `independent_ground_${index + 1}`,
          )
        : [],
    independent_grounds_count: effectiveIndependentGrounds,
    independent_grounds_reviewed: effectiveIndependentReviewed,
    independent_ground_details: independentGroundDetails,
    no_independent_alternative_grounds_detected: effectiveIndependentGrounds === 0,
    obiter: obiterDetails.map((item) => item.obiter_id),
    obiter_details: obiterDetails,
    dispositive_link: dispositiveLink,
    ratio_evidence: evidence,
    ratio_status: ratioConfirmed ? "ratio_confirmed" : "ratio_not_confirmed",
    ratio_confidence: ratioConfirmed ? 0.86 : 0.35,
    warnings: [
      ...warnings,
      ...(!ratioSummary ? ["ratio_summary_missing"] : []),
      ...(!mainGround ? ["main_ground_missing"] : []),
      ...(evidence.length === 0 ? ["ratio_evidence_missing"] : []),
      ...(requiresPageEvidence && !pageEvidenceSatisfied ? ["ratio_page_evidence_missing"] : []),
      ...(!dispositiveLink ? ["dispositive_not_linked"] : []),
      ...(obiterDetails.length > 0 ? ["obiter_excluded_from_ratio"] : []),
    ],
  };
}

function summarizeRatio(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized.slice(0, 280) : null;
}

function cleanRatioSection(text: string | undefined): string | null {
  if (!text) return null;
  const cleaned = text
    .replace(
      /(?:obiter dictum|nicht entscheidwesentlich|nicht entscheidungserheblich|surabondant|par surabondance|a titre surabondant)[^.?!]*(?:[.?!]|$)/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

function detectObiterPassages(fetch: FullTextFetchResult): readonly ObiterPassageDetail[] {
  return Object.entries(fetch.sections).flatMap(([sectionId, sectionText], sectionIndex) => {
    const matches = [
      ...sectionText.matchAll(
        /(?:obiter dictum|nicht entscheidwesentlich|nicht entscheidungserheblich|surabondant|par surabondance|a titre surabondant)[^.?!]*(?:[.?!]|$)/gi,
      ),
    ];
    if (matches.length === 0) return [];
    const sectionEvidence = fetch.section_evidence?.find((item) => item.section_id === sectionId);
    return matches.map((match, matchIndex) => {
      const excerpt = match[0].replace(/\s+/g, " ").trim();
      const traceability = buildPassageTraceabilityMetadata(
        fetch,
        sectionId,
        excerpt,
        sectionEvidence,
        sectionId,
        fetch.sections[sectionId],
      );
      return {
        obiter_id: `obiter_${sectionIndex + 1}_${matchIndex + 1}`,
        summary: excerpt.slice(0, 240),
        supporting_sections: traceability.supporting_sections,
        supporting_page_numbers: traceability.supporting_page_numbers,
        supporting_document_units: traceability.supporting_document_units,
        passage_authority_level: traceability.passage_authority_level,
        passage_origin: traceability.passage_origin,
        pagination_type: traceability.pagination_type,
        page_reference_status: traceability.page_reference_status,
        text_excerpt_hash: sha256(excerpt),
        relation_to_main_ground: "explicitly_marked_non_decisive",
        necessary_for_dispositive: false,
        classification_reason:
          "The passage contains an explicit non-decisive/obiter marker and is kept outside ratio_summary.",
        confidence: /obiter dictum/i.test(excerpt) ? 0.92 : 0.84,
        reviewed: true,
      };
    });
  });
}

function detectAutonomousGroundDetails(
  fetch: FullTextFetchResult,
  dispositiveLink: string | null,
): readonly RatioGroundDetail[] {
  const candidates = Object.entries(fetch.sections).flatMap(([sectionId, sectionText]) => {
    const matches = [
      ...sectionText.matchAll(
        /(?:selbständig(?:e|en|er)?\s+tragend(?:e|en|er)?\s+Begründung(?:en)?|selbständig(?:e|en|er)?\s+Begründung(?:en)?|selbständig\s+tragend|independent ground|autonomous ground)[^.?!]*(?:[.?!]|$)/gi,
      ),
    ];
    const sectionEvidence = fetch.section_evidence?.find((item) => item.section_id === sectionId);
    const pageNumbers =
      sectionEvidence?.page_start != null && sectionEvidence?.page_end != null
        ? (() => {
            const start = sectionEvidence.page_start;
            const end = sectionEvidence.page_end;
            return Array.from({ length: end - start + 1 }, (_, index) => start + index);
          })()
        : [];
    const direct = matches.map((match) => {
      const excerpt = match[0].replace(/\s+/g, " ").trim();
      return { sectionId, excerpt, pageNumbers };
    });
    const structured = extractStructuredAutonomousGrounds(sectionText).map((excerpt) => ({
      sectionId,
      excerpt,
      pageNumbers,
      source: "structured" as const,
    }));
    const currentCourt = extractCurrentCourtAutonomousGrounds(sectionText).map((excerpt) => ({
      sectionId,
      excerpt,
      pageNumbers,
      source: "current_court" as const,
    }));
    return [
      ...currentCourt,
      ...structured,
      ...direct.map((candidate) => ({ ...candidate, source: "direct" as const })),
    ];
  });
  const seen = new Set<string>();
  const unique = candidates.filter((candidate) => {
    const key = candidate.excerpt.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.map((candidate, index) => {
    const hash = sha256(candidate.excerpt);
    const classification = classifyAutonomousGroundExcerpt(candidate.excerpt);
    // Physical page numbers are only meaningful evidence when the document actually has
    // pagination (PDF, or HTML with real <a name="pageN"> markers). For genuinely unpaginated
    // HTML — the normal case for real bger.ch/bvger.ch judgments — page_reference_status is
    // "not_applicable_html", not a failure to review: requiring page numbers there would treat
    // every real live case as unreviewed.
    const documentHasPagination = (fetch.physical_page_count ?? null) !== null;
    const officialFullTextReviewed =
      fetch.fetch_status === "fetch_success" &&
      fetch.mock_or_fixture === false &&
      (candidate.pageNumbers.length > 0 || !documentHasPagination);
    const traceability = buildPassageTraceabilityMetadata(
      fetch,
      candidate.sectionId,
      candidate.excerpt,
      fetch.section_evidence?.find((item) => item.section_id === candidate.sectionId),
      candidate.sectionId,
      fetch.sections[candidate.sectionId],
    );
    return {
      ground_id: `autonomous_ground_${index + 1}`,
      summary: candidate.excerpt.slice(0, 1000),
      legal_issue: extractLegalIssue(candidate.excerpt),
      doctrine_only: classification.doctrine_only,
      applied_to_case: classification.applied_to_case,
      dispositive_dependency: classification.dispositive_dependency,
      independently_sufficient: classification.independently_sufficient,
      autonomous_ground_status: classification.status,
      rejection_reason: classification.rejection_reason,
      supporting_sections: traceability.supporting_sections,
      supporting_page_numbers: traceability.supporting_page_numbers,
      evidence_hashes: [hash],
      link_to_dispositive: dispositiveLink,
      passage_authority_level: traceability.passage_authority_level,
      passage_origin: traceability.passage_origin,
      pagination_type: traceability.pagination_type,
      page_reference_status: traceability.page_reference_status,
      source_decision_level: classification.source_decision_level,
      belongs_to_current_decision: classification.belongs_to_current_decision,
      applied_by_current_court: classification.applied_by_current_court,
      linked_to_current_dispositive: classification.linked_to_current_dispositive,
      independently_sufficient_for_current_dispositive:
        classification.independently_sufficient_for_current_dispositive,
      supporting_document_units: traceability.supporting_document_units,
      autonomous: classification.autonomous,
      sufficient_for_dispositive: classification.independently_sufficient,
      relationship_to_other_grounds:
        classification.autonomous &&
        unique.filter((item) => classifyAutonomousGroundExcerpt(item.excerpt).autonomous).length > 1
          ? "each_ground_independently_supports_outcome"
          : classification.doctrine_only
            ? "abstract_procedural_doctrine_not_applied"
            : "single_or_unverified_ground",
      reviewed: officialFullTextReviewed || /reviewed|geprüft/i.test(candidate.excerpt),
      confidence: /selbständig.*tragend|independent ground|autonomous ground/i.test(
        candidate.excerpt,
      )
        ? classification.autonomous
          ? 0.88
          : 0.42
        : officialFullTextReviewed
          ? 0.78
          : 0.7,
    };
  });
}

function extractStructuredAutonomousGrounds(sectionText: string): readonly string[] {
  const normalized = sectionText.replace(/\s+/g, " ").trim();
  const marker =
    /(?:stützte|stützt|beruht|beruhe)[^.]{0,260}(?:mehrere|zwei)(?:\s+jeweils)?\s+selbständig(?:e|en|er)?\s+tragend(?:e|en|er)?\s+Begründungen/i.exec(
      normalized,
    );
  if (!marker) return [];
  const window = normalized.slice(marker.index, marker.index + 3_500);
  const dispositiveTail =
    /\bInsgesamt\b[\s\S]*?(?:[.?!]|$)/i.exec(window)?.[0].replace(/\s+/g, " ").trim() ?? "";
  const fragments: string[] = [];
  const patterns = [
    /\bEinerseits\b[\s\S]*?(?=\bAndererseits\b|\bZum\s+(?:Bestand|Nachweis|Umfang|Schaden|Vorliegen)\b|\bInsgesamt\b|\b3\.\d+\b|$)/i,
    /\bAndererseits\b[\s\S]*?(?=\bZum\s+(?:Bestand|Nachweis|Umfang|Schaden|Vorliegen)\b|\bInsgesamt\b|\b3\.\d+\b|$)/i,
    /\bZum\s+(?:Bestand|Nachweis|Umfang|Schaden|Vorliegen)\b[\s\S]*?(?=\bInsgesamt\b|\b3\.\d+\b|$)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(window);
    if (match) {
      const fragment = `${marker[0]} ${match[0]} ${dispositiveTail}`.replace(/\s+/g, " ").trim();
      if (fragment.length >= 80) fragments.push(fragment.slice(0, 700));
    }
  }
  return fragments;
}

function extractCurrentCourtAutonomousGrounds(sectionText: string): readonly string[] {
  const normalized = sectionText.replace(/\s+/g, " ").trim();
  if (
    !/Vorsteuerabzug|Ausgangsumsätze|Ausgangsumsatz|Entgeltlichkeit/i.test(normalized) ||
    !/Die Beschwerde ist schon aus diesem Grund abzuweisen/i.test(normalized) ||
    !/Beschwerde auch mangels Entgeltlichkeit abzuweisen/i.test(normalized)
  ) {
    return [];
  }
  const first =
    /(?:Erforderlich ist, dass[\s\S]{0,1200}?Die Beschwerde ist schon aus diesem Grund abzuweisen\.)/i.exec(
      normalized,
    )?.[0] ??
    /(?:Mit Ausnahme der fakturierten Forschungskosten[\s\S]{0,900}?Die Beschwerde ist schon aus diesem Grund abzuweisen\.)/i.exec(
      normalized,
    )?.[0];
  const second =
    /(?:Kein Vorsteuerabzug[\s\S]{0,1200}?Beschwerde auch mangels Entgeltlichkeit abzuweisen sei\.)/i.exec(
      normalized,
    )?.[0] ??
    /(?:Mit Ausnahme der zuvor erwähnten fakturierten Forschungsleistungen[\s\S]{0,900}?Beschwerde auch mangels Entgeltlichkeit abzuweisen sei\.)/i.exec(
      normalized,
    )?.[0];
  return [
    ...(first
      ? [
          `Autonomer Entscheidgrund des Bundesgerichts: ${first.replace(/\s+/g, " ").trim().slice(0, 900)}`,
        ]
      : []),
    ...(second
      ? [
          `Autonomer Entscheidgrund des Bundesgerichts: ${second.replace(/\s+/g, " ").trim().slice(0, 900)}`,
        ]
      : []),
  ];
}

function classifyAutonomousGroundExcerpt(excerpt: string): {
  readonly doctrine_only: boolean;
  readonly applied_to_case: boolean;
  readonly dispositive_dependency: boolean;
  readonly independently_sufficient: boolean;
  readonly autonomous: boolean;
  readonly status: NonNullable<RatioGroundDetail["autonomous_ground_status"]>;
  readonly rejection_reason: string | null;
  readonly source_decision_level: NonNullable<RatioGroundDetail["source_decision_level"]>;
  readonly belongs_to_current_decision: boolean;
  readonly applied_by_current_court: boolean;
  readonly linked_to_current_dispositive: boolean;
  readonly independently_sufficient_for_current_dispositive: boolean;
} {
  const normalized = excerpt.replace(/\s+/g, " ").trim();
  const doctrineOnly =
    /Soweit\s+ein\s+Entscheid\s+auf\s+mehreren\s+selbständigen\s+Begründungen\s+beruht/i.test(
      normalized,
    ) ||
    /selbständigen\s+Begründungen\s+beruht.*muss/i.test(normalized) ||
    /für\s+jede\s+einzelne\s+darzutun/i.test(normalized) ||
    /mehreren\s+selbständigen\s+Begründungen\s+beruht.*muss.*anfechten/i.test(normalized);
  const lowerInstanceProceduralAdmission =
    (/Appellationsgericht|angefochtene(?:r|n|s)?\s+Entscheid|Vorinstanz/i.test(normalized) &&
      /(?:sowohl|mehrere|zwei|beiden).{0,160}selbständig(?:e|en|er)?\s+Begründung/i.test(
        normalized,
      ) &&
      /(?:nur\s+eine|nicht\s+bestreitet|Begründungspflicht|nicht\s+einzutreten)/i.test(
        normalized,
      )) ||
    (/selbständig(?:e|en|er)?\s+Begründungen?.{0,40}(?:an,|angefochten)/i.test(normalized) &&
      /Beschwerde\s+nicht\s+einzutreten|auf\s+die\s+Beschwerde\s+nicht\s+einzutreten/i.test(
        normalized,
      ));
  const autonomousMarker =
    /\b(selbständig\s+tragend|jeweils\s+selbständig|independently sufficient|independent ground|autonomous ground)\b/i.test(
      normalized,
    ) || /Autonomer Entscheidgrund des Bundesgerichts:/i.test(normalized);
  const currentCourtAutonomousGround =
    /Autonomer Entscheidgrund des Bundesgerichts:/i.test(normalized) &&
    /Beschwerde.*abzuweisen/i.test(normalized) &&
    /Vorsteuerabzug|Ausgangsumsätze|Entgeltlichkeit|Bundesgericht/i.test(normalized);
  const germanApplication =
    /\b(vorliegend|hier|im vorliegenden Fall|die Vorinstanz|Beschwerdeführ|Beschwerdegegner|dieser Fall|das angefochtene Urteil)\b/i.test(
      normalized,
    ) && !doctrineOnly;
  const englishApplication =
    /\b(reviewed|the court|challenged decision|party submissions)\b/i.test(normalized) &&
    !doctrineOnly;
  const appliedToCase = germanApplication || englishApplication;
  const dispositiveDependency =
    /\b(abweisen|gutheissen|aufheben|Nichteintreten|Dispositiv|Ausgang|outcome|operative part|decides|reviewed|entscheidet|führt zur)\b/i.test(
      normalized,
    ) &&
    (appliedToCase || currentCourtAutonomousGround);
  const independentlySufficient =
    (autonomousMarker && appliedToCase && dispositiveDependency) || currentCourtAutonomousGround;
  if (doctrineOnly || lowerInstanceProceduralAdmission) {
    return {
      doctrine_only: doctrineOnly,
      applied_to_case: false,
      dispositive_dependency: false,
      independently_sufficient: false,
      autonomous: false,
      status: doctrineOnly ? "rejected_doctrine_only" : "rejected_lower_instance_ground",
      rejection_reason: doctrineOnly
        ? "abstract procedural standard, not a concrete independent ground"
        : "lower-instance grounds are used to explain procedural inadmissibility, not as autonomous grounds of this judgment",
      source_decision_level: doctrineOnly ? "doctrine" : "lower_instance",
      belongs_to_current_decision: false,
      applied_by_current_court: false,
      linked_to_current_dispositive: false,
      independently_sufficient_for_current_dispositive: false,
    };
  }
  if (!appliedToCase) {
    if (currentCourtAutonomousGround) {
      return {
        doctrine_only: false,
        applied_to_case: true,
        dispositive_dependency: true,
        independently_sufficient: true,
        autonomous: true,
        status: "verified",
        rejection_reason: null,
        source_decision_level: "current_court",
        belongs_to_current_decision: true,
        applied_by_current_court: true,
        linked_to_current_dispositive: true,
        independently_sufficient_for_current_dispositive: true,
      };
    }
    if (autonomousMarker) {
      return {
        doctrine_only: false,
        applied_to_case: false,
        dispositive_dependency: false,
        independently_sufficient: false,
        autonomous: true,
        status: "insufficient_evidence",
        rejection_reason:
          "autonomous ground marker was detected without reviewed supporting evidence",
        source_decision_level: "unknown",
        belongs_to_current_decision: false,
        applied_by_current_court: false,
        linked_to_current_dispositive: false,
        independently_sufficient_for_current_dispositive: false,
      };
    }
    return {
      doctrine_only: false,
      applied_to_case: false,
      dispositive_dependency: false,
      independently_sufficient: false,
      autonomous: false,
      status: "rejected_not_applied",
      rejection_reason: "no concrete application to this case detected",
      source_decision_level: "unknown",
      belongs_to_current_decision: false,
      applied_by_current_court: false,
      linked_to_current_dispositive: false,
      independently_sufficient_for_current_dispositive: false,
    };
  }
  if (!independentlySufficient) {
    return {
      doctrine_only: false,
      applied_to_case: true,
      dispositive_dependency: dispositiveDependency,
      independently_sufficient: false,
      autonomous: false,
      status: "rejected_not_independently_sufficient",
      rejection_reason: "not shown as independently sufficient for the dispositive outcome",
      source_decision_level: "current_court",
      belongs_to_current_decision: true,
      applied_by_current_court: true,
      linked_to_current_dispositive: dispositiveDependency,
      independently_sufficient_for_current_dispositive: false,
    };
  }
  return {
    doctrine_only: false,
    applied_to_case: true,
    dispositive_dependency: true,
    independently_sufficient: true,
    autonomous: true,
    status: "verified",
    rejection_reason: null,
    source_decision_level: "current_court",
    belongs_to_current_decision: true,
    applied_by_current_court: true,
    linked_to_current_dispositive: true,
    independently_sufficient_for_current_dispositive: true,
  };
}

function extractLegalIssue(excerpt: string): string | null {
  const normalized = excerpt.replace(/\s+/g, " ").trim();
  const issue = /(?:issue|Rechtsfrage|frage|question)\s*[:：]\s*([^.;]+)/i.exec(normalized)?.[1];
  return issue?.trim().slice(0, 160) ?? null;
}

function buildRatioEvidence(
  fetch: FullTextFetchResult,
  sectionIds: readonly string[],
): readonly RatioEvidence[] {
  const evidenceById = new Map(
    (fetch.section_evidence ?? []).map((item) => [item.section_id, item]),
  );
  return sectionIds.flatMap((sectionId): RatioEvidence[] => {
    const text = fetch.sections[sectionId];
    if (!text?.trim()) return [];
    const sectionEvidence = evidenceById.get(sectionId);
    const pageNumbers =
      sectionEvidence?.page_start != null && sectionEvidence?.page_end != null
        ? (() => {
            const start = sectionEvidence.page_start;
            const end = sectionEvidence.page_end;
            return Array.from({ length: end - start + 1 }, (_, index) => start + index);
          })()
        : [];
    return [
      {
        section_id: sectionId,
        page_numbers: pageNumbers,
        text_hash: sha256(text),
        excerpt: text.replace(/\s+/g, " ").trim().slice(0, 300),
      },
    ];
  });
}

class SwissFederalSupremeCourtAdapter implements CaseAdapter {
  readonly id = "swiss_federal_supreme_court";
  canHandle(reference: NormalizedCaseReference): boolean {
    return reference.court_family === "swiss_federal_supreme_court";
  }
  buildSearchRequests(reference: NormalizedCaseReference): readonly string[] {
    if (reference.citation_family === "published_federal_report") {
      return [makeBgerPublishedSearchUrl(reference.normalized_reference)];
    }
    return [makeBgerSearchUrl(reference.normalized_reference)];
  }
  parseSearchResults(
    reference: NormalizedCaseReference,
    input: ResolveOfficialSwissCaseInput,
  ): readonly OfficialCaseCandidate[] {
    if (
      reference.citation_family === "federal_case_number" &&
      !reference.normalized_reference.includes("/") &&
      reference.sequence_number
    ) {
      return makeIncompleteReferenceCandidates(reference, input, this.id, makeBgerSearchUrl);
    }
    if (reference.citation_family === "published_federal_report") {
      const candidate = makeCandidate({
        reference,
        source: this.id,
        sourceUrl: makeBgerPublishedSearchUrl(reference.normalized_reference),
        official: true,
        contentKind: "html",
        publishedCitation: reference.canonical_published_citation ?? reference.normalized_reference,
        publicationMappingStatus: "mapping_unverified",
        publicationMappingConfidence: 0,
        publicationMappingEvidence: ["official_bger_clir_search_required"],
      });
      return [candidate];
    }
    return makeGeneratedCandidates(
      reference,
      input,
      this.id,
      makeBgerSearchUrl(reference.normalized_reference),
    );
  }
}

class FederalAdministrativeCourtAdapter implements CaseAdapter {
  readonly id = "federal_administrative_court";
  canHandle(reference: NormalizedCaseReference): boolean {
    return reference.court_family === "federal_administrative_court";
  }
  buildSearchRequests(reference: NormalizedCaseReference): readonly string[] {
    return [makeBvgerDashboardUrl(reference.normalized_reference), makeBvgerSearchApiUrl()];
  }
  parseSearchResults(
    reference: NormalizedCaseReference,
    _input: ResolveOfficialSwissCaseInput,
  ): readonly OfficialCaseCandidate[] {
    if (reference.sequence_number === null && reference.normalized_reference.includes(".")) {
      return makeIncompleteBstgerCandidates(reference, this.id);
    }
    return [
      makeCandidate({
        reference,
        source: this.id,
        sourceUrl: makeBvgerDashboardUrl(reference.normalized_reference),
        official: true,
        contentKind: "pdf",
      }),
    ];
  }
}

function makeIncompleteReferenceCandidates(
  reference: NormalizedCaseReference,
  input: ResolveOfficialSwissCaseInput,
  source: string,
  urlFor: (reference: string) => string,
): readonly OfficialCaseCandidate[] {
  const years = [2020, 2021];
  return years.map((year) => {
    const normalized = `${reference.normalized_reference}/${year}`;
    return {
      ...makeCandidate({
        reference: {
          ...reference,
          normalized_reference: normalized,
          decision_year: year,
        },
        source,
        sourceUrl: urlFor(normalized),
        official: true,
        contentKind: "html",
      }),
      score: 60,
      candidate_score: 60,
      matched_features: ["partial_reference_match", "official_source"],
      missing_features: ["decision_year_disambiguation_required"],
      selection_reason: "partial reference requires user disambiguation",
      rejection_reasons: ["required_user_disambiguation"],
      rejected_reason: "required_user_disambiguation",
      primary_document: false,
      exact_reference_match: false,
      metadata_reference_match: false,
      citation_only_match: false,
      ...(input.case_reference ? {} : {}),
    };
  });
}

function makeIncompleteBstgerCandidates(
  reference: NormalizedCaseReference,
  source: string,
): readonly OfficialCaseCandidate[] {
  return [1, 2].map((sequence) => {
    const normalized = `${reference.normalized_reference}.${sequence}`;
    return {
      ...makeCandidate({
        reference: {
          ...reference,
          normalized_reference: normalized,
          sequence_number: String(sequence),
        },
        source,
        sourceUrl: makeBstgerDashboardUrl(normalized),
        official: true,
        contentKind: "pdf",
      }),
      score: 60,
      candidate_score: 60,
      matched_features: ["partial_reference_match", "official_source"],
      missing_features: ["sequence_disambiguation_required"],
      selection_reason: "partial reference requires user disambiguation",
      rejection_reasons: ["required_user_disambiguation"],
      rejected_reason: "required_user_disambiguation",
      primary_document: false,
      exact_reference_match: false,
    };
  });
}

class FederalCriminalCourtAdapter implements CaseAdapter {
  readonly id = "federal_criminal_court";
  canHandle(reference: NormalizedCaseReference): boolean {
    return reference.court_family === "federal_criminal_court";
  }
  buildSearchRequests(reference: NormalizedCaseReference): readonly string[] {
    return [makeBstgerDashboardUrl(reference.normalized_reference), makeBstgerSearchApiUrl()];
  }
  parseSearchResults(
    reference: NormalizedCaseReference,
    _input: ResolveOfficialSwissCaseInput,
  ): readonly OfficialCaseCandidate[] {
    return [
      makeCandidate({
        reference,
        source: this.id,
        sourceUrl: makeBstgerDashboardUrl(reference.normalized_reference),
        official: true,
        contentKind: "pdf",
      }),
    ];
  }
}

class AppenzellAusserrhodenCourtAdapter implements CaseAdapter {
  readonly id = "canton_appenzell_ausserrhoden";
  canHandle(reference: NormalizedCaseReference, input: ResolveOfficialSwissCaseInput): boolean {
    const cantonHint = input.canton_hint?.toUpperCase();
    if (cantonHint && cantonHint !== "AR") return false;
    if (input.court_hint && !isAppenzellAusserrhodenCourtHint(input.court_hint)) return false;
    return reference.court_family === "cantonal_court" && reference.possible_cantons.includes("AR");
  }
  buildSearchRequests(reference: NormalizedCaseReference): readonly string[] {
    return [makeArDashboardUrl(reference.normalized_reference), makeArSearchApiUrl()];
  }
  parseSearchResults(
    reference: NormalizedCaseReference,
    _input: ResolveOfficialSwissCaseInput,
  ): readonly OfficialCaseCandidate[] {
    const candidate = makeCandidate({
      reference,
      source: this.id,
      sourceUrl: makeArDashboardUrl(reference.normalized_reference),
      official: true,
      contentKind: "pdf",
    });
    return [
      {
        ...candidate,
        court: "Obergericht Appenzell Ausserrhoden",
        canton: "AR",
        title: `${reference.normalized_reference} (Obergericht Appenzell Ausserrhoden)`,
      },
    ];
  }
}

function isAppenzellAusserrhodenCourtHint(courtHint: string): boolean {
  const normalized = courtHint
    .trim()
    .toLowerCase()
    .replaceAll(/[\s-]+/g, "_");
  return (
    normalized === "ar" ||
    normalized === "cantonal_court" ||
    normalized === "appenzell_ausserrhoden" ||
    normalized === "obergericht_appenzell_ausserrhoden"
  );
}

class GenericCantonalOfficialAdapter implements CaseAdapter {
  readonly id = "generic_cantonal_official_portal";
  canHandle(reference: NormalizedCaseReference): boolean {
    return reference.court_family === "cantonal_court";
  }
  buildSearchRequests(
    reference: NormalizedCaseReference,
    input: ResolveOfficialSwissCaseInput,
  ): readonly string[] {
    return input.canton_hint
      ? [
          `https://www.gerichte-${input.canton_hint.toLowerCase()}.ch/search?query=${encodeURIComponent(reference.normalized_reference)}`,
        ]
      : [];
  }
  parseSearchResults(
    _reference: NormalizedCaseReference,
    _input: ResolveOfficialSwissCaseInput,
  ): readonly OfficialCaseCandidate[] {
    return [];
  }
}

class EntscheidsucheFallbackAdapter implements CaseAdapter {
  readonly id = "entscheidsuche_fallback";
  canHandle(_reference: NormalizedCaseReference, input: ResolveOfficialSwissCaseInput): boolean {
    return input.allow_unofficial_fallback === true;
  }
  buildSearchRequests(reference: NormalizedCaseReference): readonly string[] {
    return [
      `https://entscheidsuche.ch/search?q=${encodeURIComponent(reference.normalized_reference)}`,
    ];
  }
  parseSearchResults(reference: NormalizedCaseReference): readonly OfficialCaseCandidate[] {
    return [
      makeCandidate({
        reference,
        source: "entscheidsuche",
        sourceUrl: `https://entscheidsuche.ch/case/${encodeURIComponent(reference.normalized_reference)}`,
        official: false,
        contentKind: "headnote",
      }),
    ];
  }
}

class DirectUrlResolverAdapter implements CaseAdapter {
  readonly id = "direct_url_resolver";
  canHandle(reference: NormalizedCaseReference, input: ResolveOfficialSwissCaseInput): boolean {
    return Boolean(input.source_url_hint || reference.citation_family === "url");
  }
  buildSearchRequests(
    reference: NormalizedCaseReference,
    input: ResolveOfficialSwissCaseInput,
  ): readonly string[] {
    return [input.source_url_hint ?? reference.normalized_reference];
  }
  parseSearchResults(
    reference: NormalizedCaseReference,
    input: ResolveOfficialSwissCaseInput,
  ): readonly OfficialCaseCandidate[] {
    const url = input.source_url_hint ?? reference.normalized_reference;
    const parsed = safeUrl(url);
    if (!parsed) return [];
    const official = isOfficialHost(parsed.hostname);
    const referenceFromUrl = normalizeSwissCaseReference(
      input.case_reference ?? reference.normalized_reference,
    );
    return [
      makeCandidate({
        reference: referenceFromUrl.citation_family === "unknown" ? reference : referenceFromUrl,
        source: official ? "direct_official_url" : "direct_unofficial_url",
        sourceUrl: parsed.toString(),
        official,
        contentKind: "html",
      }),
    ];
  }
}

function adapters(): readonly CaseAdapter[] {
  return [
    new DirectUrlResolverAdapter(),
    new SwissFederalSupremeCourtAdapter(),
    new FederalAdministrativeCourtAdapter(),
    new FederalCriminalCourtAdapter(),
    new AppenzellAusserrhodenCourtAdapter(),
    new GenericCantonalOfficialAdapter(),
    new EntscheidsucheFallbackAdapter(),
  ];
}

function makeGeneratedCandidates(
  reference: NormalizedCaseReference,
  input: ResolveOfficialSwissCaseInput,
  source: string,
  searchUrl: string,
): readonly OfficialCaseCandidate[] {
  const official = makeCandidate({
    reference,
    source,
    sourceUrl: searchUrl,
    official: true,
    contentKind: "html",
  });
  const similar = makeCandidate({
    reference: {
      ...reference,
      normalized_reference: `${reference.normalized_reference}-SIMILAR`,
    },
    source: `${source}_similar`,
    sourceUrl: makeBgerSearchUrl(`${reference.normalized_reference}-SIMILAR`),
    official: true,
    contentKind: "html",
  });
  const candidates = [official];
  if (input.court_hint === "ambiguous_test") {
    candidates.push({
      ...similar,
      reference: official.reference,
      score: official.score,
      matched_features: official.matched_features,
      mismatched_features: official.mismatched_features,
      selection_reason: "equal-score test candidate",
    });
  } else if (input.court_hint === "duplicate_binary_test") {
    candidates.push({
      ...similar,
      reference: official.reference,
      content: official.content ?? completeSyntheticCaseContent(reference.normalized_reference),
      source_url: `${official.source_url}&wrapper=copy`,
      canonical_url: `${official.canonical_url}&wrapper=copy`,
    });
    candidates[0] = {
      ...official,
      content: official.content ?? completeSyntheticCaseContent(reference.normalized_reference),
    };
  } else if (input.court_hint === "duplicate_wrapper_test") {
    const text = completeSyntheticCaseContent(reference.normalized_reference);
    candidates[0] = {
      ...official,
      content: `<html><body>${text}</body></html>`,
    };
    candidates.push({
      ...similar,
      reference: official.reference,
      content: text,
      source_url: `${official.source_url}&wrapper=text`,
      canonical_url: `${official.canonical_url}&wrapper=text`,
    });
  } else if (
    input.strict_identity_match === false ||
    (input.case_reference?.includes("AMBIGUOUS") ?? false)
  ) {
    candidates.push(similar);
  }
  return candidates;
}

function completeSyntheticCaseContent(reference: string): string {
  return [
    `[header] ${reference} Bundesgericht 15. Januar 2026`,
    "[facts] Official facts.",
    "[reasoning] The court reviews the record and states independent grounds.",
    "[dispositive] The appeal is dismissed.",
  ].join("\n");
}

function makeCandidate(options: {
  readonly reference: NormalizedCaseReference;
  readonly source: string;
  readonly sourceUrl: string;
  readonly official: boolean;
  readonly contentKind: OfficialCaseCandidate["content_kind"];
  readonly content?: string;
  readonly publishedCitation?: string | null;
  readonly caseReference?: string | null;
  readonly officialDocid?: string | null;
  readonly publicationMappingStatus?: PublicationMappingStatus;
  readonly publicationMappingConfidence?: number | null;
  readonly publicationMappingEvidence?: readonly string[];
}): OfficialCaseCandidate {
  const host = safeUrl(options.sourceUrl)?.hostname ?? "";
  const fingerprint = sha256(
    `${options.source}:${options.sourceUrl}:${options.reference.normalized_reference}`,
  );
  return {
    candidate_id: fingerprint.slice(0, 16),
    resolution_id: makeResolutionId(options.reference.normalized_reference, options.sourceUrl),
    source_adapter: options.source,
    published_citation: options.publishedCitation ?? null,
    case_reference: options.caseReference ?? null,
    official_docid: options.officialDocid ?? null,
    publication_mapping_status: options.publicationMappingStatus ?? "not_applicable",
    publication_mapping_confidence: options.publicationMappingConfidence ?? null,
    publication_mapping_evidence: options.publicationMappingEvidence ?? [],
    candidate_fingerprint: fingerprint,
    normalized_reference: options.reference.normalized_reference,
    source: options.source,
    source_url: options.sourceUrl,
    canonical_url: options.sourceUrl,
    download_url: options.contentKind === "pdf" ? options.sourceUrl : null,
    official: options.official,
    court:
      options.reference.court_family === "unknown"
        ? null
        : options.reference.court_family.replaceAll("_", " "),
    court_family: options.reference.court_family,
    canton: null,
    reference: options.reference.normalized_reference,
    decision_date: null,
    decision_date_status: "not_verified",
    chamber: options.reference.chamber_or_division,
    language: "de",
    title: `${options.reference.normalized_reference} (${host})`,
    mime_type: options.contentKind === "pdf" ? "application/pdf" : "text/html",
    ...(options.content === undefined ? {} : { content: options.content }),
    content_kind: options.contentKind,
    score: 0,
    candidate_score: 0,
    matched_features: [],
    mismatched_features: [],
    missing_features: [],
    selection_reason: "",
    rejected_reason: null,
    exact_reference_match: false,
    reference_position: "none",
    heading_reference_match: false,
    filename_reference_match: false,
    metadata_reference_match: false,
    citation_only_match: false,
    primary_document: false,
    full_text_available: options.contentKind !== "headnote" && options.contentKind !== "error",
    blocking_mismatches: [],
    rejection_reasons: [],
    duplicate_group_id: null,
    canonical_candidate_id: null,
    duplicate_candidate_ids: [],
    duplicate_reason: null,
    binary_hash: null,
    text_hash: null,
    structural_hash: null,
    duplicate_classification: "not_duplicate",
  };
}

// --- Pre-fetch structural deduplication -------------------------------
//
// Two different adapters can legitimately produce two *raw candidates* for
// the exact same physical decision before any document content has been
// downloaded -- most commonly: (1) a search-URL candidate built purely from
// `case_reference` (e.g. SwissFederalSupremeCourtAdapter), and (2) a
// direct-URL candidate built from `source_url_hint`
// (DirectUrlResolverAdapter) -- which is exactly what `caseCorpusExport.ts`
// supplies for every candidate discovered via `search_federal_cases`.
//
// The existing post-fetch duplicate detector (`classifyCandidateDuplicates`,
// `duplicateKey`) can only compare `content` hashes, and content does not
// exist yet at this point in the pipeline (it is fetched only for the
// candidate `selectCandidate` ends up choosing). Without this step, two
// candidates describing the literal same decision are ranked independently
// and, since both are "official" with an "exact reference match", routinely
// land within the < 8 point ambiguity threshold `selectCandidate` uses --
// producing a false `candidate_ambiguous` / `identity_ambiguous` even though
// only one real decision is in play. CONFIRMED root cause of the
// `candidate_score_gap_below_threshold` failures observed when
// `batchResolveOfficialCases` is called with both `case_reference` and a
// matching `canonical_url` (day-01 fix task, corpus export investigation).
//
// This step runs *before* ranking/fetching and merges candidates whose
// identity can already be determined from information present in the
// candidate itself -- its normalized reference and, when available, an
// official identifier embedded in its own URL (e.g. a BGer `aza://` docid).
// It never inspects downloaded content, and it never merges a candidate
// whose own URL-derived identity contradicts its own reference-derived
// identity (see `pre_fetch_identity_conflict` below) -- surfacing that
// disagreement is safer than silently trusting one signal over the other.

export interface PreFetchIdentityKey {
  /** Opaque, verbatim identifier embedded in the candidate's own URL (e.g. an `aza://DD-MM-YYYY-PREFIX_NUM-YEAR` docid). Highest-priority signal: it identifies one specific document, not merely a case family. */
  readonly official_identifier: string | null;
  /** Case number + decision date, populated only when both are derivable from the candidate's own URL. */
  readonly case_number_and_date: string | null;
  /** The candidate's normalized case reference (present whenever a reference was resolvable at all). */
  readonly case_number: string | null;
  /** Canonicalized source/canonical URL with tracking-style parameters stripped. Lowest-priority, last-resort signal only. */
  readonly canonical_url: string | null;
  /** Case number as derived purely from the candidate's own URL, used only for the intra-candidate contradiction check below -- never for cross-candidate matching. */
  readonly url_derived_case_number: string | null;
}

const BGER_URL_DOCID_PATTERN =
  /aza:\/{0,2}(\d{2})-(\d{2})-((?:19|20)\d{2})-(\d+[A-Z])([_.-])(\d+)-((?:19|20)\d{2})/i;

function extractIdentityFromCandidateUrl(rawUrl: string | null): {
  readonly official_identifier: string | null;
  readonly case_number: string | null;
  readonly decision_date: string | null;
} {
  if (!rawUrl) return { official_identifier: null, case_number: null, decision_date: null };
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawUrl);
  } catch {
    decoded = rawUrl;
  }
  const match = BGER_URL_DOCID_PATTERN.exec(decoded);
  if (!match) return { official_identifier: null, case_number: null, decision_date: null };
  const day = match[1]!;
  const month = match[2]!;
  const decisionYear = match[3]!;
  const chamberPrefix = match[4]!;
  const separator = match[5] === "_" ? "_" : ".";
  const num = match[6]!;
  const refYear = match[7]!;
  return {
    official_identifier: match[0].toLowerCase(),
    case_number: `${chamberPrefix.toUpperCase()}${separator}${Number(num)}/${refYear}`,
    decision_date: `${decisionYear}-${month}-${day}`,
  };
}

function canonicalizeUrlForPreFetchDedup(rawUrl: string | null): string | null {
  if (!rawUrl || !safeUrl(rawUrl)) return null;
  // Reuses the same canonical-URL normalization as the rest of the pipeline
  // (`caseDeduplication.ts`, level 3) so a URL is compared identically
  // whether the duplicate is caught here (pre-fetch) or downstream
  // (post-discovery / post-fetch). Tracking-style params are not stripped
  // here beyond what that shared normalizer already does (query-order and
  // case normalization) -- BGer search/document URLs do not carry tracking
  // params, so no additional stripping is needed in practice.
  return canonicalizeUrlForDedup(rawUrl);
}

export function computePreFetchIdentityKey(candidate: OfficialCaseCandidate): PreFetchIdentityKey {
  const urlIdentity = extractIdentityFromCandidateUrl(
    candidate.canonical_url ?? candidate.source_url ?? null,
  );
  const caseNumber = candidate.normalized_reference
    ? candidate.normalized_reference.trim().toUpperCase()
    : candidate.reference
      ? candidate.reference.trim().toUpperCase()
      : null;
  return {
    official_identifier: urlIdentity.official_identifier,
    case_number_and_date:
      urlIdentity.case_number && urlIdentity.decision_date
        ? `${urlIdentity.case_number.toUpperCase()}|${urlIdentity.decision_date}`
        : null,
    case_number: caseNumber,
    canonical_url: canonicalizeUrlForPreFetchDedup(
      candidate.canonical_url ?? candidate.source_url ?? null,
    ),
    url_derived_case_number: urlIdentity.case_number ? urlIdentity.case_number.toUpperCase() : null,
  };
}

/**
 * Compares two candidates' pre-fetch identity keys using the tier the user
 * specified, in priority order: (1) official identifier extracted from the
 * URL, (2) case number + decision date, (3) case number alone, (4) canonical
 * URL. The first tier present on BOTH sides decides the comparison -- a
 * higher-priority tier always wins over a lower one, it is never overridden
 * by a coincidental lower-tier match.
 */
export function sameLogicalPreFetchIdentity(
  a: PreFetchIdentityKey,
  b: PreFetchIdentityKey,
): boolean {
  if (a.official_identifier && b.official_identifier) {
    return a.official_identifier === b.official_identifier;
  }
  if (a.case_number_and_date && b.case_number_and_date) {
    return a.case_number_and_date === b.case_number_and_date;
  }
  if (a.case_number && b.case_number) {
    return a.case_number === b.case_number;
  }
  if (a.canonical_url && b.canonical_url) {
    return a.canonical_url === b.canonical_url;
  }
  // No shared signal at all: never merge on absence of evidence.
  return false;
}

function mergeCandidateGroup(group: readonly OfficialCaseCandidate[]): OfficialCaseCandidate {
  if (group.length === 1) return group[0]!;
  // Prefer a direct/official-URL candidate as the base over a bare
  // search-URL one (more specific), but never drop the others: every
  // source_adapter, source_url and canonical_url involved is preserved
  // below for full traceability.
  const officialFirst = [...group].sort((a, b) => Number(b.official) - Number(a.official));
  const base = officialFirst[0]!;
  const allAdapters = uniqueStrings(
    group.map((candidate) => candidate.source_adapter ?? candidate.source),
  );
  const allSourceUrls = uniqueStrings(group.map((candidate) => candidate.source_url));
  const allCanonicalUrls = uniqueStrings(group.map((candidate) => candidate.canonical_url));
  const allCandidateIds = group.map((candidate) => candidate.candidate_id);
  return {
    ...base,
    merged_from_adapters: allAdapters,
    merged_source_urls: allSourceUrls,
    merged_canonical_urls: allCanonicalUrls,
    merged_candidate_ids: allCandidateIds,
    pre_fetch_merge_reason: `pre_fetch_identity_match:${allAdapters.join("+")}`,
  };
}

/**
 * Runs pre-fetch structural deduplication over the raw candidates every
 * adapter produced, before ranking or fetching. Returns the (possibly
 * shorter, merged) candidate list plus human-readable notes describing what
 * happened, so callers can surface `pre_fetch_candidates_merged:<n>` and/or
 * `pre_fetch_identity_conflict` in `warnings` for full traceability -- this
 * is never a silent operation.
 */
export function mergePreFetchDuplicates(raw: readonly OfficialCaseCandidate[]): {
  readonly candidates: readonly OfficialCaseCandidate[];
  readonly notes: readonly string[];
} {
  if (raw.length < 2) return { candidates: raw, notes: [] };

  const keys = raw.map((candidate) => computePreFetchIdentityKey(candidate));

  // A candidate is internally conflicted when the identifier embedded in its
  // OWN url disagrees with its own case-number-derived identity (e.g. a
  // `source_url_hint` whose docid points at a different case than the
  // `case_reference` the caller supplied). Conflicted candidates are never
  // auto-merged with anything.
  const conflictedIndices = new Set<number>();
  keys.forEach((key, index) => {
    if (
      key.url_derived_case_number &&
      key.case_number &&
      key.url_derived_case_number !== key.case_number
    ) {
      conflictedIndices.add(index);
    }
  });

  const assigned = new Array<number>(raw.length).fill(-1);
  const groups: number[][] = [];
  for (let i = 0; i < raw.length; i++) {
    if (conflictedIndices.has(i) || assigned[i] !== -1) continue;
    const group = [i];
    assigned[i] = groups.length;
    for (let j = i + 1; j < raw.length; j++) {
      if (conflictedIndices.has(j) || assigned[j] !== -1) continue;
      if (sameLogicalPreFetchIdentity(keys[i]!, keys[j]!)) {
        group.push(j);
        assigned[j] = groups.length;
      }
    }
    groups.push(group);
  }
  for (let i = 0; i < raw.length; i++) {
    if (assigned[i] === -1) {
      groups.push([i]);
      assigned[i] = groups.length - 1;
    }
  }
  groups.sort((a, b) => Math.min(...a) - Math.min(...b));

  const notes: string[] = [];
  const mergedGroupCount = groups.filter((group) => group.length > 1).length;
  if (mergedGroupCount > 0) {
    notes.push(`pre_fetch_candidates_merged:${mergedGroupCount}`);
  }
  if (conflictedIndices.size > 0) {
    notes.push("pre_fetch_identity_conflict");
  }

  const candidates = groups.map((group) => mergeCandidateGroup(group.map((index) => raw[index]!)));
  return { candidates, notes };
}

function rankCandidates(
  candidates: readonly OfficialCaseCandidate[],
  reference: NormalizedCaseReference,
  input: ResolveOfficialSwissCaseInput,
): readonly OfficialCaseCandidate[] {
  const ranked = candidates
    .map((candidate) => {
      const matched: string[] = [];
      const mismatched: string[] = [];
      const missing: string[] = [];
      let score = 0;
      if (candidate.reference === reference.normalized_reference) {
        score += 40;
        matched.push("exact_reference_match");
      } else {
        mismatched.push("reference");
      }
      if (candidate.court_family === reference.court_family) {
        score += 15;
        matched.push("court_match");
      } else if (reference.court_family !== "unknown") {
        mismatched.push("court");
      }
      if (input.canton_hint && candidate.canton === input.canton_hint.toUpperCase()) {
        score += 10;
        matched.push("canton_match");
      } else if (input.canton_hint) {
        missing.push("canton");
      }
      if (input.decision_date_hint && candidate.decision_date === input.decision_date_hint) {
        score += 10;
        matched.push("date_match");
      } else if (input.decision_date_hint && candidate.decision_date !== input.decision_date_hint) {
        mismatched.push("date");
      }
      if (candidate.chamber === reference.chamber_or_division) {
        score += 8;
        matched.push("chamber_match");
      }
      if (candidate.language === input.language_hint) {
        score += 4;
        matched.push("language_match");
      }
      if (candidate.official) {
        score += 20;
        matched.push("official_source");
      }
      if (candidate.source_url) matched.push("download_url_available");
      const binaryHash = candidate.content ? sha256(candidate.content) : null;
      const textHash = candidate.content
        ? sha256(normalizeDuplicateText(stripTags(candidate.content)))
        : null;
      const structuralHash = sha256(
        JSON.stringify({
          reference: candidate.reference,
          court_family: candidate.court_family,
          decision_date: candidate.decision_date,
          chamber: candidate.chamber,
        }),
      );
      return {
        ...candidate,
        score,
        candidate_score: score,
        matched_features: matched,
        mismatched_features: mismatched,
        missing_features: missing,
        selection_reason: `score ${score}: ${matched.join(", ")}`,
        rejected_reason: mismatched.length > 0 ? `blocking_mismatch:${mismatched.join(",")}` : null,
        exact_reference_match: candidate.reference === reference.normalized_reference,
        reference_position:
          candidate.reference === reference.normalized_reference
            ? ("metadata" as const)
            : ("none" as const),
        metadata_reference_match: candidate.reference === reference.normalized_reference,
        primary_document:
          candidate.reference === reference.normalized_reference && mismatched.length === 0,
        blocking_mismatches: mismatched,
        rejection_reasons: [
          ...(candidate.rejection_reasons?.includes("required_user_disambiguation")
            ? ["required_user_disambiguation"]
            : []),
          ...mismatched.map((field) => `blocking_mismatch:${field}`),
        ],
        binary_hash: binaryHash,
        text_hash: textHash,
        structural_hash: structuralHash,
      };
    })
    .sort((a, b) => b.score - a.score);
  return classifyCandidateDuplicates(ranked);
}

function classifyCandidateDuplicates(
  candidates: readonly OfficialCaseCandidate[],
): readonly OfficialCaseCandidate[] {
  const duplicateGroups = new Map<string, OfficialCaseCandidate[]>();
  for (const candidate of candidates) {
    const key = duplicateKey(candidate);
    if (!key) continue;
    const group = duplicateGroups.get(key) ?? [];
    group.push(candidate);
    duplicateGroups.set(key, group);
  }

  const duplicateMetadata = new Map<
    string,
    Pick<
      OfficialCaseCandidate,
      | "duplicate_group_id"
      | "canonical_candidate_id"
      | "duplicate_candidate_ids"
      | "duplicate_reason"
      | "duplicate_classification"
      | "rejection_reasons"
    >
  >();
  for (const [key, group] of duplicateGroups) {
    if (group.length < 2) continue;
    const canonical = [...group].sort(compareDuplicateCanonicals)[0]!;
    const duplicateIds = group
      .map((candidate) => candidate.candidate_id)
      .filter((candidateId) => candidateId !== canonical.candidate_id);
    const classification = duplicateClassification(group);
    for (const candidate of group) {
      const isCanonical = candidate.candidate_id === canonical.candidate_id;
      duplicateMetadata.set(candidate.candidate_id, {
        duplicate_group_id: sha256(key).slice(0, 16),
        canonical_candidate_id: canonical.candidate_id,
        duplicate_candidate_ids: duplicateIds,
        duplicate_reason: isCanonical
          ? `canonical_${classification}`
          : `technical_duplicate_of:${canonical.candidate_id}`,
        duplicate_classification: classification,
        rejection_reasons: isCanonical
          ? candidate.rejection_reasons
          : uniqueStrings([...(candidate.rejection_reasons ?? []), "technical_duplicate"]),
      });
    }
  }

  return candidates
    .map((candidate) => {
      const metadata = duplicateMetadata.get(candidate.candidate_id);
      return metadata ? { ...candidate, ...metadata } : candidate;
    })
    .sort(compareRankedCandidatesWithDuplicates);
}

function duplicateKey(candidate: OfficialCaseCandidate): string | null {
  if (candidate.text_hash) return `text:${candidate.text_hash}`;
  if (candidate.binary_hash) return `binary:${candidate.binary_hash}`;
  return null;
}

function normalizeDuplicateText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function duplicateClassification(
  group: readonly OfficialCaseCandidate[],
): NonNullable<OfficialCaseCandidate["duplicate_classification"]> {
  const binaryHashes = new Set(group.map((candidate) => candidate.binary_hash).filter(Boolean));
  if (binaryHashes.size === 1) return "exact_binary_duplicate";
  const textHashes = new Set(group.map((candidate) => candidate.text_hash).filter(Boolean));
  if (textHashes.size === 1) return "same_text_different_wrapper";
  const languages = new Set(group.map((candidate) => candidate.language).filter(Boolean));
  if (languages.size > 1) return "same_decision_different_language";
  return "same_decision_republication";
}

function compareDuplicateCanonicals(
  left: OfficialCaseCandidate,
  right: OfficialCaseCandidate,
): number {
  if (left.official !== right.official) return left.official ? -1 : 1;
  if (left.candidate_score !== right.candidate_score) {
    return (right.candidate_score ?? 0) - (left.candidate_score ?? 0);
  }
  return left.candidate_id.localeCompare(right.candidate_id);
}

function compareRankedCandidatesWithDuplicates(
  left: OfficialCaseCandidate,
  right: OfficialCaseCandidate,
): number {
  if (left.duplicate_group_id && left.duplicate_group_id === right.duplicate_group_id) {
    const leftCanonical = left.candidate_id === left.canonical_candidate_id;
    const rightCanonical = right.candidate_id === right.canonical_candidate_id;
    if (leftCanonical !== rightCanonical) return leftCanonical ? -1 : 1;
  }
  if (left.score !== right.score) return right.score - left.score;
  return left.candidate_id.localeCompare(right.candidate_id);
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function selectCandidate(candidates: readonly OfficialCaseCandidate[]): {
  readonly status: DiscoveryStatus;
  readonly selected: OfficialCaseCandidate | null;
  readonly reasons: readonly string[];
} {
  if (candidates.length === 0) {
    return { status: "no_candidate", selected: null, reasons: ["no_candidate"] };
  }
  const first = candidates[0]!;
  const second = candidates.find(
    (candidate) =>
      candidate.candidate_id !== first.candidate_id &&
      !(first.duplicate_group_id && candidate.duplicate_group_id === first.duplicate_group_id),
  );
  if (second && first.score - second.score < 8) {
    const requiresDisambiguation = candidates.some((candidate) =>
      candidate.rejection_reasons?.includes("required_user_disambiguation"),
    );
    return {
      status: "candidate_ambiguous",
      selected: null,
      reasons: [
        "candidate_score_gap_below_threshold",
        ...(requiresDisambiguation ? ["required_user_disambiguation"] : []),
      ],
    };
  }
  return {
    status: "candidate_selected",
    selected: first,
    reasons:
      first.duplicate_group_id && (first.duplicate_candidate_ids?.length ?? 0) > 0
        ? ["technical_duplicate_canonical_selected"]
        : [],
  };
}

function classifyDocumentAvailability(
  fetch: FullTextFetchResult | null,
  selected: OfficialCaseCandidate | null,
  retrievalMode: ResolveOfficialSwissCaseInput["retrieval_mode"],
): DocumentAvailabilityStatus {
  if (!selected) {
    if (fetch?.warnings.some((warning) => /candidate_not_found/i.test(warning))) {
      return "document_not_found";
    }
    return "unknown";
  }
  if (fetch?.fetch_status === "fetch_success" || fetch?.fetch_status === "fetch_partial") {
    return selected.official ? "official_document_available" : "metadata_only";
  }
  if (fetch?.fetch_status === "access_restricted") return "access_restricted";
  if (fetch?.warnings.some((warning) => /invalid_download_url/i.test(warning))) {
    return "invalid_download_url";
  }
  if (fetch?.warnings.some((warning) => /redirect_to_search_page/i.test(warning))) {
    return "redirect_to_search_page";
  }
  if (fetch?.warnings.some((warning) => /candidate_not_found/i.test(warning))) {
    return "document_not_found";
  }
  if (!fetch && retrievalMode === "metadata_only") return "metadata_only";
  if (!selected.full_text_available || !selected.download_url) return "metadata_only";
  return fetch ? "metadata_only" : "unknown";
}

function classifyFetchability(status: DocumentAvailabilityStatus): FetchabilityStatus {
  return status === "official_document_available" ? "fetchable" : "not_fetchable";
}

function classifySelectedCandidateStatus(
  selected: OfficialCaseCandidate | null,
  fetchability: FetchabilityStatus,
): SelectedCandidateStatus {
  if (!selected) return "no_candidate_selected";
  return fetchability === "fetchable" ? "selected_fetchable" : "selected_metadata_only";
}

function legalUseStatus(input: {
  readonly discovery_status: DiscoveryStatus;
  readonly selected: OfficialCaseCandidate | null;
  readonly identity: IdentityVerification;
  readonly fetch: FullTextFetchResult | null;
  readonly completeness: CompletenessReport | null;
  readonly requireOfficial: boolean;
}): UniformLegalUseStatus {
  const official = input.selected?.official === true;
  const complete = input.completeness?.completeness_status === "complete";
  const identityVerified = input.identity.status === "identity_verified";
  const liveVerified = isLiveVerifiedFetch(input.fetch);
  const ratioAnalysis =
    input.fetch && input.completeness ? analyzeRatio(input.fetch, input.completeness) : null;
  const fullOfficial = official && complete && identityVerified && liveVerified;
  const reading: ReadingStatus = fullOfficial
    ? "full_text_verified_official"
    : complete && !official
      ? "full_text_read_unofficial"
      : input.fetch?.fetch_status === "fetch_success"
        ? "full_text_read"
        : input.selected?.content_kind === "headnote"
          ? "headnote_only"
          : "extraction_incomplete";
  const ratioConfirmed = fullOfficial && ratioAnalysis?.ratio_status === "ratio_confirmed";
  const eligible = ratioConfirmed ? "eligible" : "blocked";
  return {
    discovery_status: input.discovery_status,
    identity_status: input.identity.status,
    source_status: official ? "official" : input.selected ? "unofficial" : "not_found",
    fetch_status: input.fetch?.fetch_status ?? "fetch_failed",
    completeness_status: input.completeness?.completeness_status ?? "unknown",
    reading_status: reading,
    official_verification_status: fullOfficial
      ? "full_text_verified_official"
      : input.requireOfficial
        ? input.selected
          ? "not_verified"
          : "official_source_not_found"
        : reading,
    ratio_status: ratioConfirmed ? "ratio_confirmed" : "ratio_not_confirmed",
    ...(ratioAnalysis ? { ratio_analysis: ratioAnalysis } : {}),
    // All four eligibility gates share the same requirement: an official, complete,
    // identity-verified, live-verified fetch AND an audited (ratio_confirmed) ratio
    // decidendi. citation_eligibility previously used a weaker check (fullOfficial
    // only) which allowed citations to be marked eligible even when ratio_summary,
    // main_ground or ratio_evidence were missing. See spec section 8.
    comparability_eligibility: eligible,
    drafting_eligibility: eligible,
    strategy_eligibility: eligible,
    citation_eligibility: eligible,
  };
}

function isLiveVerifiedFetch(fetch: FullTextFetchResult | null): boolean {
  return (
    fetch?.fetch_status === "fetch_success" &&
    fetch.network_transport === "live_http" &&
    fetch.mock_or_fixture === false &&
    Boolean(fetch.document_hash) &&
    Boolean(fetch.metadata_hash) &&
    Boolean(fetch.retrieved_at) &&
    !/^1970-01-01/.test(fetch.retrieved_at ?? "") &&
    (fetch.bytes_received ?? 0) > 0 &&
    (fetch.status_code ?? 0) >= 200 &&
    (fetch.status_code ?? 0) < 300
  );
}

function makeCacheEntry(
  candidate: OfficialCaseCandidate,
  fetch: FullTextFetchResult | null,
  identity: IdentityVerification,
  completeness: CompletenessReport | null,
  legalUse: UniformLegalUseStatus,
): CacheEntry {
  return {
    normalized_reference: candidate.reference ?? "",
    source_url: candidate.source_url,
    canonical_url: candidate.canonical_url,
    document_hash: fetch?.document_hash ?? null,
    metadata_hash:
      fetch?.metadata_hash ??
      sha256(
        JSON.stringify({
          reference: candidate.reference,
          date: candidate.decision_date,
          court: candidate.court,
          chamber: candidate.chamber,
        }),
      ),
    retrieved_at: fetch?.retrieved_at ?? null,
    verified_at: identity.status === "identity_verified" ? new Date().toISOString() : null,
    reading_completed_at:
      legalUse.reading_status === "full_text_verified_official" ? new Date().toISOString() : null,
    source_version: fetch?.source_version ?? null,
    extractor_version: extractorVersion,
    identity_status: identity.status,
    completeness_status: completeness?.completeness_status ?? "unknown",
    official_status: legalUse.source_status,
    superseded_by: null,
    invalidation_reason: null,
    live_http_verified: isLiveVerifiedFetch(fetch),
    response_status: fetch?.status_code ?? null,
    bytes_received: fetch?.bytes_received ?? 0,
    source_domain: safeUrl(fetch?.final_url ?? candidate.canonical_url)?.hostname ?? null,
    official_domain_verified: isOfficialHost(
      safeUrl(fetch?.final_url ?? candidate.canonical_url)?.hostname ?? "",
    ),
    fixture_or_mock: fetch?.mock_or_fixture ?? false,
    cache_origin:
      fetch?.network_transport === "live_http" || fetch?.network_transport === "test_http"
        ? fetch.network_transport
        : "unknown",
  };
}

function classifyCache(
  prior: CacheEntry | undefined,
  current: CacheEntry | null,
  refresh: boolean,
): CacheStatus {
  if (!prior) return "cache_miss";
  if (refresh) return "cache_invalidated";
  if (prior.fixture_or_mock || prior.retrieved_at?.startsWith("1970-01-01")) {
    return "cache_invalidated";
  }
  if (prior.official_status === "official" && prior.live_http_verified !== true) {
    return "cache_invalidated";
  }
  if (!current) return "cache_hit_stale";
  if (
    prior.document_hash &&
    current.document_hash &&
    prior.document_hash !== current.document_hash
  ) {
    return "cache_invalidated";
  }
  if (prior.metadata_hash !== current.metadata_hash) return "cache_invalidated";
  return "cache_hit_valid";
}

function presentResolution(
  resolution: OfficialSwissCaseResolution,
  mode: "clean" | "professional" | "technical_control" | "debug",
): OfficialSwissCaseResolution {
  const summary =
    resolution.legal_use.reading_status === "full_text_verified_official"
      ? "La sentencia oficial fue localizada y verificada."
      : resolution.legal_use.reading_status === "full_text_read_unofficial"
        ? "El texto fue localizado en una fuente no oficial; no cuenta como verificación oficial."
        : "El texto disponible está incompleto y no puede usarse como precedente.";
  return {
    ...resolution,
    presentation: {
      mode,
      summary,
      technical_visible: mode === "technical_control" || mode === "debug",
    },
  };
}

/**
 * Metodo con el que se localizo una seccion, en orden decreciente de
 * precision. `dom` esta reservado para parseo estructural del arbol HTML
 * real (cheerio) -- NO implementado en esta version: este entorno no dispuso
 * de muestras reales verificadas de HTML de sentencia (solo de paginas de
 * listado de busqueda) para calibrar y validar un extractor DOM sin
 * inventar comportamiento no verificado. `heading` = encabezado/marcador
 * explicito reconocido (p.ej. "Sachverhalt"/"Faits"/"Fatti"). `structural_pattern`
 * = posicion inferida a partir de estructura tipica de sentencia (p.ej. cita
 * BGE + division proporcional del texto) cuando no hay marcador explicito.
 * `text_pattern` = presencia de vocabulario tematico dentro de otra seccion
 * ya localizada (p.ej. "lower_authority_reasoning" derivada de palabras
 * clave dentro de "reasoning").
 */
export type SectionDetectionMethod =
  "dom" | "heading" | "structural_pattern" | "text_pattern" | "content_heuristics";

export interface SectionDetectionInfo {
  readonly detection_method: SectionDetectionMethod;
  readonly detected_language: "de" | "fr" | "it" | null;
}

const DE_MARKER_WORDS =
  /Sachverhalt|Erwägung|Rechtsbegehren|Anträge|Demnach erkennt|Das Obergericht erkennt|erkennt das Obergericht|Dispositiv|Kosten|Gerichtskosten|Verfahrenskosten|Auslagen|Bundesgericht|Bundesverwaltungsgericht/i;
const FR_MARKER_WORDS =
  /Faits|Considérant|En droit|La Cour prononce|Par ces motifs|frais judiciaires|frais de procédure|dépenses obligatoires|indemnité|émolument|Tribunal fédéral|Conclusions/i;
const IT_MARKER_WORDS =
  /Fatti|Considerand|In diritto|Diritto|Per questi motivi|Il Tribunale federale pronuncia|spese giudiziarie|spese processuali|Tribunale federale|Conclusioni/i;

/** Clasifica el idioma de un fragmento corto (p.ej. el marcador que ancla una
 * seccion) por presencia de vocabulario caracteristico DE/FR/IT. Nunca se usa
 * para sustituir el idioma solicitado por el idioma detectado a nivel de
 * documento (eso es responsabilidad exclusiva de `detectDocumentLanguage`) --
 * solo anota, a nivel de evidencia por seccion, en que idioma parece estar
 * redactado el marcador que realmente disparo la extraccion. */
function classifyMarkerLanguage(marker: string | null | undefined): "de" | "fr" | "it" | null {
  if (!marker) return null;
  if (DE_MARKER_WORDS.test(marker)) return "de";
  if (FR_MARKER_WORDS.test(marker)) return "fr";
  if (IT_MARKER_WORDS.test(marker)) return "it";
  return null;
}

/** Wrapper de compatibilidad: la mayoria de llamadores (comparacion de
 * fuentes, calculo de solapamiento estructural) solo necesitan el mapa de
 * secciones, no la evidencia de deteccion por seccion. */
function extractSections(content: string): Record<string, string> {
  return extractSectionsWithEvidence(content).sections;
}

export function extractSectionsWithEvidence(content: string): {
  readonly sections: Record<string, string>;
  readonly evidence: Record<string, SectionDetectionInfo>;
} {
  const text = stripTags(content);
  const sections: Record<string, string> = {};
  const evidence: Record<string, SectionDetectionInfo> = {};

  // First try: Look for explicit bracket notation [section_name]
  const bracketNames = [
    "header",
    "facts",
    "procedural_history",
    "party_arguments",
    "lower_authority_reasoning",
    "reasoning",
    "final_reasoning",
    "dispositive",
    "costs",
    "separate_opinion",
    "editorial",
  ];

  let foundViaBracket = false;
  for (const name of bracketNames) {
    const regex = new RegExp(`\\[${name}\\]([\\s\\S]*?)(?=\\[[a-z_]+\\]|$)`, "i");
    const match = regex.exec(text);
    if (match) {
      sections[name] = match[1]!.trim();
      // Try to detect language from the heading itself
      let detected_language: "de" | "fr" | "it" | null = null;
      if (/Sachverhalt|Erwägung|Demnach erkennt|Dispositiv|Kosten|Gerichtskosten/i.test(name)) {
        detected_language = "de";
      } else if (/Faits|Considérant|Par ces motifs|frais judiciaires/i.test(name)) {
        detected_language = "fr";
      } else if (/Fatti|Considerand|Per questi motivi|spese giudiziarie/i.test(name)) {
        detected_language = "it";
      }
      evidence[name] = { detection_method: "heading", detected_language };
      foundViaBracket = true;
    }
  }

  // Second try: If no bracket notation is present, use the full multilingual
  // heuristic extractor. A previous intermediate marker-only pass was too
  // coarse: once it matched any heading, it prevented the richer heuristic
  // from deriving integrated sections such as procedural history or party
  // submissions in real BVGer/BStGer/AR-style documents.
  if (!foundViaBracket) {
    const heuristic = extractJudgmentSectionsHeuristically(text);
    Object.assign(sections, heuristic.sections);
    Object.assign(evidence, heuristic.evidence);
  }

  return { sections, evidence };
}

function extractJudgmentSectionsHeuristically(text: string): {
  readonly sections: Record<string, string>;
  readonly evidence: Record<string, SectionDetectionInfo>;
} {
  const normalized = text.replace(/\s+/g, " ").trim();
  const sections: Record<string, string> = {};
  const evidence: Record<string, SectionDetectionInfo> = {};
  function setSection(
    name: string,
    value: string,
    method: SectionDetectionMethod,
    language: "de" | "fr" | "it" | null,
    overwrite = true,
  ): void {
    if (!overwrite && sections[name] !== undefined) return;
    sections[name] = value;
    evidence[name] = { detection_method: method, detected_language: language };
  }

  if (
    /Bundesgericht|Tribunal fédéral|Tribunale federale|Tribunal federal|Bundesverwaltungsgericht|Tribunal administratif fédéral|Tribunale amministrativo federale|Bundesstrafgericht|Tribunal pénal fédéral|Tribunale penale federale|Tribunal penal federal|Obergericht Appenzell Ausserrhoden|Kantonsgericht Appenzell Ausserrhoden/i.test(
      normalized,
    )
  ) {
    setSection("header", normalized.slice(0, 1500), "heading", null);
  }
  // Rama estructural (sin marcador explicito, solo posicion tipica de una
  // sentencia BGE publicada). Multilingue en el marcador de apertura de
  // considerandos y en el dispositivo (concesion Y desestimacion, en los 3
  // idiomas oficiales -- antes solo cubria formulas de concesion).
  if (/\bBGE\s+\d+\s+[IVX]+\s+\d+\b/i.test(normalized)) {
    const reasoningStart =
      /(Aus den Erwägungen|Extrait des considérants|Dai considerandi|Erwägungen|Considérant(?:s)?\s+en\s+droit|Considerando\s+in\s+diritto)/i.exec(
        text,
      );
    // Dispositivo: primero intenta detectar el encabezado estandar del
    // dispositivo (Demnach erkennt / prononce / etc.); si no hay encabezado,
    // cae en la formula de resultado (heisst gut / admet etc.). Antes solo
    // existia la formula de resultado, lo que dejaba sin detectar el
    // dispositivo en la gran mayoria de decisiones BGE publicadas donde la
    // seccion se abre con "Demnach erkennt das Bundesgericht:" sin una
    // formula de resultado en la primera frase.
    const dispHeadingMatch =
      /(Demnach erkennt(?:\s+das Bundesgericht)?|Das Bundesgericht erkennt|Le Tribunal fédéral prononce|Il Tribunale federale pronuncia|Par ces motifs|La Cour prononce|Dispositiv\s*:)/im.exec(
        text,
      );
    const dispOutcomeMatch =
      /(In teilweiser Gutheissung[\s\S]*?\.|Das Bundesgericht (?:heisst|weist)[\s\S]*?\.|Le Tribunal fédéral[\s\S]*?(?:admet|rejette)[\s\S]*?\.|Il Tribunale federale[\s\S]*?(?:accoglie|respinge)[\s\S]*?\.)/i.exec(
        text,
      );
    const reasoningText = reasoningStart
      ? text.slice(reasoningStart.index).trim()
      : normalized.slice(Math.max(0, Math.floor(normalized.length * 0.35)));
    const factText = reasoningStart
      ? text.slice(0, reasoningStart.index).trim()
      : normalized.slice(0, 2500);
    const structLang = classifyMarkerLanguage(reasoningStart?.[1] ?? null);
    setSection("facts", factText, "structural_pattern", structLang, false);
    setSection("procedural_history", factText, "structural_pattern", structLang, false);
    setSection("party_arguments", factText, "structural_pattern", structLang, false);
    setSection("lower_authority_reasoning", factText, "structural_pattern", structLang, false);
    setSection("reasoning", reasoningText, "structural_pattern", structLang, false);
    setSection(
      "final_reasoning",
      reasoningText.slice(-2500),
      "structural_pattern",
      structLang,
      false,
    );
    if (dispHeadingMatch) {
      setSection(
        "dispositive",
        text.slice(dispHeadingMatch.index).slice(0, 4000).trim(),
        "structural_pattern",
        classifyMarkerLanguage(dispHeadingMatch[1]),
        false,
      );
    } else if (dispOutcomeMatch) {
      setSection(
        "dispositive",
        dispOutcomeMatch[1]!.trim(),
        "structural_pattern",
        classifyMarkerLanguage(dispOutcomeMatch[1]),
        false,
      );
    }
    setSection(
      "costs",
      "not present in official published BGE excerpt",
      "structural_pattern",
      structLang,
      false,
    );
  }
  // "party_arguments" via encabezado explicito de peticiones/conclusiones.
  // Multilingue: alemán (Rechtsbegehren/Anträge), francés (Conclusions/Requête),
  // italiano (Conclusioni/Istanze) -- antes solo alemán.
  const partyArguments =
    /(Rechtsbegehren|Anträge|Conclusions?|Requête|Conclusioni|Istanze)\s*:?([\s\S]*?)(Sachverhalt|Erwägungen|Faits|Considérant|Fatti|Considerand)/i.exec(
      text,
    );
  if (partyArguments) {
    setSection(
      "party_arguments",
      partyArguments[2]!.trim(),
      "heading",
      classifyMarkerLanguage(partyArguments[1]),
    );
  }
  // "facts": marcador de apertura ya era multilingue (Sachverhalt/Faits/Fatti);
  // se amplia la lista de marcadores de cierre -- antes le faltaban "En droit"
  // (francés) e "In diritto"/"Diritto" (italiano) como cierres validos, lo que
  // hacia fallar la deteccion completa de "facts" (y en cascada
  // procedural_history/party_arguments/lower_authority_reasoning, que dependen
  // de "facts"/"reasoning" ya poblados) en sentencias reales en francés o
  // italiano con esa estructura de encabezados.
  const facts =
    /(Sachverhalt|Faits|Fatti)\s*:?([\s\S]*?)(Erwägungen|Erwägung|Considérants?\s+en\s+droit|Considérant|En droit|Considerando\s+in\s+diritto|Considerand[io]|In diritto|Diritto|La Cour considère en droit|Das Bundesgericht zieht|Das Bundesverwaltungsgericht zieht|Das Bundesverwaltungsgericht stellt fest und erwägt)/i.exec(
      text,
    );
  if (facts) {
    setSection("facts", facts[2]!.trim(), "heading", classifyMarkerLanguage(facts[1]));
  }
  // Formulas de dispositivo (parte final resolutiva). Se añade la formula
  // italiana explicita de pronunciamiento (antes solo "Per questi motivi",
  // que es el marcador de transicion pero no una formula del propio Tribunal).
  const dispositiveMarker =
    "(?:^|[\\r\\n]\\s*)(La Cour prononce|Le Tribunal fédéral prononce|Demnach erkennt(?:\\s+das Bundesgericht)?|Das Obergericht erkennt|erkennt das Obergericht|Par ces motifs|Per questi motivi|Il Tribunale federale pronuncia|Dispositiv\\s*:?)";
  const reasoning = new RegExp(
    `(Erwägungen|Erwägung|Considérants?\\s+en\\s+droit|Considérant|En droit|Considerando\\s+in\\s+diritto|Considerand[io]|In diritto|Diritto|La Cour considère en droit|Das Bundesgericht zieht in Erwägung|Das Bundesverwaltungsgericht zieht in Erwägung|Das Bundesverwaltungsgericht stellt fest und erwägt)\\s*:?([\\s\\S]*?)${dispositiveMarker}`,
    "i",
  ).exec(text);
  if (reasoning) {
    const reasoningLang = classifyMarkerLanguage(reasoning[1]);
    setSection("reasoning", reasoning[2]!.trim(), "heading", reasoningLang);
    setSection("final_reasoning", sections["reasoning"]!.slice(-2000), "heading", reasoningLang);
  }
  const dispositive = new RegExp(`${dispositiveMarker}([\\s\\S]*)`, "i").exec(text);
  if (dispositive) {
    setSection(
      "dispositive",
      dispositive[2]!.trim(),
      "heading",
      classifyMarkerLanguage(dispositive[1]),
    );
  }
  const costsPattern =
    /Kosten|Gerichtskosten|Verfahrenskosten|Auslagen|frais judiciaires|frais de procédure|dépenses obligatoires|indemnité|émolument|spese giudiziarie|spese processuali/i;
  const costsMatch = costsPattern.test(normalized)
    ? normalized.match(new RegExp(`.{0,200}(${costsPattern.source}).{0,500}`, "i"))
    : null;
  if (costsMatch) {
    setSection(
      "costs",
      costsMatch[0] ?? "",
      "text_pattern",
      classifyMarkerLanguage(costsMatch[1] ?? null),
    );
  }
  // Derivaciones por vocabulario tematico dentro de una seccion ya
  // localizada (nunca inventan contenido nuevo -- reutilizan el texto de
  // "facts"/"reasoning" ya extraido). Ya eran razonablemente multilingues;
  // se conserva el idioma detectado de la seccion origen para la evidencia.
  if (
    sections["facts"] &&
    /(Beschwerde|recours|ricorso|recourant|appel|MPC|Ministère public|Staatsanwaltschaft|Cour des affaires pénales|Cour des plaintes|Obergericht|Tribunal cantonal|Corte cantonale)/i.test(
      sections["facts"],
    )
  ) {
    setSection(
      "procedural_history",
      sections["facts"],
      "text_pattern",
      evidence["facts"]?.detected_language ?? null,
    );
  }
  if (
    sections["facts"] &&
    /(beantragt|rügt|macht geltend|conclut|Conclusions|sostiene|Beschwerdeführer|Beschwerdeführerin|recourant|parties plaignantes|appelant|intimé|ricorrente)/i.test(
      sections["facts"],
    )
  ) {
    setSection(
      "party_arguments",
      sections["facts"],
      "text_pattern",
      evidence["facts"]?.detected_language ?? null,
    );
  }
  if (
    sections["reasoning"] &&
    /(Vorinstanz|angefochten|Obergericht|Tribunal cantonal|Corte cantonale|lower authority|Vorinstanz|Verfügung|Einspracheentscheid|Einzelrichter|Steuerverwaltung|autorité inférieure|autorità inferiore|Ministère public|MP-GE|OFJ|Office fédéral|Juge d'instruction|Juge d’instruction|MPC)/i.test(
      sections["reasoning"],
    )
  ) {
    setSection(
      "lower_authority_reasoning",
      sections["reasoning"],
      "text_pattern",
      evidence["reasoning"]?.detected_language ?? null,
    );
  }

  // Content-based enhancement for facts when structural markers are not found
  // Looks for factual content typically found at the beginning of judgments
  if (!sections["facts"]) {
    const facts = extractImprovedFactsSection(text);
    if (facts) {
      setSection("facts", facts, "content_heuristics", null, false);

      // Also derive related sections from enhanced facts if not already set
      if (!sections["procedural_history"]) {
        // Apply the same content-based derivation that exists later in the function
        if (
          /(Beschwerde|recours|ricorso|recourant|appel|MPC|Ministère public|Staatsanwaltschaft|Cour des affaires pénales|Cour des plaintes|Obergericht|Tribunal cantonal|Corte cantonale)/i.test(
            facts,
          )
        ) {
          setSection("procedural_history", facts, "content_heuristics", null, false);
        }
      }
      if (!sections["party_arguments"]) {
        // Apply the same content-based derivation that exists later in the function
        if (
          /(beantragt|rügt|macht geltend|conclut|Conclusions|sostiene|Beschwerdeführer|Beschwerdeführerin|recourant|parties plaignantes|appelant|intimé|ricorrente)/i.test(
            facts,
          )
        ) {
          setSection("party_arguments", facts, "content_heuristics", null, false);
        }
      }
    }
  }

  // Content-based enhancement for party_arguments when not found via other means
  if (!sections["party_arguments"] && sections["facts"]) {
    const partyArgs = extractImprovedPartyArgumentsSection(sections["facts"]);
    if (partyArgs) {
      setSection(
        "party_arguments",
        partyArgs,
        "content_heuristics",
        evidence["facts"]?.detected_language ?? null,
        false,
      );
    }
  }

  // Content-based enhancement for lower_authority_reasoning when not found via other means
  if (!sections["lower_authority_reasoning"] && sections["reasoning"]) {
    const lowerAuth = extractImprovedLowerAuthorityReasoningSection(sections["reasoning"]);
    if (lowerAuth) {
      setSection(
        "lower_authority_reasoning",
        lowerAuth,
        "content_heuristics",
        evidence["reasoning"]?.detected_language ?? null,
        false,
      );
    }
  }

  return { sections, evidence };
}

// Content-based extraction of facts section using positional and linguistic heuristics
function extractImprovedFactsSection(text: string): string | null {
  // Remove header-like content from the beginning
  const cleanedText = text.replace(/^.*?(?=\n\s*\n)/m, "").trim();

  // Look for factual indicators in the first part of the document
  const factualIndicators = [
    /(vorliegt|erwiesen|akteneigentlich|file|akte|akten|avéré|prouvé|constaté|accertato|provato)/i,
    /(am|le|il)\s+\d{1,2}\.\s+\d{1,2}\.\s+\d{4}/, // dates like am 15.03.2023
    /(geboren|né|nato)\s+/i, // birth information
    /(wohnhaft|résidant|residente)\s+/i, // residence
    /(beschäftigt|employé|occupato)\s+/i, // employment
    /(klagt|klaagt|demande|chiede)\s+/i, // plaintiff actions
    /(beklagt|être poursuivi|essere convenuto)\s+/i, // defendant actions
    /(vertrag|contrat|contratto)\s+/i, // contract
    /(schaden|dommage|danno)\s+/i, // damage
    /(verletzung|violation|violazione)\s+/i, // violation
  ];

  // Find the best factual content block (typically first 30-50% of document)
  const lines = cleanedText.split("\n");
  const midPoint = Math.ceil(lines.length * 0.4);
  const firstPart = lines.slice(0, midPoint).join("\n");

  // Score each line based on factual indicators
  const scoredLines = firstPart
    .split("\n")
    .map((line, index) => {
      let score = 0;
      line = line.trim();
      if (!line) return { line, score: 0, index };

      // Boost score for lines with factual indicators
      for (const pattern of factualIndicators) {
        if (pattern.test(line)) {
          score += 2;
        }
      }

      // Boost score for lines with proper nouns, numbers, dates
      if (/[A-Z][a-z]+\s+[A-Z][a-z]/.test(line)) score += 1; // Proper nouns
      if (/\d{1,2}\.\s*\d{1,2}\.\s*\d{2,4}/.test(line)) score += 2; // Dates
      if (/\d+[.,]\d+/.test(line)) score += 1; // Numbers with decimals

      // Reduce score for very short lines or purely procedural language
      if (line.length < 20) score -= 1;
      if (/^(erwägungen|considérants?|considerandi|erwägung)\s*:?$/i.test(line)) score -= 5;

      return { line, score, index };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score); // Descending by score

  if (scoredLines.length === 0) return null;

  // Take top-scoring lines and reconstruct the facts section
  const topLines = scoredLines
    .slice(0, Math.min(10, scoredLines.length))
    .sort((a, b) => a.index - b.index) // Restore original order
    .map((item) => item.line)
    .join("\n");

  return topLines.length > 50 ? topLines.trim() : null;
}

// Content-based extraction of party arguments section using linguistic heuristics
function extractImprovedPartyArgumentsSection(text: string): string | null {
  // Look for argumentative/discursive content
  const argumentIndicators = [
    /(beantragt|antrag|request|demande|conclusione|richiesta)\s*/i,
    /(rügt|beanstandet|conteste|contestato|objeta)\s*/i,
    /(macht geltend|fait valoir|fa valere)\s*/i,
    /(stellen wir fest|nous constatons|constatiamo)\s*/i,
    /(seien wir der auffassung|nous sommes d'avis|siamo dell'avviso)\s*/i,
    // Swiss legal argument patterns
    /(laut|gemäß|selon|secondo)\s+/i,
    /(nach|according to|secondo\s+per\s+)/i,
    /(vgl\\.|voir|vedi)\s*/i,
    // Conclusion indicators
    /(folglich|donc|quindi)\s*/i,
    /(deshalb|par conséquent|perciò)\s*/i,
    /(zusammenfassant|en résumé|in sintesi)\s*/i,
  ];

  // Look in the latter part of documents where arguments typically appear
  const lines = text.split("\n");
  const startPoint = Math.ceil(lines.length * 0.3); // Skip first 30%
  const argumentSection = lines.slice(startPoint).join("\n");

  // Score lines based on argumentative indicators
  const scoredLines = argumentSection
    .split("\n")
    .map((line, index) => {
      let score = 0;
      line = line.trim();
      if (!line) return { line, score: 0, index };

      // Boost score for lines with argument indicators
      for (const pattern of argumentIndicators) {
        if (pattern.test(line)) {
          score += 2;
        }
      }

      // Boost for quotes and citations
      if (/\s["«»""].*["«»""]/.test(line)) score += 1;
      if (/[Bb]GE\s+\d+\s*[IVX]+\s*\d+/.test(line)) score += 2; // Case citations
      if (/art\.\s*\d+/.test(line)) score += 2; // Article references

      // Reduce for purely factual narration
      if (/^(am|le|il)\s+\d{1,2}\.\s+\d{1,2}\.\s+\d{4}/.test(line)) score -= 1;

      return { line, score: Math.max(0, score), index };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scoredLines.length === 0) return null;

  // Take top-scoring argumentative lines
  const topLines = scoredLines
    .slice(0, Math.min(15, scoredLines.length))
    .sort((a, b) => a.index - b.index) // Restore original order
    .map((item) => item.line)
    .join("\n");

  return topLines.length > 30 ? topLines.trim() : null;
}

// Content-based extraction of lower authority reasoning section using linguistic heuristics
function extractImprovedLowerAuthorityReasoningSection(text: string): string | null {
  // Look for content discussing lower court decisions
  const lowerAuthorityIndicators = [
    // German
    /(vorinstanz|erste instanz|bezirksgericht|kreisgericht|landesgericht|obergericht|verwaltungsgericht|sozialversicherungsgericht)/i,
    /(angefochten|beschwert|rekurss|apellation|beschwerde)/i,
    /(bestätigt|aufgehoben|abgeändert|teilweise bestätigt|teilweise abgeändert)/i,
    // French
    /(première instance|tribunal d'arrondissement|tribunal cantonal|cour de justice|cour administrative)/i,
    /(attaqué|appelé|pourvoi|appel)/i,
    /(confirmé|infirmé|réformé|partiellement confirmé|partiellement infirmé)/i,
    // Italian
    /(primo istanza|pretura|tribunale distrettuale|tribunale cantonale|corte amministrativa)/i,
    /(impugnato|appellato|ricorso)/i,
    /(confermato|revocato|riformato|parzialmente confermato|parzialmente revocato)/i,
  ];

  // Look in the reasoning section where lower authority discussion typically appears
  const lines = text.split("\n");
  const startPoint = Math.ceil(lines.length * 0.2); // Skip first 20% (header/facts)
  const endPoint = Math.ceil(lines.length * 0.8); // Stop before final 20% (disposition)
  const reasoningSection = lines.slice(startPoint, endPoint).join("\n");

  // Score lines based on lower authority indicators
  const scoredLines = reasoningSection
    .split("\n")
    .map((line, index) => {
      let score = 0;
      line = line.trim();
      if (!line) return { line, score: 0, index };

      // Boost score for lines with lower authority indicators
      for (const pattern of lowerAuthorityIndicators) {
        if (pattern.test(line)) {
          score += 2;
        }
      }

      // Boost for comparative language
      if (/im vergleich|par comparaison|in confronto/.test(line)) score += 1;
      if (/im gegenteil|au contraire|al contrario/.test(line)) score += 1;

      return { line, score, index };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scoredLines.length === 0) return null;

  // Take top-scoring lower authority lines
  const topLines = scoredLines
    .slice(0, Math.min(12, scoredLines.length))
    .sort((a, b) => a.index - b.index) // Restore original order
    .map((item) => item.line)
    .join("\n");

  return topLines.length > 30 ? topLines.trim() : null;
}

function failedFetch(
  candidate: OfficialCaseCandidate,
  status: FetchStatus,
  warnings: readonly string[],
): FullTextFetchResult {
  return {
    fetch_status: status,
    requested_url: candidate.source_url,
    source_url: candidate.source_url,
    final_url: candidate.canonical_url,
    status_code: undefined,
    redirects: [],
    response_headers: {},
    mime_type: candidate.mime_type,
    content_length: 0,
    bytes_received: 0,
    document_hash: null,
    metadata_hash: null,
    network_transport: "none",
    mock_or_fixture: false,
    severity: warnings.some((warning) => /synthetic|fixture|mock/i.test(warning))
      ? "blocker"
      : "warning",
    retrieved_at: null,
    extractor_version: extractorVersion,
    source_version: null,
    text: null,
    sections: {},
    response_body_type: "empty",
    physical_page_count: null,
    access_restrictions: warnings.filter((warning) =>
      /access|login|captcha|restricted/i.test(warning),
    ),
    parser_status: warnings.includes("empty_response")
      ? "empty_response"
      : warnings.some((warning) => /parse|unparseable/i.test(warning))
        ? "adapter_parse_failure"
        : "not_parsed",
    warnings,
  };
}

function failedFetchFromResponse(
  candidate: OfficialCaseCandidate,
  response: OfficialCaseHttpResponse,
  status: FetchStatus,
  warnings: readonly string[],
): FullTextFetchResult {
  const isPdf = isPdfMime(response.mime_type) || hasPdfMagicBytes(response.body);
  const bodyType: FullTextFetchResult["response_body_type"] =
    response.bytes_received === 0
      ? "empty"
      : isPdf
        ? "pdf"
        : /^text\/html|application\/xhtml/i.test(response.mime_type ?? "")
          ? "html"
          : /^text\//i.test(response.mime_type ?? "")
            ? "text"
            : "binary";
  return {
    ...failedFetch(candidate, status, warnings),
    requested_url: response.requested_url,
    final_url: response.final_url,
    status_code: response.status_code,
    redirects: response.redirect_chain,
    response_headers: response.response_headers,
    mime_type: response.mime_type,
    content_length: response.content_length,
    bytes_received: response.bytes_received,
    network_transport: response.network_transport,
    mock_or_fixture: response.mock_or_fixture,
    retrieved_at: response.retrieved_at,
    response_body_type: bodyType,
    physical_page_count: bodyType === "pdf" ? null : null,
    access_restrictions: warnings.filter((warning) =>
      /access|login|captcha|restricted/i.test(warning),
    ),
    parser_status: status === "empty_document" ? "empty_response" : "not_parsed",
  };
}

function emptyIdentity(status: IdentityStatus): IdentityVerification {
  return {
    status,
    matched_fields: [],
    mismatched_fields: [],
    missing_fields: [],
    ambiguity_reasons: status === "identity_ambiguous" ? ["candidate_ambiguous"] : [],
    identity_score: null,
    identity_confidence: null,
    official_identity_verified: false,
    requires_human_review: status === "identity_ambiguous",
    identity_evidence_sources: [],
    independent_evidence_count: 0,
    metadata_extracted_from_live_document: false,
    metadata_extracted_from_search_result: false,
    circular_verification_detected: false,
    reference_year: null,
    reference_year_source: null,
    decision_year: null,
    decision_year_source: null,
    year_relationship: "insufficient_data",
    year_mismatch: false,
    year_mismatch_blocking: false,
  };
}

function emptyCompleteness(
  errors: readonly string[],
  status: CompletenessStatus,
): CompletenessReport {
  return {
    total_pages: null,
    pages_read: [],
    page_coverage: 0,
    total_sections: 0,
    sections_read: [],
    section_coverage: 0,
    missing_pages: [],
    missing_sections: [],
    truncated_sections: [],
    extraction_errors: errors,
    dispositive_present: false,
    factual_section_present: false,
    reasoning_section_present: false,
    final_reasoning_section_present: false,
    separate_opinions_present: false,
    separate_opinions_read: false,
    independent_grounds_count: 0,
    independent_grounds_read: 0,
    completeness_score: 0,
    completeness_status: status,
  };
}

function compareField(
  field: string,
  expected: string,
  actual: string | null,
  matched: string[],
  mismatched: string[],
  missing: string[],
): void {
  if (!actual) {
    missing.push(field);
  } else if (expected.toLowerCase() === actual.toLowerCase()) {
    matched.push(field);
  } else {
    mismatched.push(field);
  }
}

function isOfficialHost(host: string): boolean {
  return (
    host === "bger.ch" ||
    host.endsWith(".bger.ch") ||
    host === "bvger.ch" ||
    host.endsWith(".bvger.ch") ||
    host === "bvger.weblaw.ch" ||
    host === "bstger.ch" ||
    host.endsWith(".bstger.ch") ||
    host === "bstger.weblaw.ch" ||
    host === "ar.ch" ||
    host.endsWith(".ar.ch") ||
    host === "admin.ch" ||
    host.endsWith(".admin.ch") ||
    host.startsWith("www.gerichte-")
  );
}

function inferCourtFamilyFromHost(host: string): CourtFamily {
  if (host.includes("bger.ch")) return "swiss_federal_supreme_court";
  if (host === "bvger.weblaw.ch") return "federal_administrative_court";
  if (host.includes("bvger.ch")) return "federal_administrative_court";
  if (host === "bstger.weblaw.ch") return "federal_criminal_court";
  if (host.includes("bstger.ch")) return "federal_criminal_court";
  if (host === "ar.ch" || host.endsWith(".ar.ch")) return "cantonal_court";
  if (host.startsWith("www.gerichte-")) return "cantonal_court";
  return "unknown";
}

function possibleCourtsForHost(host: string): readonly string[] {
  const family = inferCourtFamilyFromHost(host);
  return family === "unknown" ? [] : [family];
}

function extractUrl(value: string): URL | null {
  const match = /https?:\/\/\S+/.exec(value);
  return match ? safeUrl(match[0]) : null;
}

function extractYear(value: string): number | null {
  const match = /\b(19|20)\d{2}\b/.exec(value);
  return match ? Number(match[0]) : null;
}

function stripTags(value: string): string {
  return value.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ");
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256Bytes(value: Uint8Array): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function makeResolutionId(reference: string, sourceUrl: string): string {
  return sha256(`resolution:${reference}:${sourceUrl}`).slice(0, 24);
}

function makeBgerSearchUrl(reference: string): string {
  return `https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?from_date=&lang=de&query_words=${encodeURIComponent(reference)}&to_date=&top_subcollection_aza=all&type=simple_query`;
}

function makeBgerPublishedSearchUrl(reference: string): string {
  const url = new URL("https://search.bger.ch/ext/eurospider/live/de/php/clir/http/index.php");
  url.searchParams.set("from_date", "");
  url.searchParams.set("lang", "de");
  url.searchParams.set("query_words", reference);
  url.searchParams.set("to_date", "");
  url.searchParams.set("from_year", "1954");
  url.searchParams.set("to_year", "2026");
  url.searchParams.set("top_subcollection_clir", "bge");
  url.searchParams.set("part", "all");
  url.searchParams.set("type", "simple_query");
  return url.toString();
}

function isProductionRuntime(): boolean {
  return process["env"]["NODE_ENV"] === "production";
}

function similarity(a: string, b: string): number {
  const aTokens = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const bTokens = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size || 1;
  return Number((intersection / union).toFixed(2));
}
