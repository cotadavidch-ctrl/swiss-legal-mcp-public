import {
  AmbiguousCitationError,
  NotFoundError,
  ProviderResponseError,
  type AmendmentHistoryEntry,
  type ArticleAtDateResult,
  type GetArticleRef,
  type GetLawRef,
  type HealthStatus,
  type LegislationProvider,
  type LegislationSearchQuery,
  type LegislationSearchResult,
  type ProviderCapabilities,
} from "@swiss-legal-mcp/core";
import type {
  ArticleVersionComparison,
  Language,
  LegislationFormat,
} from "@swiss-legal-mcp/documents";
import {
  findArticleByNumber,
  findArticleInAnnex,
  parseAkomaNtosoXml,
  XmlSecurityError,
  type AkomaNtosoArticle,
} from "./xml/akomaNtosoParser.js";
import type { FedlexConfig } from "./config.js";
import {
  buildDescribeQuery,
  buildFindWorksBySystematicNumberQuery,
  buildListConsolidationsQuery,
  buildSearchByTitleQuery,
  FedlexSparqlClient,
} from "./sparqlClient.js";
import {
  extractColumn,
  groupPredicateObjectBindings,
  type SparqlBindingValue,
} from "./remoteTypes.js";
import { FedlexVocabularyError, parseInForceStatusUri, parseUserFormatUri } from "./vocabulary.js";
import {
  FedlexMappingError,
  mapFedlexArticleToNormalizedDocument,
  mapFedlexLawToNormalizedDocument,
  type FedlexConsolidationVersion,
  type FedlexManifestationInfo,
} from "./mapper.js";

const PROVIDER_ID = "fedlex";

const JOLUX_HAS_LEGAL_ID =
  "http://data.legilux.public.lu/resource/ontology/jolux#historicalLegalId";
const JOLUX_IS_REALIZED_BY = "http://data.legilux.public.lu/resource/ontology/jolux#isRealizedBy";
const JOLUX_IN_FORCE_STATUS = "http://data.legilux.public.lu/resource/ontology/jolux#inForceStatus";
const JOLUX_DATE_ENTRY_IN_FORCE =
  "http://data.legilux.public.lu/resource/ontology/jolux#dateEntryInForce";
const JOLUX_DATE_NO_LONGER_IN_FORCE =
  "http://data.legilux.public.lu/resource/ontology/jolux#dateNoLongerInForce";
const JOLUX_TITLE = "http://data.legilux.public.lu/resource/ontology/jolux#title";
const JOLUX_IS_EMBODIED_BY = "http://data.legilux.public.lu/resource/ontology/jolux#isEmbodiedBy";
const JOLUX_USER_FORMAT = "http://data.legilux.public.lu/resource/ontology/jolux#userFormat";
const JOLUX_IS_EXEMPLIFIED_BY =
  "http://data.legilux.public.lu/resource/ontology/jolux#isExemplifiedBy";

const LANGUAGE_TO_EU_CODE: Readonly<Record<Language, string>> = {
  de: "DEU",
  fr: "FRA",
  it: "ITA",
  rm: "ROH",
  en: "ENG",
};

/**
 * Matriz de capacidades reales de FedlexProvider, verificada en vivo en
 * Fase 3 (ver docs/provider-contracts/fedlex.md). `searchByAbbreviation` y
 * `transitionalProvisions` quedan en `false` porque no se verifico/implemento
 * soporte real para ellas en esta fase -- no se activan las herramientas
 * correspondientes (ver docs/tool-catalog.md).
 */
export const FEDLEX_CAPABILITIES: ProviderCapabilities = {
  fullTextSearch: true,
  searchByTitle: true,
  searchByAbbreviation: false,
  searchBySystematicNumber: true,
  searchByEli: true,
  getCurrentVersion: true,
  getHistoricalVersion: true,
  compareVersions: true,
  getArticle: true,
  getArticleAtDate: true,
  amendmentHistory: true,
  transitionalProvisions: false,
  entryIntoForce: true,
  repealInformation: true,
  multilingual: true,
  rdf: true,
  xml: true,
  akomaNtoso: true,
  html: true,
  pdf: true,
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstValue(map: Map<string, SparqlBindingValue[]>, predicate: string): string | undefined {
  return map.get(predicate)?.[0]?.value;
}

interface ResolvedConsolidation extends FedlexConsolidationVersion {
  readonly isHistorical: boolean;
}

/**
 * Proveedor real de legislacion federal suiza vía Fedlex (Fase 3). Implementa
 * unicamente las capacidades observadas y verificadas en vivo (ver
 * docs/provider-contracts/fedlex.md) -- nunca infiere relaciones que Fedlex
 * no expone (p.ej. amendingActs queda vacio: no existe un predicado real que
 * vincule una Consolidation con el acto que la modifico).
 */
export class FedlexProvider implements LegislationProvider {
  readonly id = PROVIDER_ID;
  readonly capabilities = FEDLEX_CAPABILITIES;
  private readonly client: FedlexSparqlClient;

  constructor(config: FedlexConfig, client?: FedlexSparqlClient) {
    this.client = client ?? new FedlexSparqlClient(config);
  }

  async healthCheck(signal?: AbortSignal): Promise<HealthStatus> {
    const checkedAt = new Date().toISOString();
    try {
      await this.client.ask("ASK { ?s ?p ?o }", signal);
      return { healthy: true, checkedAt };
    } catch (error) {
      return {
        healthy: false,
        checkedAt,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Traduce errores internos de parseo/mapeo/vocabulario (XmlSecurityError,
   * FedlexVocabularyError, FedlexMappingError -- ninguno forma parte de
   * LegalMcpError) a ProviderResponseError antes de que puedan escapar a la
   * capa MCP como un INTERNAL_ERROR generico. Cualquier otro error (p.ej.
   * NotFoundError, AmbiguousCitationError) se relanza sin cambios: ya son
   * errores tipados correctos. Corrige la deuda tecnica identificada en la
   * revision arquitectonica pre-Fase 4.
   */
  private translateDataError(error: unknown, operationName: string): never {
    if (
      error instanceof XmlSecurityError ||
      error instanceof FedlexVocabularyError ||
      error instanceof FedlexMappingError
    ) {
      throw new ProviderResponseError(PROVIDER_ID, operationName, error.message);
    }
    throw error;
  }

  private async describeAsMap(
    iri: string,
    cacheKey?: string,
    signal?: AbortSignal,
  ): Promise<Map<string, SparqlBindingValue[]>> {
    const result = await this.client.query(
      buildDescribeQuery(iri),
      cacheKey ?? `describe:${iri}`,
      signal,
    );
    return groupPredicateObjectBindings(result);
  }

  private async resolveWorkEli(ref: GetLawRef, signal?: AbortSignal): Promise<string> {
    if (ref.eli) return ref.eli;
    if (ref.documentId) return ref.documentId;
    if (ref.systematicNumber) {
      const result = await this.client.query(
        buildFindWorksBySystematicNumberQuery(ref.systematicNumber),
        `rs:${ref.systematicNumber}`,
        signal,
      );
      const works = extractColumn(result, "work").map((v) => v.value);
      if (works.length === 0) {
        throw new NotFoundError(
          ref.systematicNumber,
          `No se encontro ningun acto con RS/SR '${ref.systematicNumber}'.`,
        );
      }
      if (works.length > 1) {
        throw new AmbiguousCitationError(ref.systematicNumber, works);
      }
      return works[0]!;
    }
    throw new NotFoundError(
      "(sin identificador)",
      "Se requiere eli, systematicNumber o documentId.",
    );
  }

  private async getConsolidations(
    workEli: string,
    signal?: AbortSignal,
  ): Promise<FedlexConsolidationVersion[]> {
    const result = await this.client.query(
      buildListConsolidationsQuery(workEli),
      `consolidations:${workEli}`,
      signal,
    );
    return result.results.bindings.map((binding) => ({
      consolidationEli: binding["consolidation"]!.value,
      dateApplicability: binding["dateApplicability"]!.value,
      ...(binding["dateEndApplicability"]
        ? { dateEndApplicability: binding["dateEndApplicability"].value }
        : {}),
    }));
  }

  private resolveConsolidationForDate(
    consolidations: readonly FedlexConsolidationVersion[],
    targetDate: string,
  ): ResolvedConsolidation | undefined {
    const sorted = [...consolidations].sort((a, b) =>
      a.dateApplicability.localeCompare(b.dateApplicability),
    );
    const match = sorted.find(
      (c) =>
        c.dateApplicability <= targetDate &&
        (!c.dateEndApplicability || c.dateEndApplicability >= targetDate),
    );
    if (!match) return undefined;
    const isCurrent = match === sorted[sorted.length - 1] && !match.dateEndApplicability;
    return { ...match, isHistorical: !isCurrent };
  }

  private async getManifestation(
    consolidationEli: string,
    language: Language,
    signal?: AbortSignal,
  ): Promise<FedlexManifestationInfo | undefined> {
    const exprEli = `${consolidationEli}/${language}`;
    const exprMap = await this.describeAsMap(exprEli, undefined, signal);
    const manifestationIris = (exprMap.get(JOLUX_IS_EMBODIED_BY) ?? []).map((v) => v.value);
    const preference: LegislationFormat[] = ["xml", "html", "pdf", "docx", "doc"];
    const candidates: FedlexManifestationInfo[] = [];
    for (const manifestationIri of manifestationIris) {
      const manifestationMap = await this.describeAsMap(manifestationIri, undefined, signal);
      const formatUri = firstValue(manifestationMap, JOLUX_USER_FORMAT);
      const url = firstValue(manifestationMap, JOLUX_IS_EXEMPLIFIED_BY);
      if (!formatUri || !url) continue;
      candidates.push({ format: parseUserFormatUri(formatUri), url });
    }
    for (const preferred of preference) {
      const found = candidates.find((c) => c.format === preferred);
      if (found) return found;
    }
    return candidates[0];
  }

  private async getWorkTitleAndMetadata(workEli: string, language: Language, signal?: AbortSignal) {
    const workMap = await this.describeAsMap(workEli, undefined, signal);
    const systematicNumber = firstValue(workMap, JOLUX_HAS_LEGAL_ID);
    const inForceStatusUri = firstValue(workMap, JOLUX_IN_FORCE_STATUS);
    const entryIntoForceDate = firstValue(workMap, JOLUX_DATE_ENTRY_IN_FORCE);
    const repealDate = firstValue(workMap, JOLUX_DATE_NO_LONGER_IN_FORCE);

    const realizedBy = (workMap.get(JOLUX_IS_REALIZED_BY) ?? []).map((v) => v.value);
    const expressionEli =
      realizedBy.find((iri) => iri.endsWith(`/${language}`)) ?? `${workEli}/${language}`;
    const exprMap = await this.describeAsMap(expressionEli, undefined, signal);
    const workTitle = firstValue(exprMap, JOLUX_TITLE);
    if (!workTitle) {
      throw new NotFoundError(
        expressionEli,
        `Fedlex no expone una expresion en idioma '${language}' para '${workEli}'.`,
      );
    }

    return {
      workTitle,
      ...(systematicNumber !== undefined ? { systematicNumber } : {}),
      inForceStatus: inForceStatusUri
        ? parseInForceStatusUri(inForceStatusUri)
        : ("other" as const),
      ...(entryIntoForceDate !== undefined ? { entryIntoForceDate } : {}),
      ...(repealDate !== undefined ? { repealDate } : {}),
    };
  }

  async getLaw(ref: GetLawRef, signal?: AbortSignal) {
    try {
      const workEli = await this.resolveWorkEli(ref, signal);
      const consolidations = await this.getConsolidations(workEli, signal);
      if (consolidations.length === 0) {
        throw new NotFoundError(
          workEli,
          `Fedlex no expone ninguna version fechada para '${workEli}'.`,
        );
      }
      const targetDate = ref.date ?? todayIso();
      const resolved = this.resolveConsolidationForDate(consolidations, targetDate);
      if (!resolved) {
        throw new NotFoundError(
          workEli,
          `No hay ninguna version aplicable en la fecha '${targetDate}' para '${workEli}' (fuera de cobertura historica).`,
        );
      }
      const metadata = await this.getWorkTitleAndMetadata(workEli, ref.language, signal);
      const manifestation = await this.getManifestation(
        resolved.consolidationEli,
        ref.language,
        signal,
      );
      const structuredFormatAvailable = manifestation?.format === "xml";

      // get_law devuelve la manifestacion oficial mas apropiada (su URL real,
      // ver legislation.manifestation) en vez de texto completo embebido: el
      // cuerpo legible por articulo se obtiene con get_article, que si
      // descarga y parsea el XML real (ver getArticleInternal).

      return mapFedlexLawToNormalizedDocument({
        workEli,
        ...metadata,
        consolidation: resolved,
        isHistorical: resolved.isHistorical,
        language: ref.language,
        ...(manifestation !== undefined ? { manifestation } : {}),
        structuredFormatAvailable,
        retrievedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.translateDataError(error, "get_law");
    }
  }

  private async getArticleInternal(
    ref: GetArticleRef,
    targetDate: string,
    signal?: AbortSignal,
  ): Promise<{
    document: ReturnType<typeof mapFedlexArticleToNormalizedDocument>;
    resolved: ResolvedConsolidation;
  }> {
    try {
      const workEli = await this.resolveWorkEli(ref.lawRef, signal);
      const consolidations = await this.getConsolidations(workEli, signal);
      const resolved = this.resolveConsolidationForDate(consolidations, targetDate);
      if (!resolved) {
        throw new NotFoundError(
          workEli,
          `No hay ninguna version aplicable en la fecha '${targetDate}' para '${workEli}' (fuera de cobertura historica).`,
        );
      }
      const metadata = await this.getWorkTitleAndMetadata(workEli, ref.lawRef.language, signal);
      const manifestation = await this.getManifestation(
        resolved.consolidationEli,
        ref.lawRef.language,
        signal,
      );
      if (manifestation?.format !== "xml") {
        throw new NotFoundError(
          ref.articleNumber,
          `La version del '${targetDate}' de '${workEli}' no tiene manifestacion XML/Akoma Ntoso (hueco historico real, ver docs/provider-contracts/fedlex.md); extraccion de articulo individual no disponible.`,
        );
      }
      const xml = await this.client.fetchManifestation(manifestation.url, signal);
      const tree = parseAkomaNtosoXml(xml);
      const article: AkomaNtosoArticle | undefined = ref.annexContext
        ? findArticleInAnnex(tree, ref.annexContext, ref.articleNumber)
        : findArticleByNumber(tree, ref.articleNumber);
      if (!article) {
        const location = ref.annexContext
          ? `el anexo '${ref.annexContext}'`
          : "el cuerpo principal";
        throw new NotFoundError(
          ref.articleNumber,
          `No se encontro el articulo '${ref.articleNumber}' en ${location} de '${workEli}'.`,
        );
      }

      const document = mapFedlexArticleToNormalizedDocument({
        workEli,
        ...metadata,
        consolidation: resolved,
        isHistorical: resolved.isHistorical,
        language: ref.lawRef.language,
        manifestation,
        structuredFormatAvailable: true,
        articleNumber: ref.articleNumber,
        ...(article.heading !== undefined ? { articleHeading: article.heading } : {}),
        articleText: article.fullText,
        retrievedAt: new Date().toISOString(),
      });

      return { document, resolved };
    } catch (error) {
      this.translateDataError(error, "get_article");
    }
  }

  async getArticle(ref: GetArticleRef, signal?: AbortSignal) {
    const targetDate = ref.lawRef.date ?? todayIso();
    const { document } = await this.getArticleInternal(ref, targetDate, signal);
    return document;
  }

  async getArticleAtDate(
    ref: GetArticleRef,
    date: string,
    signal?: AbortSignal,
  ): Promise<ArticleAtDateResult> {
    const { document, resolved } = await this.getArticleInternal(ref, date, signal);
    const warnings: string[] = [];
    if (resolved.isHistorical) {
      warnings.push(
        `La version elegida (${resolved.consolidationEli}) es historica; verifique que la cobertura de Fedlex incluya la fecha exacta solicitada.`,
      );
    }
    return {
      document,
      evidence: {
        chosenEli: resolved.consolidationEli,
        reason: `Version cuya vigencia (${resolved.dateApplicability} - ${resolved.dateEndApplicability ?? "sin fin conocido"}) cubre la fecha solicitada '${date}'.`,
      },
      warnings,
    };
  }

  async compareArticleVersions(
    ref: GetArticleRef,
    dateBefore: string,
    dateAfter: string,
    signal?: AbortSignal,
  ): Promise<ArticleVersionComparison> {
    const before = await this.getArticleInternal(ref, dateBefore, signal);
    const after = await this.getArticleInternal(ref, dateAfter, signal);
    const beforeText = before.document.fullText ?? "";
    const afterText = after.document.fullText ?? "";
    // getArticleInternal ya exige manifestacion XML real (lanza NotFoundError
    // en caso contrario), asi que ambos textos siempre provienen de
    // extraccion estructural Akoma Ntoso -- la comparacion es literal por
    // construccion, nunca una aproximacion sobre HTML/PDF sin estructura.
    const comparisonNature = "literal" as const;

    return {
      articleNumber: ref.articleNumber,
      language: ref.lawRef.language,
      before: {
        eli: `${before.resolved.consolidationEli}/${ref.lawRef.language}`,
        date: before.resolved.dateApplicability,
        text: beforeText,
      },
      after: {
        eli: `${after.resolved.consolidationEli}/${ref.lawRef.language}`,
        date: after.resolved.dateApplicability,
        text: afterText,
      },
      changes:
        beforeText === afterText
          ? [{ kind: "unchanged", beforeText, afterText }]
          : [{ kind: "modified", beforeText, afterText }],
      comparisonNature,
    };
  }

  async getAmendmentHistory(
    ref: GetLawRef,
    signal?: AbortSignal,
  ): Promise<readonly AmendmentHistoryEntry[]> {
    const workEli = await this.resolveWorkEli(ref, signal);
    const consolidations = await this.getConsolidations(workEli, signal);
    // Fedlex no expone un predicado real que vincule una Consolidation con el
    // acto (OC/AS) que la modifico -- verificado en vivo (describe de una
    // Consolidation no muestra ningun jolux:modifies/isModifiedBy). Por eso
    // amendingActs queda vacio en cada entrada: solo se reportan las
    // transiciones de fecha observables, nunca una relacion inferida.
    return consolidations.map((c) => ({
      eli: c.consolidationEli,
      date: c.dateApplicability,
      amendingActs: [],
    }));
  }

  async searchLegislation(
    query: LegislationSearchQuery,
    signal?: AbortSignal,
  ): Promise<LegislationSearchResult> {
    try {
      return await this.searchLegislationInternal(query, signal);
    } catch (error) {
      this.translateDataError(error, "search_legislation");
    }
  }

  private async searchLegislationInternal(
    query: LegislationSearchQuery,
    signal?: AbortSignal,
  ): Promise<LegislationSearchResult> {
    const warnings: string[] = [];
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const language = query.language ?? "de";

    if (query.systematicNumber) {
      const result = await this.client.query(
        buildFindWorksBySystematicNumberQuery(query.systematicNumber),
        `rs:${query.systematicNumber}`,
        signal,
      );
      const works = extractColumn(result, "work").map((v) => v.value);
      if (works.length > 1) {
        warnings.push(
          `El numero sistematico '${query.systematicNumber}' identifica ${works.length} actos distintos (reasignacion tras derogacion, ver docs/provider-contracts/fedlex.md).`,
        );
      }
      const items = await Promise.all(
        works.map(async (workEli) => {
          const metadata = await this.getWorkTitleAndMetadata(workEli, language, signal);
          return {
            id: `fedlex:${workEli}`,
            eli: workEli,
            title: metadata.workTitle,
            ...(metadata.systematicNumber !== undefined
              ? { systematicNumber: metadata.systematicNumber }
              : {}),
            language,
            inForceStatus: metadata.inForceStatus,
          };
        }),
      );
      return {
        items,
        pagination: { page: 1, pageSize: items.length, totalCount: items.length },
        appliedFilters: { systematicNumber: query.systematicNumber },
        officialAttribution: {
          sourceUrl: "https://www.fedlex.admin.ch/",
          officialCharacter: "official",
        },
        capabilities: this.capabilities,
        warnings,
      };
    }

    if (query.eli) {
      const metadata = await this.getWorkTitleAndMetadata(query.eli, language, signal);
      return {
        items: [
          {
            id: `fedlex:${query.eli}`,
            eli: query.eli,
            title: metadata.workTitle,
            ...(metadata.systematicNumber !== undefined
              ? { systematicNumber: metadata.systematicNumber }
              : {}),
            language,
            inForceStatus: metadata.inForceStatus,
          },
        ],
        pagination: { page: 1, pageSize: 1, totalCount: 1 },
        appliedFilters: { eli: query.eli },
        officialAttribution: {
          sourceUrl: "https://www.fedlex.admin.ch/",
          officialCharacter: "official",
        },
        capabilities: this.capabilities,
        warnings,
      };
    }

    if (query.text) {
      warnings.push(
        "Busqueda de texto libre implementada como CONTAINS sobre titulos reales (no un indice de texto completo con relevancia; Virtuoso bif:contains no esta disponible en el endpoint publico, verificado en vivo).",
      );
      const euLanguage = LANGUAGE_TO_EU_CODE[language];
      const result = await this.client.query(
        buildSearchByTitleQuery(query.text, euLanguage, pageSize),
        undefined, // cacheKey
        signal,
      );
      const items = result.results.bindings.map((binding) => ({
        id: `fedlex:${binding["work"]!.value}`,
        eli: binding["work"]!.value,
        title: binding["title"]!.value,
        ...(binding["rsNumber"] ? { systematicNumber: binding["rsNumber"].value } : {}),
        language,
        inForceStatus: "other" as const,
      }));
      return {
        items,
        pagination: { page, pageSize, totalCount: items.length },
        appliedFilters: { text: query.text, language },
        officialAttribution: {
          sourceUrl: "https://www.fedlex.admin.ch/",
          officialCharacter: "official",
        },
        capabilities: this.capabilities,
        warnings,
      };
    }

    throw new NotFoundError(
      "(sin criterio)",
      "search_legislation requiere al menos uno de: text, systematicNumber, eli.",
    );
  }
}
