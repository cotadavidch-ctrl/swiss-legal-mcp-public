import {
  computeContentHash,
  parseNormalizedDocument,
  type NormalizedDocument,
} from "@swiss-legal-mcp/documents";

const FIXTURE_TEXT_1 = "Texto de prueba: considerando primero, articulo 41 CO.";
const FIXTURE_TEXT_2 = "Texto de prueba: sentencia cantonal ficticia de Zurich.";
const LEGAL_AID_AR_EVAL_TEXT =
  "Evaluation fixture: anonymized legal-aid denial appeal in Appenzell Ausserrhoden. " +
  "The applicant requested unentgeltliche Rechtspflege and alleges that Bank A current-account funds " +
  "were moved through an own transit savings account before transfer to Bank B. The final " +
  "transit-account balance and complete bank statements are not confirmed in this fixture. The applicant " +
  "disputes any duplicate counting of assets and raises a possible Art. 56 ZPO clarification issue.";

/**
 * Documentos sinteticos usados unicamente por FixtureProvider en pruebas.
 * Nunca representan una sentencia, norma o fuente real: si aparecieran en
 * una respuesta de produccion seria un error grave (ver principio "nunca
 * inventar una sentencia, norma, cita, fecha, tribunal o enlace").
 */
export const FIXTURE_DOCUMENTS: readonly NormalizedDocument[] = [
  parseNormalizedDocument({
    id: "fixture:case-1",
    provider: "fixture",
    documentType: "case",
    jurisdiction: { level: "federal" },
    sourceOriginalId: "fixture-case-1",
    date: { decisionOrEnactment: "2024-03-01" },
    language: "de",
    title: "Fixture: sentencia federal de prueba",
    fullText: FIXTURE_TEXT_1,
    articlesCited: ["OR Art. 41"],
    provenance: {
      sourceUrl: "https://fixture.invalid/case-1",
      retrievedAt: "2026-07-25T00:00:00.000Z",
      contentHash: computeContentHash(FIXTURE_TEXT_1),
      officialCharacter: "unofficial_aggregator",
      aggregatorName: "fixture-test-provider",
      aggregatorUrl: "https://fixture.invalid/aggregator",
    },
    contentNature: "literal",
    rawMetadata: { fixture: true },
  }),
  parseNormalizedDocument({
    id: "fixture:case-2",
    provider: "fixture",
    documentType: "case",
    jurisdiction: { level: "cantonal", canton: "ZH" },
    sourceOriginalId: "fixture-case-2",
    date: { decisionOrEnactment: "2023-11-20" },
    language: "de",
    title: "Fixture: sentencia cantonal de prueba (Zurich)",
    fullText: FIXTURE_TEXT_2,
    provenance: {
      sourceUrl: "https://fixture.invalid/case-2",
      retrievedAt: "2026-07-25T00:00:00.000Z",
      contentHash: computeContentHash(FIXTURE_TEXT_2),
      officialCharacter: "unofficial_aggregator",
      aggregatorName: "fixture-test-provider",
      aggregatorUrl: "https://fixture.invalid/aggregator",
    },
    contentNature: "literal",
    rawMetadata: { fixture: true },
  }),
  parseNormalizedDocument({
    id: "fixture:legal-aid-ar",
    provider: "fixture",
    documentType: "case",
    jurisdiction: { level: "cantonal", canton: "AR" },
    sourceOriginalId: "fixture-legal-aid-ar",
    date: { decisionOrEnactment: "2026-02-20" },
    language: "de",
    title: "Fixture: anonymized AR legal-aid appeal evaluation case",
    fullText: LEGAL_AID_AR_EVAL_TEXT,
    articlesCited: ["ZPO Art. 56"],
    provenance: {
      sourceUrl: "https://fixture.invalid/legal-aid-ar",
      retrievedAt: "2026-08-03T00:00:00.000Z",
      contentHash: computeContentHash(LEGAL_AID_AR_EVAL_TEXT),
      officialCharacter: "unofficial_aggregator",
      aggregatorName: "fixture-test-provider",
      aggregatorUrl: "https://fixture.invalid/aggregator",
    },
    contentNature: "literal",
    rawMetadata: { fixture: true, evaluationCase: true },
  }),
];
