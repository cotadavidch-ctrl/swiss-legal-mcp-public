import type { LegislationProviderRegistry } from "@swiss-legal-mcp/core";
import type {
  CitationCandidate,
  CitationEvidenceEntry,
  CitationResolution,
  ParsedCitation,
} from "./citationTypes.js";
import { normalizeCitation } from "./normalizer.js";

/**
 * Puerto generico para resolver una cita cantonal (numero sistematico) sin
 * acoplar este paquete a ningun proveedor cantonal concreto -- lo implementa
 * el llamador (apps/mcp-server) usando los proveedores cantonales ya
 * registrados (canton-aware, ver apps/mcp-server/src/tools/cantonalTools.ts).
 */
export interface CantonalCitationLookupPort {
  resolveBySystematicNumber(
    systematicNumber: string,
    cantonCode?: string,
  ): Promise<readonly CitationCandidate[]>;
}

/**
 * Puerto generico para resolver una cita jurisprudencial (BGE/ATF/DTF o
 * numero de expediente) contra la fuente real ya integrada
 * (entscheidsuche.ch, agregador no oficial -- ver ADR de resolucion de
 * citas). Nunca resuelve ECLI: no hay ningun campo real poblado por ningun
 * proveedor (ver docs/provider-contracts/citation-resolution.md).
 */
export interface CaseLawCitationLookupPort {
  resolveByReference(reference: string): Promise<readonly CitationCandidate[]>;
}

export interface CitationResolutionContext {
  /** Para citas `systematic_number`: se intenta primero contra Fedlex (federal, ELI real). */
  readonly legislationProviders?: LegislationProviderRegistry;
  readonly cantonalLookup?: CantonalCitationLookupPort;
  readonly caseLawLookup?: CaseLawCitationLookupPort;
  /** Idioma preferido para la resolucion federal (Fedlex es multilingue real). Default "de". */
  readonly preferredLanguage?: "de" | "fr" | "it";
  /** Canton explicito del llamador, para desambiguar un numero sistematico cantonal reutilizado entre cantones. */
  readonly cantonHint?: string;
}

function evidence(entry: CitationEvidenceEntry): CitationEvidenceEntry {
  return entry;
}

async function resolveSystematicNumber(
  citation: ParsedCitation,
  ctx: CitationResolutionContext,
): Promise<CitationResolution> {
  const warnings: string[] = [];
  const evidenceEntries: CitationEvidenceEntry[] = [];
  const candidates: CitationCandidate[] = [];
  const systematicNumber = citation.systematicNumber!;

  const fedlex = ctx.legislationProviders?.get("fedlex");
  if (fedlex) {
    try {
      const result = await fedlex.searchLegislation({
        systematicNumber,
        language: ctx.preferredLanguage ?? "de",
      });
      evidenceEntries.push(
        evidence({
          providerConsulted: "fedlex",
          sourceUrl: result.officialAttribution.sourceUrl,
          officialCharacter: result.officialAttribution.officialCharacter,
          note: `${result.items.length} resultado(s) real(es) para systematicNumber='${systematicNumber}'`,
        }),
      );
      if (result.items.length > 0) {
        for (const item of result.items) {
          const doc = await fedlex.getLaw({
            eli: item.eli,
            language: ctx.preferredLanguage ?? "de",
          });
          candidates.push({ document: doc, providerId: "fedlex" });
        }
      }
    } catch (error) {
      warnings.push(
        `Fedlex no pudo resolver '${systematicNumber}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    warnings.push("Proveedor 'fedlex' no disponible en este contexto de resolucion.");
  }

  if (ctx.cantonalLookup) {
    try {
      const cantonalCandidates = await ctx.cantonalLookup.resolveBySystematicNumber(
        systematicNumber,
        ctx.cantonHint,
      );
      for (const candidate of cantonalCandidates) {
        candidates.push(candidate);
        evidenceEntries.push(
          evidence({
            providerConsulted: candidate.providerId,
            sourceUrl: candidate.document.provenance.sourceUrl,
            officialCharacter: candidate.document.provenance.officialCharacter,
            note: "coincidencia cantonal real por numero sistematico",
          }),
        );
      }
    } catch (error) {
      warnings.push(
        `Busqueda cantonal para '${systematicNumber}' fallo: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (candidates.length === 0) {
    warnings.push(
      "Un numero sistematico puede corresponder a la legislacion federal (RS/SR) o a la de cualquier canton con numeracion propia -- ninguna fuente real consultada devolvio resultados.",
    );
    return {
      parsed: citation,
      match: "not_found",
      alternativeCandidates: [],
      warnings,
      evidence: evidenceEntries,
    };
  }

  if (candidates.length === 1) {
    const only = candidates[0]!;
    const isFederalEliMatch = only.providerId === "fedlex";
    return {
      parsed: citation,
      match: isFederalEliMatch ? "exact" : "probable",
      document: only.document,
      alternativeCandidates: [],
      warnings,
      evidence: evidenceEntries,
    };
  }

  warnings.push(
    `El numero sistematico '${systematicNumber}' es ambiguo: ${candidates.length} candidatos reales (numero RS reutilizado entre jurisdicciones -- ver docs/provider-contracts/citation-resolution.md). Especifique 'cantonHint' para desambiguar.`,
  );
  return {
    parsed: citation,
    match: "ambiguous",
    alternativeCandidates: candidates,
    warnings,
    evidence: evidenceEntries,
  };
}

async function resolveCaseLaw(
  citation: ParsedCitation,
  ctx: CitationResolutionContext,
): Promise<CitationResolution> {
  const warnings: string[] = [];
  const evidenceEntries: CitationEvidenceEntry[] = [];

  if (!ctx.caseLawLookup) {
    warnings.push(
      "No hay ningun proveedor de jurisprudencia configurado en este contexto de resolucion.",
    );
    return {
      parsed: citation,
      match: "not_found",
      alternativeCandidates: [],
      warnings,
      evidence: evidenceEntries,
    };
  }

  const reference = normalizeCitation(citation);
  let candidates: readonly CitationCandidate[];
  try {
    candidates = await ctx.caseLawLookup.resolveByReference(reference);
  } catch (error) {
    warnings.push(
      `La busqueda jurisprudencial para '${reference}' fallo: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      parsed: citation,
      match: "not_found",
      alternativeCandidates: [],
      warnings,
      evidence: evidenceEntries,
    };
  }

  for (const candidate of candidates) {
    evidenceEntries.push(
      evidence({
        providerConsulted: candidate.providerId,
        sourceUrl:
          candidate.document.provenance.officialSourceUrl ??
          candidate.document.provenance.sourceUrl,
        officialCharacter: candidate.document.provenance.officialCharacter,
        note: "coincidencia real por referencia de caso (busqueda de frase exacta)",
      }),
    );
  }

  if (candidates.length === 0) {
    return {
      parsed: citation,
      match: "not_found",
      alternativeCandidates: [],
      warnings,
      evidence: evidenceEntries,
    };
  }
  if (candidates.length === 1) {
    return {
      parsed: citation,
      match: "probable",
      document: candidates[0]!.document,
      alternativeCandidates: [],
      warnings,
      evidence: evidenceEntries,
    };
  }
  warnings.push(
    `La referencia '${reference}' devolvio ${candidates.length} resultados reales -- una cita BGE/ATF/DTF puede citarse desde multiples sentencias que la mencionan; entscheidsuche.ch es un agregador no oficial, nunca garantiza unicidad.`,
  );
  return {
    parsed: citation,
    match: "ambiguous",
    alternativeCandidates: candidates,
    warnings,
    evidence: evidenceEntries,
  };
}

/**
 * Resuelve una unica cita ya parseada contra las fuentes reales
 * disponibles en `ctx`. Nunca inventa una fuente: si un puerto no se pasa,
 * ese camino de resolucion queda documentado como no disponible en
 * `warnings`, no se omite silenciosamente.
 */
export async function resolveCitation(
  citation: ParsedCitation,
  ctx: CitationResolutionContext,
): Promise<CitationResolution> {
  switch (citation.type) {
    case "systematic_number":
      return resolveSystematicNumber(citation, ctx);
    case "bge_atf_dtf":
    case "case_number":
      return resolveCaseLaw(citation, ctx);
    case "ecli":
      return {
        parsed: citation,
        match: "not_found",
        alternativeCandidates: [],
        warnings: [
          "ECLI no se puede verificar: ningun tribunal suizo indexado por las fuentes integradas asigna ECLI de forma sistematica (ver docs/source-audit.md, seccion 1). El formato es valido pero no existe ningun dato real que lo confirme.",
        ],
        evidence: [],
      };
    case "unresolvable":
    default:
      return {
        parsed: citation,
        match: "not_found",
        alternativeCandidates: [],
        warnings: [
          citation.lawAbbreviation
            ? `No se puede resolver una cita solo por abreviatura ('${citation.lawAbbreviation}'): Fedlex declara 'searchByAbbreviation: false' (sin busqueda por abreviatura verificada en ningun proveedor real). Proporcione el numero sistematico (RS/SR) para resolver.`
            : "Cita reconocida pero sin tipo resoluble (falta numero sistematico, referencia BGE/ATF/DTF, numero de expediente o ECLI).",
        ],
        evidence: [],
      };
  }
}
