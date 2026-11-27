import { z } from "zod";
import { NotFoundError, type ToolRegistry } from "@swiss-legal-mcp/core";
import {
  normalizeCitation,
  parseCitations,
  resolveCitation,
  type CitationResolution,
  type ParsedCitation,
} from "@swiss-legal-mcp/citations";
import type { EntscheidsucheMcpProvider } from "@swiss-legal-mcp/provider-entscheidsuche";
import { makeCantonalCitationLookup, makeCaseLawCitationLookup } from "./citationSupport.js";
import { verifyOfficialCaseReference } from "./jurisprudenceGuardrails.js";
import { buildCitationCalibration } from "./legalCalibration.js";
import { resolveOfficialSwissCase } from "./officialSwissCaseResolver.js";
import { articleParagraph } from "./articleExcerpt.js";
import { normalizeFedlexIdentifier } from "./fedlexIdentifier.js";
import { lawSourceForAbbreviation } from "./quoteVerifier.js";

const languageSchema = z.enum(["de", "fr", "it"]);

function buildTemporalAssessment(
  version:
    | {
        date: string;
        endDate?: string;
        isHistorical: boolean;
        structuredFormatAvailable: boolean;
      }
    | undefined,
  requestDate: string,
) {
  const coversDate =
    version !== undefined &&
    version.date <= requestDate &&
    (version.endDate === undefined || requestDate <= version.endDate);
  return {
    source_metadata: {
      versionDate: version?.date ?? null,
      endDate: version?.endDate ?? null,
      isHistorical: version?.isHistorical ?? null,
      structuredFormatAvailable: version?.structuredFormatAvailable ?? null,
    },
    calculated_temporal_status: version
      ? coversDate
        ? "covers_requested_date"
        : "does_not_cover_requested_date"
      : "not_verified",
    legal_applicability: "not_determined",
    future_version_confirmation: version?.endDate ? "not_verified" : "no_future_version_confirmed",
    inference: [
      ...(version?.isHistorical
        ? ["isHistorical is source metadata, not an automatic legal-applicability conclusion"]
        : []),
      ...(version?.endDate
        ? [
            "endDate alone does not prove a future replacement version without explicit official evidence",
          ]
        : []),
    ],
    confidence: {
      identity_confidence: version ? 0.8 : 0.2,
      extraction_confidence: version?.structuredFormatAvailable ? 0.75 : 0.45,
      temporal_applicability_confidence: coversDate ? 0.65 : 0.35,
      future_version_confidence: version?.endDate ? 0.2 : 0.4,
    },
    warnings: [
      ...(version?.endDate ? ["future_version_not_confirmed_by_endDate_alone"] : []),
      "legal_applicability_requires_contextual_legal_review",
    ],
  };
}

/**
 * Fase 6 (funciones jurídicas avanzadas), primera herramienta activada por
 * prioridad. Verifica UNA cita legal ya identificada por el llamador (no
 * extrae citas de un documento completo -- eso es find_cited_sources/
 * extract_legal_passages, Fase 6 mas adelante). Nunca convierte un match
 * aproximado en una verificacion positiva: ver packages/citations/src/
 * resolver.ts y docs/provider-contracts/citation-resolution.md.
 */
const STALE_WARNINGS_WHEN_LIVE_VERIFIED = new Set([
  "unverified_reference",
  "full_text_not_read",
  "full_text_not_verified",
  "extraction_incomplete",
  "missing_dispositif",
  "missing_factual_section",
  "missing_reasoning_section",
  "possible_context_loss",
  "missing_independent_ground_review",
  "independent_ground_not_reviewed",
  "candidate_only",
  "secondary_source_missing",
  "legacy_verification_without_fetch_blocked",
  "official_source_not_found",
  "unofficial_source",
  "source_unofficial",
]);

function isStaleWhenLiveVerified(warning: string): boolean {
  // El aviso del agregador ("devolvio N resultados reales ... no garantiza unicidad") describe
  // la busqueda auxiliar, no la referencia oficial ya verificada.
  return STALE_WARNINGS_WHEN_LIVE_VERIFIED.has(warning) || /resultados reales/.test(warning);
}

/**
 * Una cita como "Art. 100 BGG" o "Art. 210 Abs. 6 OR" se rechazaba ("solo por abreviatura")
 * aunque la herramienta ya conoce la ley: la tabla de leyes federales verificadas (SR o ELI
 * comprobados) permite pedir el articulo a Fedlex directamente. Solo se acepta el articulo
 * si Fedlex devuelve su texto literal; en cualquier otro caso la cita sigue sin resolver.
 */
async function resolveArticleByAbbreviation(
  citation: ParsedCitation,
  context: Parameters<typeof resolveCitation>[1],
  signal?: AbortSignal,
): Promise<CitationResolution | null> {
  const abbreviation = citation.lawAbbreviation;
  const articleNumber = citation.location?.articleNumber;
  const fedlex = context.legislationProviders?.get("fedlex");
  if (!abbreviation || !articleNumber || !fedlex) return null;
  const law = lawSourceForAbbreviation(abbreviation);
  if (!law) return null;
  try {
    const eli = law.eli ? normalizeFedlexIdentifier(law.eli).workEli : undefined;
    const document = await fedlex.getArticle(
      {
        lawRef: {
          ...(eli ? { eli } : {}),
          ...(law.systematicNumber ? { systematicNumber: law.systematicNumber } : {}),
          language: law.language,
        },
        articleNumber,
      },
      signal,
    );
    if (!document.fullText || document.contentNature !== "literal") return null;
    const warnings = [
      `Resuelta por la abreviatura '${abbreviation}' con la tabla de leyes federales verificadas (SR/ELI comprobados), no por busqueda de Fedlex; el texto del articulo es el literal oficial.`,
    ];
    // Si la cita pide un apartado, debe existir en el texto: un apartado inexistente no se da por verificado.
    const paragraph = Number(citation.location?.paragraph);
    const paragraphMissing =
      Number.isInteger(paragraph) &&
      paragraph > 0 &&
      articleParagraph(document.fullText.replace(/\s+/g, " "), paragraph) === null &&
      paragraph > 1;
    if (paragraphMissing) {
      warnings.push(
        `El articulo existe pero no se localizo el apartado ${paragraph} en su texto oficial: revise la cita antes de usarla.`,
      );
    }
    return {
      parsed: citation,
      match: paragraphMissing ? "probable" : "exact",
      document,
      alternativeCandidates: [],
      warnings,
      evidence: [],
    };
  } catch (error) {
    if (error instanceof NotFoundError) {
      return {
        parsed: citation,
        match: "not_found",
        alternativeCandidates: [],
        warnings: [
          `El articulo ${articleNumber} no figura en ${abbreviation} segun Fedlex (version vigente): la cita no es verificable.`,
        ],
        evidence: [],
      };
    }
    return null;
  }
}

export function registerCitationTools(tools: ToolRegistry): void {
  tools.register({
    name: "verify_legal_citation",
    description:
      "Verifica una cita legal suiza (numero RS/SR federal o cantonal, articulo, referencia BGE/ATF/DTF, numero de expediente o ECLI) contra las fuentes reales ya integradas (Fedlex, entscheidsuche.ch, proveedores cantonales). Nunca genera asesoria legal ni determina automaticamente quien tiene razon -- solo confirma si la cita corresponde a un documento real y con que nivel de confianza (exact/probable/ambiguous/not_found). ECLI nunca se verifica (ningun tribunal suizo indexado asigna ECLI de forma sistematica); una cita solo por abreviatura (ej. 'art. 41 CO' sin numero RS) tampoco se puede resolver (ningun proveedor real expone busqueda por abreviatura).",
    inputSchema: {
      citation: z.string().min(1),
      canton: z.string().length(2).optional(),
      language: languageSchema.optional(),
    },
    requiredProviderIds: [],
    requireAnyProviderIds: ["fedlex", "entscheidsuche"],
    handler: async (input, context) => {
      const parsed = parseCitations(input.citation);
      if (parsed.length === 0) {
        const calibration = buildCitationCalibration({
          normalized: null,
          type: "unresolvable",
          match: "not_found",
          warnings: [
            "No se reconocio ningun formato de cita legal suiza real en el texto (RS/SR, BGE/ATF/DTF, numero de expediente, ECLI o articulo+abreviatura).",
          ],
        });
        return {
          original: input.citation,
          normalized: null,
          type: "unresolvable" as const,
          jurisdiction: null,
          document: null,
          article: null,
          version: null,
          status: null,
          officialSource: null,
          match: "not_found" as const,
          alternativeCandidates: [],
          warnings: [
            "No se reconocio ningun formato de cita legal suiza real en el texto (RS/SR, BGE/ATF/DTF, numero de expediente, ECLI o articulo+abreviatura).",
          ],
          evidence: [],
          ...calibration,
        };
      }

      const citation = parsed[0]!;
      const extraWarnings: string[] =
        parsed.length > 1
          ? [
              `Se encontraron ${parsed.length} citas reales en el texto; se verifico solo la primera ('${citation.raw}'). Para extraer y verificar todas, use find_cited_sources sobre un documento completo.`,
            ]
          : [];

      const entscheidsuche = context.providers.get("entscheidsuche") as
        EntscheidsucheMcpProvider | undefined;

      let resolution = await resolveCitation(citation, {
        ...(context.legislationProviders
          ? { legislationProviders: context.legislationProviders }
          : {}),
        cantonalLookup: makeCantonalCitationLookup(context.providers),
        ...(entscheidsuche ? { caseLawLookup: makeCaseLawCitationLookup(entscheidsuche) } : {}),
        ...(input.canton ? { cantonHint: input.canton } : {}),
        ...(input.language ? { preferredLanguage: input.language } : {}),
      });

      if (resolution.match === "not_found" && citation.type === "unresolvable") {
        const byAbbreviation = await resolveArticleByAbbreviation(citation, {
          ...(context.legislationProviders
            ? { legislationProviders: context.legislationProviders }
            : {}),
        });
        if (byAbbreviation) resolution = byAbbreviation;
      }

      const doc = resolution.document;
      const officialCaseVerification =
        citation.type === "case_number" || citation.type === "bge_atf_dtf"
          ? verifyOfficialCaseReference(normalizeCitation(citation), doc)
          : null;
      const liveOfficialCaseResolution =
        citation.type === "case_number" || citation.type === "bge_atf_dtf"
          ? await resolveOfficialSwissCase({
              case_reference: normalizeCitation(citation),
              require_official_source: true,
              require_full_text: true,
              strict_identity_match: true,
            }).catch((error: unknown) => ({
              legal_use: {
                official_verification_status: "not_verified",
                ratio_status: "ratio_not_confirmed",
              },
              fetch: null,
              identity: { status: "identity_not_verifiable" },
              warnings: [error instanceof Error ? error.message : String(error)],
            }))
          : null;
      const liveCaseVerified =
        liveOfficialCaseResolution?.legal_use.official_verification_status ===
          "full_text_verified_official" &&
        liveOfficialCaseResolution.identity?.status === "identity_verified";
      const officialSource =
        (liveCaseVerified ? liveOfficialCaseResolution?.fetch?.final_url : null) ??
        (doc ? (doc.provenance.officialSourceUrl ?? doc.provenance.sourceUrl) : null);
      // Si la lectura oficial en vivo confirmo texto integro e identidad, la verificacion
      // "heredada" (basada solo en el agregador) y sus avisos ya no describen la situacion:
      // mostrarlos junto a un resultado verificado era contradictorio.
      const verifiedCaseVerification =
        officialCaseVerification && liveCaseVerified
          ? {
              ...officialCaseVerification,
              status: "officially_verified" as const,
              officialSourceUrl: officialSource,
              full_text_verified_official: true,
              // El apartado anidado tambien venia de la verificacion heredada (snippet_only,
              // avisos de texto no leido): se alinea con la lectura oficial en vivo.
              fullTextReading: {
                ...officialCaseVerification.fullTextReading,
                status: "full_text_verified_official" as const,
                full_text_read_unofficial: false,
                full_text_verified_official: true,
                full_text_source_official: true,
                full_text_source_unofficial: false,
                full_text_coverage_percentage: 100,
                unread_sections: [] as string[],
                missing_sections: [] as string[],
                extraction_errors: [] as string[],
                source_url: officialSource,
                warnings: [] as string[],
                coverage: {
                  ...officialCaseVerification.fullTextReading.coverage,
                  extraction_complete: true,
                  coverage_percentage: 100,
                },
              },
              warnings: [] as string[],
            }
          : officialCaseVerification;
      const warnings = [
        ...extraWarnings,
        ...resolution.warnings,
        ...(officialCaseVerification?.warnings ?? []),
        ...(officialCaseVerification && !liveCaseVerified
          ? ["legacy_verification_without_fetch_blocked"]
          : []),
        ...(liveOfficialCaseResolution?.warnings ?? []),
      ].filter((warning) => !liveCaseVerified || !isStaleWhenLiveVerified(warning));
      const calibration = buildCitationCalibration({
        normalized: normalizeCitation(citation),
        type: citation.type,
        match: resolution.match,
        document: doc,
        officialCaseVerification: verifiedCaseVerification,
        liveOfficialCaseResolution,
        warnings,
      });
      return {
        original: citation.raw,
        normalized: normalizeCitation(citation),
        type:
          citation.type === "unresolvable" && doc && resolution.match !== "not_found"
            ? "article_by_abbreviation"
            : citation.type,
        jurisdiction: doc?.jurisdiction ?? null,
        document: doc
          ? {
              id: doc.id,
              provider: doc.provider,
              title: doc.title,
              systematicNumber: doc.legislation?.systematicNumber ?? null,
              eli: doc.legislation?.eli ?? null,
            }
          : null,
        article: citation.location ?? null,
        version: doc?.legislation?.version ?? null,
        status: doc?.legislation?.inForceStatus ?? null,
        officialSource,
        officialCaseVerification:
          officialCaseVerification && liveCaseVerified
            ? verifiedCaseVerification
            : officialCaseVerification
              ? {
                  ...officialCaseVerification,
                  status: "not_verified",
                  full_text_verified_official: false,
                  ratio_status: "ratio_not_confirmed",
                  warnings: [
                    ...officialCaseVerification.warnings,
                    "legacy_verification_without_fetch_blocked",
                  ],
                }
              : null,
        liveOfficialCaseResolution,
        match: liveCaseVerified ? ("exact" as const) : resolution.match,
        alternativeCandidates: resolution.alternativeCandidates.map((candidate) => ({
          providerId: candidate.providerId,
          documentId: candidate.document.id,
          title: candidate.document.title,
        })),
        warnings,
        evidence: [...resolution.evidence, ...(officialCaseVerification?.evidence ?? [])],
        ...calibration,
      };
    },
  });

  tools.register({
    name: "identify_applicable_version",
    description:
      "Identifica la version de una ley (o de un articulo) aplicable en una fecha concreta. Solo tiene soporte real para legislacion federal (Fedlex: version.date/endDate/inForceStatus reales, ver docs/provider-contracts/fedlex.md) -- ningun proveedor cantonal integrado expone historial de versiones verificado (solo la version vigente actual), asi que una cita cantonal devuelve explicitamente 'insufficient_history', nunca una version inventada.",
    inputSchema: {
      citation: z.string().min(1),
      date: z.iso.date(),
      canton: z.string().length(2).optional(),
      language: languageSchema.optional(),
    },
    requiredProviderIds: [],
    requireAnyProviderIds: ["fedlex"],
    handler: async (input, context) => {
      const parsedAll = parseCitations(input.citation);
      const systematicCitation = parsedAll.find((c) => c.type === "systematic_number");
      const articleCitation = parsedAll.find((c) => c.location?.articleNumber);

      const base = { original: input.citation, date: input.date };

      if (!systematicCitation) {
        return {
          ...base,
          status: "not_found" as const,
          document: null,
          article: null,
          officialSource: null,
          warnings: [
            "No se reconocio ningun numero sistematico (RS/SR) en la cita -- identify_applicable_version requiere uno para resolver una version temporal real.",
          ],
          evidence: [],
        };
      }

      if (input.canton) {
        return {
          ...base,
          status: "insufficient_history" as const,
          document: null,
          article: articleCitation?.location ?? null,
          officialSource: null,
          warnings: [
            `Ningun proveedor cantonal integrado expone historial de versiones verificado (canton '${input.canton.toUpperCase()}'): solo se puede confirmar la version vigente actual, nunca la version aplicable en una fecha concreta del pasado o futuro. Ver docs/providers/cantonal-legislation.md.`,
          ],
          evidence: [],
        };
      }

      const fedlex = context.legislationProviders?.get("fedlex");
      if (!fedlex) {
        return {
          ...base,
          status: "not_found" as const,
          document: null,
          article: null,
          officialSource: null,
          warnings: ["Proveedor 'fedlex' no disponible en este contexto."],
          evidence: [],
        };
      }

      const language = input.language ?? "de";
      const lawRef = {
        systematicNumber: systematicCitation.systematicNumber!,
        language,
        date: input.date,
      };

      try {
        if (articleCitation?.location?.articleNumber) {
          const result = await fedlex.getArticleAtDate(
            { lawRef, articleNumber: articleCitation.location.articleNumber },
            input.date,
          );
          return {
            ...base,
            status: "applicable_version_found" as const,
            document: {
              id: result.document.id,
              title: result.document.title,
              systematicNumber: result.document.legislation?.systematicNumber ?? null,
              eli: result.document.legislation?.eli ?? null,
            },
            article: articleCitation.location,
            version: result.document.legislation?.version ?? null,
            temporalAssessment: buildTemporalAssessment(
              result.document.legislation?.version,
              input.date,
            ),
            chosenEli: result.evidence.chosenEli,
            reason: result.evidence.reason,
            officialSource:
              result.document.provenance.officialSourceUrl ?? result.document.provenance.sourceUrl,
            warnings: [
              ...result.warnings,
              ...buildTemporalAssessment(result.document.legislation?.version, input.date).warnings,
            ],
            evidence: [
              {
                providerConsulted: "fedlex",
                sourceUrl: result.document.provenance.sourceUrl,
                officialCharacter: result.document.provenance.officialCharacter,
              },
            ],
          };
        }

        const doc = await fedlex.getLaw(lawRef);
        return {
          ...base,
          status: "applicable_version_found" as const,
          document: {
            id: doc.id,
            title: doc.title,
            systematicNumber: doc.legislation?.systematicNumber ?? null,
            eli: doc.legislation?.eli ?? null,
          },
          article: null,
          version: doc.legislation?.version ?? null,
          temporalAssessment: buildTemporalAssessment(doc.legislation?.version, input.date),
          officialSource: doc.provenance.officialSourceUrl ?? doc.provenance.sourceUrl,
          warnings: buildTemporalAssessment(doc.legislation?.version, input.date).warnings,
          evidence: [
            {
              providerConsulted: "fedlex",
              sourceUrl: doc.provenance.sourceUrl,
              officialCharacter: doc.provenance.officialCharacter,
            },
          ],
        };
      } catch (error) {
        return {
          ...base,
          status: "not_found" as const,
          document: null,
          article: articleCitation?.location ?? null,
          officialSource: null,
          warnings: [
            `Fedlex no pudo resolver la version aplicable: ${error instanceof Error ? error.message : String(error)}`,
          ],
          evidence: [],
        };
      }
    },
  });
}
