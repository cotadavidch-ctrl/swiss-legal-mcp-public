import fs from "node:fs";
import path from "node:path";
import {
  resolveOfficialSwissCase,
  validateSwissCaseGroundCoverage,
  type OfficialSwissCaseResolution,
} from "../apps/mcp-server/src/tools/officialSwissCaseResolver.js";
import { extractChallengedPassages } from "../apps/mcp-server/src/tools/legalDraftingRules.js";
import {
  analyzeSwissLegalPositions,
  validateMultiroleLegalAnalysis,
  validateMultiroleLegalAnalysisById,
} from "../apps/mcp-server/src/tools/multiroleLegalAnalysisTools.js";

const root = process.cwd();
const outDir = path.join(root, "docs", "release", "generated");
const artifactPath = path.join(outDir, "legal-capability-live-check.json");
const searchAuditPath = path.join(outDir, "autonomous-ground-search-audit.json");

function passOfficial(result: OfficialSwissCaseResolution): boolean {
  return (
    result.fetch?.fetch_status === "fetch_success" &&
    result.fetch.network_transport === "live_http" &&
    result.fetch.mock_or_fixture === false &&
    result.identity.status === "identity_verified" &&
    Boolean(result.fetch.document_hash)
  );
}

async function resolve(reference: string) {
  const result = await resolveOfficialSwissCase({
    case_reference: reference,
    require_official_source: true,
    require_full_text: true,
    strict_identity_match: true,
    retrieval_mode: "refresh",
    presentation_mode: "debug",
  });
  return {
    reference,
    pass: passOfficial(result),
    fetch_status: result.fetch?.fetch_status ?? null,
    network_transport: result.fetch?.network_transport ?? null,
    mock_or_fixture: result.fetch?.mock_or_fixture ?? null,
    identity_status: result.identity.status,
    official_identity_verified: result.identity.official_identity_verified,
    reading_status: result.legal_use.reading_status,
    official_verification_status: result.legal_use.official_verification_status,
    document_hash: result.fetch?.document_hash ?? null,
    bytes_received: result.fetch?.bytes_received ?? 0,
    final_url: result.fetch?.final_url ?? null,
    decision_date: result.fetch?.decision_date ?? null,
    ratio_status: result.legal_use.ratio_status,
    ratio_analysis: result.legal_use.ratio_analysis ?? null,
    independent_grounds_count: result.legal_use.ratio_analysis?.independent_grounds_count ?? null,
    independent_grounds_reviewed:
      result.legal_use.ratio_analysis?.independent_grounds_reviewed ?? null,
    independent_ground_details: result.legal_use.ratio_analysis?.independent_ground_details ?? [],
    obiter_details: result.legal_use.ratio_analysis?.obiter_details ?? [],
    normalized: result.normalized,
    document_id: result.document_id,
    resolution_id: result.resolution_id,
    selected_candidate_id: result.selected_candidate_id,
    publication_mapping_status:
      result.fetch?.publication_mapping_status ??
      result.selected_candidate?.publication_mapping_status ??
      null,
    published_citation: result.fetch?.published_citation ?? null,
    case_reference:
      result.fetch?.case_reference ?? result.selected_candidate?.case_reference ?? null,
    official_docid:
      result.fetch?.official_docid ?? result.selected_candidate?.official_docid ?? null,
  };
}

const bge142 = await resolve("BGE 142 III 91");
const bge134 = await resolve("BGE 134 III 59");
const atf142 = await resolve("ATF 142 III 91");
const dtf142 = await resolve("DTF 142 III 91");
const case4c4 = await resolve("4C.4/2004");
const case4a664 = await resolve("4A_664/2024");
const case1b62 = await resolve("1B_62/2021");
const case2a348 = await resolve("2A.348/2004");

const adversarial = extractChallengedPassages({
  jurisdiction: { country: "CH" },
  procedure: { language: "de" },
  challengedPassages: [
    {
      id: "4C4-obiter-adversarial",
      exactText:
        "Ob zwischen den Parteien eine einfache Gesellschaft bestand, kann offen gelassen werden.",
      sourceDocumentId: case4c4.document_id ?? "4C.4/2004",
      consideration: "4",
      author: "reviewing_court",
      function: "conclusion",
      importance: "decisive",
      autonomousGround: true,
      contextBefore: "Das Bundesgericht prüft die verbindlichen Feststellungen.",
      contextAfter:
        "Selbst wenn eine einfache Gesellschaft angenommen würde, änderte dies am Ausgang nichts.",
      quoteVerified: true,
      quoteVerification: {
        quote_matches_user_input: true,
        quote_extracted_from_source: true,
        quote_verified_against_source: true,
        context_checked: true,
        source_location_verified: true,
        source_document_full_text_read: true,
      },
    },
  ],
});

const multiroleInput = {
  caseType: "administrative" as const,
  proceduralStage: "appeal" as const,
  matterDescription: "Live capability check for deterministic multirole validation.",
  jurisdiction: { country: "CH" as const },
  parties: [
    { role: "appellant" as const, description: "Pseudonymized appellant A" },
    { role: "authority" as const, description: "Cantonal authority" },
  ],
  facts: [{ id: "f1", description: "The authority issued a decision.", status: "confirmed" }],
  evidence: [],
  norms: [],
  caseLaw: [],
  challengedPassages: [],
  burdenModel: {
    proceduralMaxim: "not_verified" as const,
    legalBasisStatus: "not_verified" as const,
  },
};
const multiroleAnalysis = analyzeSwissLegalPositions(multiroleInput);
const multiroleValidation = validateMultiroleLegalAnalysis(multiroleAnalysis);
const multiroleValidationById = validateMultiroleLegalAnalysisById(multiroleAnalysis.analysis_id);

const doctrineDetails = case4a664.independent_ground_details.filter(
  (ground) => ground.doctrine_only === true,
);
const case1b62VerifiedAutonomousGrounds = case1b62.independent_ground_details.filter(
  (ground) =>
    ground.autonomous === true &&
    ground.autonomous_ground_status === "verified" &&
    ground.independently_sufficient === true,
);
const positiveAutonomousGrounds = case2a348.independent_ground_details.filter(
  (ground) =>
    ground.autonomous === true &&
    ground.autonomous_ground_status === "verified" &&
    ground.independently_sufficient === true,
);
const completeGroundCoverage = case2a348.document_id
  ? validateSwissCaseGroundCoverage({
      document_id: case2a348.document_id,
      included_ground_ids: positiveAutonomousGrounds.map((ground) => ground.ground_id),
      excluded_ground_ids: [],
      validation_mode: "coverage",
    })
  : null;
const omittedGroundCoverage =
  case2a348.document_id && positiveAutonomousGrounds.length >= 2
    ? validateSwissCaseGroundCoverage({
        document_id: case2a348.document_id,
        included_ground_ids: positiveAutonomousGrounds.slice(1).map((ground) => ground.ground_id),
        excluded_ground_ids: [positiveAutonomousGrounds[0]!.ground_id],
        validation_mode: "coverage",
      })
    : null;
const positiveGroundsTraceable = positiveAutonomousGrounds.every(
  (ground) =>
    ground.source_decision_level === "current_court" &&
    ground.belongs_to_current_decision === true &&
    ground.applied_by_current_court === true &&
    ground.linked_to_current_dispositive === true &&
    ground.independently_sufficient_for_current_dispositive === true &&
    (ground.supporting_document_units?.length ?? 0) > 0 &&
    (ground.evidence_hashes?.length ?? 0) > 0,
);
const positiveGroundSummaries = positiveAutonomousGrounds.map((ground) => ground.summary).join(" ");
const counterfactualYesYes =
  /schon aus diesem Grund abzuweisen/i.test(positiveGroundSummaries) &&
  /auch mangels Entgeltlichkeit abzuweisen/i.test(positiveGroundSummaries);
const adversarialPassage = adversarial.passages[0];
const report = {
  generatedAt: new Date().toISOString(),
  officialCases: {
    bge142,
    bge134,
    atf142,
    dtf142,
    case4c4,
    case4a664,
    case1b62,
    case2a348,
  },
  checks: {
    bge_regression_pass:
      bge142.pass &&
      bge134.pass &&
      atf142.pass &&
      dtf142.pass &&
      atf142.normalized.normalized_reference === bge142.normalized.normalized_reference &&
      dtf142.normalized.normalized_reference === bge142.normalized.normalized_reference,
    obiter_adversarial_pass:
      adversarialPassage?.verified_function === "obiter_dictum" &&
      adversarialPassage.autonomousGround === false &&
      adversarialPassage.sufficient_for_dispositive === false &&
      adversarialPassage.semantic_conflicts.includes("open_question_vs_decisive") &&
      adversarialPassage.semantic_conflicts.includes("caller_assertion_vs_source_text") &&
      adversarialPassage.semantic_conflicts.includes("obiter_vs_autonomous_ground"),
    doctrine_4a664_pass:
      case4a664.pass &&
      (case4a664.independent_grounds_count ?? 0) < 3 &&
      doctrineDetails.length > 0 &&
      case4a664.independent_ground_details.every((ground) => ground.autonomous === false),
    case1b62_false_positive_rejected_pass:
      case1b62.pass &&
      case1b62.identity_status === "identity_verified" &&
      case1b62.official_identity_verified === true &&
      case1b62.fetch_status === "fetch_success" &&
      case1b62.reading_status === "full_text_verified_official" &&
      case1b62.ratio_status === "ratio_confirmed" &&
      (case1b62.independent_grounds_count ?? 0) === 0 &&
      case1b62.independent_grounds_reviewed === 0 &&
      case1b62VerifiedAutonomousGrounds.length === 0 &&
      case1b62.independent_ground_details.every((ground) => ground.autonomous === false),
    autonomous_positive_live_case_pass:
      case2a348.pass &&
      case2a348.identity_status === "identity_verified" &&
      case2a348.official_identity_verified === true &&
      case2a348.fetch_status === "fetch_success" &&
      case2a348.reading_status === "full_text_verified_official" &&
      case2a348.ratio_status === "ratio_confirmed" &&
      (case2a348.independent_grounds_count ?? 0) >= 2 &&
      case2a348.independent_grounds_reviewed === case2a348.independent_grounds_count &&
      positiveAutonomousGrounds.length >= 2 &&
      positiveGroundsTraceable &&
      counterfactualYesYes &&
      completeGroundCoverage?.validation_status === "complete" &&
      completeGroundCoverage.no_network_request === true,
    omitted_ground_blocker_pass:
      omittedGroundCoverage?.validation_status === "blocked" &&
      omittedGroundCoverage.blockers.includes("autonomous_ground_not_reviewed") &&
      omittedGroundCoverage.ratio_status === "ratio_not_confirmed" &&
      omittedGroundCoverage.comparability_eligibility === "blocked" &&
      omittedGroundCoverage.drafting_eligibility === "blocked" &&
      omittedGroundCoverage.strategy_eligibility === "blocked" &&
      omittedGroundCoverage.citation_eligibility === "blocked" &&
      omittedGroundCoverage.no_network_request === true,
    autonomous_ground_internal_consistency_pass:
      positiveAutonomousGrounds.length >= 2 &&
      positiveAutonomousGrounds.every((ground) => ground.reviewed === true) &&
      case1b62.independent_ground_details.every(
        (ground) =>
          ground.autonomous_ground_status !== "verified" ||
          ground.source_decision_level !== "lower_instance",
      ),
    multirole_direct_pass:
      multiroleValidation.analysis_integrity.narrative_state_mismatch === false &&
      multiroleValidation.findings.every((finding) => finding.code !== "narrative_state_mismatch"),
    multirole_by_id_pass:
      multiroleValidationById.analysis_integrity.persistence_verified === true &&
      multiroleValidationById.analysis_integrity.analysis_id === multiroleAnalysis.analysis_id &&
      multiroleValidationById.analysis_integrity.narrative_state_mismatch === false,
  },
  adversarial,
  autonomousGrounds: {
    positive_case_reference: case2a348.reference,
    positive_case_status:
      positiveAutonomousGrounds.length >= 2 && counterfactualYesYes
        ? "verified_official_positive_case"
        : "positive_case_not_validated",
    positive_case_document_id: case2a348.document_id,
    positive_case_document_hash: case2a348.document_hash,
    positive_case_final_url: case2a348.final_url,
    positive_case_decision_date: case2a348.decision_date,
    counterfactual_without_ground_2_ground_1_still_sufficient:
      /schon aus diesem Grund abzuweisen/i.test(positiveGroundSummaries) ? "YES" : "NO",
    counterfactual_without_ground_1_ground_2_still_sufficient:
      /auch mangels Entgeltlichkeit abzuweisen/i.test(positiveGroundSummaries) ? "YES" : "NO",
    rejected_candidate_reference: case1b62.reference,
    rejected_candidate_reason:
      "1B_62/2021 is a procedural inadmissibility decision; Fluchtgefahr and Kollusionsgefahr are lower-instance detention grounds, not autonomous grounds of the Federal Supreme Court judgment.",
    rejected_candidate_document_id: case1b62.document_id,
    rejected_candidate_document_hash: case1b62.document_hash,
    rejected_candidate_final_url: case1b62.final_url,
    rejected_candidate_decision_date: case1b62.decision_date,
    verified_grounds: positiveAutonomousGrounds,
    complete_ground_validation: completeGroundCoverage,
    omitted_ground_validation: omittedGroundCoverage,
    rejected_candidate_samples: [
      {
        reference: "1B_62/2021",
        reason:
          "Lower-instance detention grounds; Federal Supreme Court decision is procedural inadmissibility.",
      },
      {
        reference: "4A_664/2024",
        reason:
          "Abstract procedural doctrine about attacking independent lower-court grounds; not a concrete autonomous ground applied by the current court.",
      },
    ],
  },
  multirole: {
    analysis_id: multiroleAnalysis.analysis_id,
    direct_validation: multiroleValidation.analysis_integrity,
    by_id_validation: multiroleValidationById.analysis_integrity,
    direct_findings: multiroleValidation.findings,
    by_id_findings: multiroleValidationById.findings,
  },
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(
  searchAuditPath,
  `${JSON.stringify(
    {
      generatedAt: report.generatedAt,
      objective:
        "Find one official current-court Swiss decision with at least two autonomous grounds that independently support the dispositive.",
      official_sources_considered: [
        "BGer official search",
        "BVGer official source adapters already supported by resolver",
        "BStGer official source adapters already supported by resolver",
        "AR official source adapters already supported by resolver",
      ],
      official_source_used_for_positive_case: "BGer official search",
      positive_case_reference: case2a348.reference,
      positive_case_final_url: case2a348.final_url,
      positive_case_document_hash: case2a348.document_hash,
      positive_case_status: report.autonomousGrounds.positive_case_status,
      search_method:
        "Official-source resolver refresh against Swiss official case adapters; candidates rejected unless full text was official, identity verified, and both grounds belonged to the current court dispositive.",
      accepted_ground_evidence: positiveAutonomousGrounds.map((ground) => ({
        ground_id: ground.ground_id,
        summary: ground.summary,
        supporting_sections: ground.supporting_sections,
        evidence_hashes: ground.evidence_hashes,
        current_court: ground.source_decision_level === "current_court",
        independently_sufficient_for_current_dispositive:
          ground.independently_sufficient_for_current_dispositive,
      })),
      rejected_candidates: report.autonomousGrounds.rejected_candidate_samples,
      false_positive_regression: {
        reference: case1b62.reference,
        pass: report.checks.case1b62_false_positive_rejected_pass,
        reason: report.autonomousGrounds.rejected_candidate_reason,
      },
      counterfactual_validation: {
        ground_1_without_ground_2:
          report.autonomousGrounds.counterfactual_without_ground_2_ground_1_still_sufficient,
        ground_2_without_ground_1:
          report.autonomousGrounds.counterfactual_without_ground_1_ground_2_still_sufficient,
      },
      omitted_ground_validation: omittedGroundCoverage,
    },
    null,
    2,
  )}\n`,
);
console.error(JSON.stringify(report, null, 2));

const passed = Object.values(report.checks).every(Boolean);
process.exit(passed ? 0 : 1);
