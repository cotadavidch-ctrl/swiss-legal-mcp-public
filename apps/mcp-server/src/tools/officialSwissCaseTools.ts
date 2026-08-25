import { z } from "zod";
import type { ToolRegistry } from "@swiss-legal-mcp/core";
import {
  compareSwissCaseSources,
  compareSwissCaseSourcesByIdentifier,
  fetchOfficialSwissCaseFullTextByIdentifier,
  normalizeSwissCaseReference,
  resolveOfficialSwissCase,
  validateSwissCaseGroundCoverage,
  verifySwissCaseIdentity,
  verifySwissCaseIdentityByIdentifier,
} from "./officialSwissCaseResolver.js";
import {
  discoverFederalCaseCandidates,
  FEDERAL_CHAMBER_PREFIX_MAP,
  type FederalChamberCode,
} from "./officialFederalCaseSearch.js";
import { batchResolveOfficialCases } from "./officialFederalCaseBatch.js";
import { exportCaseCorpus } from "./caseCorpusExport.js";

const FEDERAL_CHAMBER_CODES = Object.keys(FEDERAL_CHAMBER_PREFIX_MAP) as [
  FederalChamberCode,
  ...FederalChamberCode[],
];
const federalChamberSchema = z.enum(FEDERAL_CHAMBER_CODES);
const federalDocumentTypeSchema = z.enum(["judgment", "decision", "order", "unknown"]);

const languageSchema = z.enum(["de", "fr", "it"]);
const presentationModeSchema = z.enum(["clean", "professional", "technical_control", "debug"]);
const fetchedDocumentSchema = z.object({
  source_url: z.string().url(),
  final_url: z.string().url(),
  status_code: z.number().int().min(200).max(299).optional(),
  mime_type: z.string().nullable().optional(),
  text: z.string().min(1),
  document_hash: z.string().min(16).nullable().optional(),
  retrieved_at: z.string().min(1).nullable().optional(),
});

const resolveInputSchema = {
  case_reference: z.string().min(1).max(300).optional(),
  resolution_id: z.string().min(8).max(80).optional(),
  court_hint: z.string().max(200).optional(),
  canton_hint: z.string().length(2).optional(),
  decision_date_hint: z.iso.date().optional(),
  language_hint: languageSchema.optional(),
  source_url_hint: z.string().url().optional(),
  allow_unofficial_fallback: z.boolean().default(false),
  require_official_source: z.boolean().default(true),
  require_full_text: z.boolean().default(true),
  strict_identity_match: z.boolean().default(true),
  retrieval_mode: z
    .enum(["metadata_only", "full_text", "cache_only", "refresh"])
    .default("full_text"),
  timeout_policy: z.enum(["default", "short", "long"]).default("default"),
  presentation_mode: presentationModeSchema.default("technical_control"),
};

export function registerOfficialSwissCaseTools(tools: ToolRegistry): void {
  tools.register({
    name: "resolve_official_swiss_case",
    description:
      "Resolves a Swiss case reference through auditable official-source-first adapters. It normalizes the reference, ranks candidates, verifies identity, fetches full text, checks completeness and returns legal-use states. Aggregators never become official sources.",
    inputSchema: resolveInputSchema,
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => resolveOfficialSwissCase(input),
  });

  tools.register({
    name: "fetch_official_swiss_case_full_text",
    description:
      "Fetches and passively extracts full text for a selected Swiss case candidate returned by resolve_official_swiss_case. Download alone never marks a case as full_text_read.",
    inputSchema: {
      case_reference: z.string().min(1).max(300).optional(),
      resolution_id: z.string().min(8).max(80).optional(),
      candidate_id: z.string().min(8).max(80).optional(),
      document_id: z.string().min(8).max(80).optional(),
      canonical_url: z.string().url().optional(),
      normalized_reference: z.string().min(1).max(300).optional(),
      source_url: z.string().url().optional(),
      require_official_source: z.boolean().default(true),
      require_full_text: z.boolean().default(true),
      // Pagination parameters for large document support
      chunk_index: z.number().int().min(0).optional().default(0),
      chunk_token: z.string().optional(),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => {
      if (
        !input.document_id &&
        !input.resolution_id &&
        !input.candidate_id &&
        !input.normalized_reference &&
        !input.case_reference &&
        !input.canonical_url &&
        !input.source_url
      ) {
        return {
          fetch_status: "fetch_failed" as const,
          warnings: ["missing_identifier"],
        };
      }
      return fetchOfficialSwissCaseFullTextByIdentifier({
        document_id: input.document_id,
        resolution_id: input.resolution_id,
        candidate_id: input.candidate_id,
        canonical_url: input.canonical_url ?? input.source_url,
        normalized_reference: input.normalized_reference,
        case_reference: input.case_reference,
        requireOfficial: input.require_official_source,
        requireFullText: input.require_full_text,
      });
    },
  });

  tools.register({
    name: "verify_swiss_case_identity",
    description:
      "Compares normalized Swiss case reference fields against candidate metadata. A matching number alone is insufficient for identity_verified.",
    inputSchema: {
      case_reference: z.string().min(1).max(300).optional(),
      requested_reference: z.string().min(1).max(300).optional(),
      normalized_reference: z.string().min(1).max(300).optional(),
      resolution_id: z.string().min(8).max(80).optional(),
      document_id: z.string().min(8).max(80).optional(),
      candidate_reference: z.string().min(1).max(300).optional(),
      candidate_court_family: z
        .enum([
          "swiss_federal_supreme_court",
          "federal_administrative_court",
          "federal_criminal_court",
          "cantonal_court",
          "unknown",
        ])
        .default("unknown"),
      candidate_url: z.string().url().optional(),
      candidate_date: z.iso.date().optional(),
      candidate_chamber: z.string().max(100).optional(),
      official: z.boolean().default(false),
      strict_identity_match: z.boolean().default(true),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => {
      if (
        input.resolution_id ||
        input.document_id ||
        input.normalized_reference ||
        input.requested_reference
      ) {
        return verifySwissCaseIdentityByIdentifier({
          resolution_id: input.resolution_id,
          document_id: input.document_id,
          normalized_reference: input.normalized_reference,
          requested_reference: input.requested_reference,
          case_reference: input.case_reference,
          strict: input.strict_identity_match,
        });
      }
      if (!input.case_reference || !input.candidate_reference || !input.candidate_url) {
        return {
          ...{
            status: "identity_not_verifiable" as const,
            matched_fields: [],
            mismatched_fields: [],
            missing_fields: ["missing_identifier"],
            ambiguity_reasons: [],
            identity_score: null,
            identity_confidence: null,
            official_identity_verified: false,
            requires_human_review: false,
            identity_evidence_sources: [],
            independent_evidence_count: 0,
            metadata_extracted_from_live_document: false,
            metadata_extracted_from_search_result: false,
            circular_verification_detected: false,
            reference_year: null,
            reference_year_source: null,
            decision_year: null,
            decision_year_source: null,
            year_relationship: "insufficient_data" as const,
            year_mismatch: false,
            year_mismatch_blocking: false,
          },
        };
      }
      const normalized = normalizeSwissCaseReference(input.case_reference);
      return verifySwissCaseIdentity({
        normalized,
        candidate: {
          candidate_id: "manual-candidate",
          source: input.official ? "manual_official" : "manual_secondary",
          source_url: input.candidate_url,
          canonical_url: input.candidate_url,
          official: input.official,
          court: input.candidate_court_family,
          court_family: input.candidate_court_family,
          canton: null,
          reference: input.candidate_reference,
          decision_date: input.candidate_date ?? null,
          chamber: input.candidate_chamber ?? null,
          language: null,
          title: input.candidate_reference,
          mime_type: "text/html",
          content_kind: "unknown",
          score: 0,
          matched_features: [],
          mismatched_features: [],
          missing_features: [],
          selection_reason: "manual identity verification input",
          rejected_reason: null,
        },
        strict: input.strict_identity_match,
      });
    },
  });

  tools.register({
    name: "compare_swiss_case_sources",
    description:
      "Compares one official Swiss case source with secondary sources and reports identity, structure, omissions, editorial additions and authoritative source selection.",
    inputSchema: {
      case_reference: z.string().min(1).max(300),
      official_url: z.string().url().optional(),
      secondary_urls: z.array(z.string().url()).max(8).default([]),
      official_document_id: z.string().min(8).max(80).optional(),
      secondary_document_id: z.string().min(8).max(80).optional(),
      official_resolution_id: z.string().min(8).max(80).optional(),
      secondary_resolution_id: z.string().min(8).max(80).optional(),
      secondary_url: z.string().url().optional(),
      allow_secondary_discovery: z.boolean().default(false),
      official_document: fetchedDocumentSchema.optional(),
      secondary_documents: z.array(fetchedDocumentSchema).max(8).default([]),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) => {
      if (
        input.official_document_id ||
        input.secondary_document_id ||
        input.official_resolution_id ||
        input.secondary_resolution_id ||
        input.secondary_url ||
        input.allow_secondary_discovery
      ) {
        return compareSwissCaseSourcesByIdentifier({
          case_reference: input.case_reference,
          official_document_id: input.official_document_id,
          secondary_document_id: input.secondary_document_id,
          official_resolution_id: input.official_resolution_id,
          secondary_resolution_id: input.secondary_resolution_id,
          official_url: input.official_url,
          secondary_url: input.secondary_url,
          allow_secondary_discovery: input.allow_secondary_discovery,
        });
      }
      if (!input.official_url && !input.official_document) {
        return { sources_compared: 0, source_mismatch: ["official_source_required"] };
      }
      const official = await resolveOfficialSwissCase({
        case_reference: input.case_reference,
        source_url_hint: input.official_url ?? input.official_document?.final_url,
        require_official_source: true,
        require_full_text: input.official_document ? false : true,
      });
      const secondary = await Promise.all(
        input.secondary_urls.map((url) =>
          resolveOfficialSwissCase({
            case_reference: input.case_reference,
            source_url_hint: url,
            allow_unofficial_fallback: true,
            require_official_source: false,
            require_full_text: false,
          }),
        ),
      );
      if (!official.selected_candidate) {
        return { sources_compared: 0, source_mismatch: ["official_source_not_found"] };
      }
      return compareSwissCaseSources({
        official: official.selected_candidate,
        official_document: input.official_document
          ? {
              fetch_status: "fetch_success",
              requested_url: input.official_document.source_url,
              source_url: input.official_document.source_url,
              final_url: input.official_document.final_url,
              status_code: input.official_document.status_code ?? 200,
              redirects: [],
              response_headers: {},
              mime_type: input.official_document.mime_type ?? "text/plain",
              content_length: Buffer.byteLength(input.official_document.text),
              bytes_received: Buffer.byteLength(input.official_document.text),
              document_hash: input.official_document.document_hash ?? null,
              metadata_hash: null,
              network_transport: "live_http",
              mock_or_fixture: false,
              retrieved_at: input.official_document.retrieved_at ?? new Date().toISOString(),
              extractor_version: "official-swiss-case-resolver-v1",
              source_version: null,
              text: input.official_document.text,
              sections: {},
              warnings: [],
            }
          : (official.fetch ?? undefined),
        secondary: secondary.flatMap((item) =>
          item.selected_candidate ? [item.selected_candidate] : [],
        ),
      });
    },
  });

  tools.register({
    name: "validate_swiss_case_ground_coverage",
    description:
      "Validates that all verified autonomous grounds of a persisted official Swiss case have been reviewed before the case is used for comparability, drafting or strategy. This tool is cache-only and never performs a network request.",
    inputSchema: {
      document_id: z.string().min(8).max(80),
      included_ground_ids: z.array(z.string().min(1).max(80)).max(50).default([]),
      excluded_ground_ids: z.array(z.string().min(1).max(80)).max(50).default([]),
      validation_mode: z.enum(["coverage"]).default("coverage"),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) =>
      validateSwissCaseGroundCoverage({
        document_id: input.document_id,
        included_ground_ids: input.included_ground_ids,
        excluded_ground_ids: input.excluded_ground_ids,
        validation_mode: input.validation_mode,
      }),
  });

  tools.register({
    name: "search_federal_cases",
    description:
      "Discovers candidate decisions directly from the official Swiss Federal Supreme Court search portal (search.bger.ch) -- never through an aggregator. Returns discovery-only candidates (identity_status: candidate_discovered); it does not verify identity or fetch full text. Supports chamber/division, language, date range, subject keyword and document-type filters, real multi-page cursor-based pagination, and stable deduplication. Use resolve_official_swiss_case or batch_resolve_official_cases on the returned candidates to verify identity and read full text.",
    inputSchema: {
      query: z.string().max(500).optional(),
      chamber: federalChamberSchema.optional(),
      language: languageSchema.optional(),
      date_from: z.iso.date().optional(),
      date_to: z.iso.date().optional(),
      subject: z.string().max(200).optional(),
      document_type: federalDocumentTypeSchema.optional(),
      page: z.number().int().min(1).max(100_000).optional(),
      page_size: z.number().int().min(1).max(50).default(20),
      max_results: z.number().int().min(1).max(500).default(100),
      official_only: z.boolean().default(true),
      full_text_preferred: z.boolean().default(false),
      cursor: z.string().max(2000).nullable().optional(),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) =>
      discoverFederalCaseCandidates({
        query: input.query,
        chamber: input.chamber,
        language: input.language,
        date_from: input.date_from,
        date_to: input.date_to,
        subject: input.subject,
        document_type: input.document_type,
        page: input.page,
        page_size: input.page_size,
        max_results: input.max_results,
        official_only: input.official_only,
        full_text_preferred: input.full_text_preferred,
        cursor: input.cursor ?? null,
      }),
  });

  tools.register({
    name: "batch_resolve_official_cases",
    description:
      "Resolves a list of Swiss case candidates (typically from search_federal_cases) through resolve_official_swiss_case with bounded concurrency, per-item retry for transient failures only, and checkpoint/resume support. Never fails all-or-nothing: each candidate gets an independent status (full_text_verified_official, official_extract, metadata_only, identity_mismatch, failed or skipped-already-resolved). Pass the same checkpoint_id with resume:true to continue an interrupted run without repeating completed items.",
    inputSchema: {
      candidates: z
        .array(
          z.object({
            case_reference: z.string().min(1).max(300).optional(),
            canonical_url: z.string().url().optional(),
            resolution_id: z.string().min(8).max(80).optional(),
            language_hint: languageSchema.optional(),
          }),
        )
        .min(1)
        .max(500),
      concurrency: z.number().int().min(1).max(6).default(3),
      require_official_source: z.boolean().default(true),
      require_full_text: z.boolean().default(true),
      strict_identity_match: z.boolean().default(true),
      retry_limit: z.number().int().min(0).max(3).default(1),
      checkpoint_id: z.string().min(1).max(200).nullable().optional(),
      resume: z.boolean().default(false),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) =>
      batchResolveOfficialCases({
        candidates: input.candidates,
        concurrency: input.concurrency,
        require_official_source: input.require_official_source,
        require_full_text: input.require_full_text,
        strict_identity_match: input.strict_identity_match,
        retry_limit: input.retry_limit,
        checkpoint_id: input.checkpoint_id ?? null,
        resume: input.resume,
      }),
  });

  tools.register({
    name: "export_case_corpus",
    description:
      "Builds and exports a reproducible, verifiable Swiss case-law corpus: orchestrates search_federal_cases discovery (over-collecting and deduplicating candidates), then batch_resolve_official_cases, then applies hard inclusion gates (identity_verified + official source + complete + full_text_verified_official) before counting a decision toward the corpus. Official extracts, metadata-only records, identity mismatches and failures are exported separately and never counted as included. Supports checkpoint/resume for long runs and never treats HTTP 204 as absence of jurisprudence.",
    inputSchema: {
      query: z.string().max(500).optional(),
      chamber: federalChamberSchema.optional(),
      language: languageSchema.optional(),
      date_from: z.iso.date().optional(),
      date_to: z.iso.date().optional(),
      subject: z.string().max(200).optional(),
      document_type: federalDocumentTypeSchema.optional(),
      minimum_size: z.number().int().min(1).max(1000).default(50),
      target_size: z.number().int().min(1).max(1000).default(60),
      max_candidates: z.number().int().min(1).max(2000).default(140),
      page_size: z.number().int().min(1).max(50).default(20),
      concurrency: z.number().int().min(1).max(6).default(3),
      checkpoint_id: z.string().min(1).max(200).nullable().optional(),
      resume: z.boolean().default(false),
    },
    strictInput: true,
    requiredProviderIds: [],
    handler: async (input) =>
      exportCaseCorpus({
        filters: {
          query: input.query,
          chamber: input.chamber,
          language: input.language,
          date_from: input.date_from,
          date_to: input.date_to,
          subject: input.subject,
          document_type: input.document_type,
        },
        minimum_size: input.minimum_size,
        target_size: input.target_size,
        max_candidates: input.max_candidates,
        page_size: input.page_size,
        concurrency: input.concurrency,
        checkpoint_id: input.checkpoint_id ?? null,
        resume: input.resume,
      }),
  });
}
