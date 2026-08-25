import { z } from "zod";
import { NotFoundError, type ProviderRegistry, type ToolRegistry } from "@swiss-legal-mcp/core";
import type { NormalizedDocument } from "@swiss-legal-mcp/documents";
import {
  LEXWORK_CANTONS,
  buildJuDocumentId,
  buildZhDocumentId,
  type CantonalJuProvider,
  type CantonalLexWorkProvider,
  type CantonalSilProvider,
  type CantonalSzProvider,
  type CantonalZhProvider,
} from "@swiss-legal-mcp/provider-cantonal";

const ZH_CANTON_CODE = "ZH";
const SZ_CANTON_CODE = "SZ";
const JU_CANTON_CODE = "JU";
const SIL_CANTON_CODES = new Set(["GE", "NE"]);
const LEXWORK_CODES = new Set(LEXWORK_CANTONS.map((d) => d.cantonCode));

export type ResolvedCantonalProvider =
  | { readonly family: "lexwork"; readonly provider: CantonalLexWorkProvider }
  | { readonly family: "zh-own"; readonly provider: CantonalZhProvider }
  | { readonly family: "sz"; readonly provider: CantonalSzProvider }
  | { readonly family: "sil"; readonly provider: CantonalSilProvider }
  | { readonly family: "ju"; readonly provider: CantonalJuProvider };

/**
 * Resuelve el proveedor real de un canton concreto. Nunca declara soporte
 * universal: si el canton no tiene proveedor registrado, lanza un error que
 * enumera exactamente que cantones SI estan soportados, en vez de un
 * generico "no disponible". Exportada para que packages/citations (via
 * citationSupport.ts) pueda resolver una cita cantonal reusando exactamente
 * la misma logica de despacho por familia, sin duplicarla.
 */
export function resolveCantonalProvider(
  providers: ProviderRegistry,
  cantonCode: string,
): ResolvedCantonalProvider {
  const code = cantonCode.toUpperCase();
  const providerId = `cantonal-${code.toLowerCase()}`;
  const provider = providers.get(providerId);
  if (!provider) {
    const supported = [
      ...LEXWORK_CODES,
      ZH_CANTON_CODE,
      SZ_CANTON_CODE,
      ...SIL_CANTON_CODES,
      JU_CANTON_CODE,
    ]
      .sort()
      .join(", ");
    throw new NotFoundError(
      providerId,
      `El canton '${code}' no tiene un proveedor de legislacion implementado en esta fase. Cantones soportados: ${supported}. Ver docs/providers/cantonal-legislation.md para la matriz completa de los 26 cantones (auditados/bloqueados con evidencia).`,
    );
  }
  if (code === ZH_CANTON_CODE) {
    return { family: "zh-own", provider: provider as CantonalZhProvider };
  }
  if (code === SZ_CANTON_CODE) {
    return { family: "sz", provider: provider as CantonalSzProvider };
  }
  if (SIL_CANTON_CODES.has(code)) {
    return { family: "sil", provider: provider as CantonalSilProvider };
  }
  if (code === JU_CANTON_CODE) {
    return { family: "ju", provider: provider as CantonalJuProvider };
  }
  return { family: "lexwork", provider: provider as CantonalLexWorkProvider };
}

/** Capacidades/cobertura/limitaciones reales por familia -- ver docs/providers/cantonal-legislation.md. */
function describeFamily(family: ResolvedCantonalProvider["family"], cantonCode: string) {
  if (family === "sz") {
    return {
      family: "sz" as const,
      capabilities: {
        search: true,
        fullText: true,
        articleLevel: false,
        versioning: "ninguno" as const,
      },
      coverage: {
        languages: ["de"],
        historicalCoverage:
          "solo se expone la version vigente publicada en la coleccion sistematica real (425 entradas verificadas); no se encontro ningun mecanismo de historial de versiones",
      },
      limitations: [
        "no existe buscador propio de la coleccion (el buscador del sitio es generico, no especifico de legislacion); la busqueda filtra en memoria sobre el catalogo HTML real",
        "no hay extraccion de articulo individual: los PDF no tienen una estructura de articulo verificable",
        "un PDF escaneado sin capa de texto se rechaza explicitamente (sin OCR)",
      ],
      officialSource: "https://www.sz.ch",
    };
  }
  if (family === "sil") {
    const code = cantonCode.toUpperCase();
    const cantonName = code === "GE" ? "Geneve" : "Neuchatel";
    return {
      family: "sil" as const,
      capabilities: {
        search: true,
        fullText: true,
        articleLevel: false,
        versioning: "ninguno" as const,
      },
      coverage: {
        languages: ["fr"],
        historicalCoverage:
          "solo cubre el libro de ley vigente de la plataforma SIL; no se encontro ningun mecanismo de historial de versiones",
      },
      limitations: [
        `${cantonName} publica libros adicionales reales (modificaciones futuras, concordatos, legislacion comunal) no cubiertos en esta fase`,
        "no hay busqueda de texto libre real: filtra en memoria sobre el catalogo del libro (el motor de busqueda real del sitio no es reproducible via GET simple)",
        "no hay extraccion de articulo individual: el HTML exportado desde Word no tiene una estructura de articulo verificada de forma fiable",
      ],
      officialSource: code === "GE" ? "https://silgeneve.ch" : "https://rsn.ne.ch",
    };
  }
  if (family === "ju") {
    return {
      family: "ju" as const,
      capabilities: {
        search: false,
        fullText: true,
        articleLevel: false,
        versioning: "ninguno" as const,
      },
      coverage: {
        languages: ["fr"],
        historicalCoverage:
          "no se verifico ningun historial de versiones; solo se puede recuperar un documento cuyo par idn/id ya se conoce de antemano",
      },
      limitations: [
        "no existe mecanismo de busqueda o enumeracion de categoria reproducible sin adivinar parametros (verificado en vivo: varios nombres de parametro reales probados sin efecto)",
        "el titulo real del documento no se pudo verificar en vivo (no se encontro pagina de listado); se expone un titulo generico",
        "no hay extraccion de articulo individual",
      ],
      officialSource: "https://rsju.jura.ch",
    };
  }
  if (family === "lexwork") {
    const descriptor = LEXWORK_CANTONS.find((d) => d.cantonCode === cantonCode.toUpperCase());
    return {
      family: "lexwork" as const,
      capabilities: {
        search: true,
        fullText: true,
        articleLevel: true,
        versioning: "parcial" as const,
      },
      coverage: {
        languages: descriptor ? [descriptor.language] : ["de"],
        historicalCoverage:
          "la busqueda filtra el catalogo completo (incluye leyes derogadas si se solicita); el texto completo y la extraccion de articulos solo cubren la VERSION VIGENTE -- las versiones antiguas/futuras solo se exponen como resumen (id/fecha/titulo), sin texto completo verificado en esta fase",
      },
      limitations: [
        "no hay busqueda de texto libre (excluida por robots.txt en todos los cantones verificados); la busqueda filtra en memoria sobre el catalogo/listado real",
        "texto completo y articulos solo de la version vigente, no de versiones antiguas/futuras",
      ],
      officialSource: descriptor?.baseUrl ?? null,
    };
  }
  return {
    family: "zh-own" as const,
    capabilities: {
      search: true,
      fullText: true,
      articleLevel: false,
      versioning: "completo" as const,
    },
    coverage: {
      languages: ["de"],
      historicalCoverage:
        "cubre la Loseblattsammlung (ley vigente consolidada); el historico cronologico (Offizielle Gesetzessammlung) no esta expuesto por esta herramienta",
    },
    limitations: [
      "no hay extraccion de articulo individual (get_cantonal_article no cubre ZH)",
      "solo Loseblattsammlung (ley vigente), no el historico OS",
    ],
    officialSource: "https://www.zh.ch",
  };
}

/** Un resultado es un NormalizedDocument (no un CantonalXxxSearchOutcome) cuando trae id/provenance/contentNature en su raiz. */
function isNormalizedDocument(value: unknown): value is NormalizedDocument {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "provenance" in value &&
    "contentNature" in value
  );
}

/**
 * Envelope canton-aware comun a las 3 herramientas. Ademas de
 * canton/provider/technicalFamily/officialSource/retrievedAt/capabilities/
 * limitations, expone language/documentIdentifier/canonicalOfficialUrl/
 * contentFormat/contentHash cuando `result` es un unico NormalizedDocument
 * (getDocument/getArticle) -- quedan en null para resultados de busqueda
 * (una lista de documentos, cada uno con sus propios campos). contentHash y
 * contentFormat solo se exponen cuando el contenido realmente se descargo
 * (`contentNature === "literal"`), nunca para una entrada de catalogo/resumen.
 */
function envelope(cantonCode: string, resolved: ResolvedCantonalProvider, result: unknown) {
  const description = describeFamily(resolved.family, cantonCode);
  const doc = isNormalizedDocument(result) ? result : undefined;
  const hasRealContent = doc?.contentNature === "literal";
  return {
    canton: cantonCode.toUpperCase(),
    provider: resolved.provider.id,
    technicalFamily: description.family,
    officialSource: description.officialSource,
    retrievedAt: new Date().toISOString(),
    capabilities: description.capabilities,
    coverage: description.coverage,
    limitations: description.limitations,
    language: doc?.language ?? null,
    documentIdentifier: doc?.id ?? null,
    canonicalOfficialUrl: doc
      ? (doc.provenance.officialSourceUrl ?? doc.provenance.sourceUrl)
      : null,
    contentFormat: hasRealContent ? ((doc?.rawMetadata["contentFormat"] as string) ?? null) : null,
    contentHash: hasRealContent ? (doc?.provenance.contentHash ?? null) : null,
    result,
  };
}

/**
 * Registra las herramientas cantonales realmente soportadas (Fase 5B) --
 * ver docs/providers/cantonal-legislation.md para la matriz de los 26
 * cantones. `canton` es un parametro real en cada herramienta: nunca se
 * declara soporte universal, y cada respuesta incluye canton/proveedor/
 * familia/capacidades/cobertura/limitaciones/fuente oficial/fecha de
 * recuperacion especificas del proveedor resuelto.
 *
 * Deliberadamente NO se registran `search_cantonal_cases`/`get_cantonal_case`:
 * la jurisprudencia cantonal esta cubierta hoy solo de forma agregada por
 * `entscheidsuche.ch` (Fase 2, fuente no oficial ya aceptada por la
 * arquitectura) -- no hay un proveedor cantonal de jurisprudencia dedicado
 * en esta fase.
 */
export function registerCantonalTools(tools: ToolRegistry): void {
  tools.register({
    name: "search_cantonal_legislation",
    description:
      "Busca legislacion cantonal vigente. Requiere 'canton' (codigo de 2 letras). Soportado: 19 cantones sobre la plataforma LexWork + Zurich (ZH-Lex) + Schwyz (SZ) + Geneve/Neuchatel (plataforma SIL) -- todos filtran en memoria sobre un catalogo real, ninguno tiene busqueda de texto libre verdadera. NO soportado: Jura (JU, sin mecanismo de busqueda reproducible -- use get_cantonal_law con idn/id conocidos) ni Ticino/Vaud (bloqueados por WAF real, ver docs/providers/cantonal-legislation.md). No universal -- ver esa matriz para el resto de los 26 cantones.",
    inputSchema: {
      canton: z.string().length(2),
      query: z.string().min(1).optional(),
      systematicNumber: z.string().min(1).optional(),
      includeAbrogated: z.boolean().optional(),
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(100).optional(),
    },
    requiredProviderIds: [],
    handler: async (input, context) => {
      const resolved = resolveCantonalProvider(context.providers, input.canton);
      if (resolved.family === "lexwork") {
        const outcome = await resolved.provider.searchDocuments({
          ...(input.query ? { query: input.query } : {}),
          ...(input.systematicNumber ? { systematicNumber: input.systematicNumber } : {}),
          ...(input.includeAbrogated !== undefined
            ? { includeAbrogated: input.includeAbrogated }
            : {}),
          ...(input.page ? { page: input.page } : {}),
          ...(input.pageSize ? { pageSize: input.pageSize } : {}),
        });
        return envelope(input.canton, resolved, outcome);
      }
      if (resolved.family === "zh-own") {
        const outcome = await resolved.provider.searchDocuments({
          ...(input.systematicNumber ? { referenceNumber: input.systematicNumber } : {}),
          ...(input.query ? { title: input.query } : {}),
          ...(input.page ? { page: input.page } : {}),
        });
        return envelope(input.canton, resolved, outcome);
      }
      if (resolved.family === "sz" || resolved.family === "sil") {
        const outcome = await resolved.provider.searchDocuments({
          ...(input.query ? { query: input.query } : {}),
          ...(input.systematicNumber ? { systematicNumber: input.systematicNumber } : {}),
          ...(input.page ? { page: input.page } : {}),
          ...(input.pageSize ? { pageSize: input.pageSize } : {}),
        });
        return envelope(input.canton, resolved, outcome);
      }
      throw new NotFoundError(
        `cantonal-ju:search`,
        "Jura (JU) no soporta busqueda: no se encontro en la auditoria en vivo un mecanismo de busqueda o enumeracion de categoria reproducible sin adivinar parametros. Use get_cantonal_law con un par 'idn' (categoria) + 'systematicNumber' (id de documento) ya conocido.",
      );
    },
  });

  tools.register({
    name: "get_cantonal_law",
    description:
      "Recupera el texto completo VIGENTE de una ley cantonal. Requiere 'canton' + 'systematicNumber'. Para Zurich (ZH) requiere ademas 'effectiveFrom'/'internalId' (obtengalos con search_cantonal_legislation). Para Geneve/Neuchatel (plataforma SIL) 'systematicNumber' debe ser el identificador interno del documento (rawMetadata.docKey del resultado de busqueda, ej. 'rsg_a1_01'), NO el numero sistematico legible. Para Jura (JU) requiere ademas 'idn' (categoria); 'systematicNumber' se usa como el id del documento -- ambos deben conocerse de antemano (idn/id tal como aparecen en la URL real viewdocument.html?idn=X&id=Y), no hay busqueda. No cubre versiones antiguas/futuras (solo resumen).",
    inputSchema: {
      canton: z.string().length(2),
      systematicNumber: z.string().min(1),
      effectiveFrom: z.iso.date().optional(),
      effectiveTo: z.iso.date().optional(),
      internalId: z.string().min(1).optional(),
      idn: z.string().min(1).optional(),
    },
    requiredProviderIds: [],
    handler: async (input, context) => {
      const resolved = resolveCantonalProvider(context.providers, input.canton);
      if (resolved.family === "lexwork" || resolved.family === "sz" || resolved.family === "sil") {
        const doc = await resolved.provider.getDocument(
          `${resolved.provider.id}:${input.systematicNumber}`,
        );
        return envelope(input.canton, resolved, doc);
      }
      if (resolved.family === "ju") {
        if (!input.idn) {
          throw new NotFoundError(
            `cantonal-ju:${input.systematicNumber}`,
            "Para Jura (JU) se requiere ademas 'idn' (categoria) junto con 'systematicNumber' como identificador de documento (id) -- ambos tal como aparecen en la URL real viewdocument.html?idn=X&id=Y. No existe mecanismo de busqueda: estos valores deben conocerse de antemano.",
          );
        }
        const id = buildJuDocumentId({ idn: input.idn, id: input.systematicNumber });
        const doc = await resolved.provider.getDocument(id);
        return envelope(input.canton, resolved, doc);
      }
      if (!input.effectiveFrom || !input.internalId) {
        throw new NotFoundError(
          `cantonal-zh:${input.systematicNumber}`,
          "Para Zurich (ZH) se requieren 'effectiveFrom' e 'internalId' (obtengalos con search_cantonal_legislation): ZH-Lex identifica una ley por numero sistematico + fechas de vigencia + id interno, no por numero sistematico solo.",
        );
      }
      const id = buildZhDocumentId({
        systematicNumber: input.systematicNumber,
        effectiveFrom: input.effectiveFrom,
        ...(input.effectiveTo ? { effectiveTo: input.effectiveTo } : {}),
        internalId: input.internalId,
      });
      const doc = await resolved.provider.fetchDocument(id);
      return envelope(input.canton, resolved, doc);
    },
  });

  tools.register({
    name: "get_cantonal_article",
    description:
      "Recupera un articulo concreto (version vigente) de una ley cantonal. Requiere 'canton' + 'systematicNumber' + 'articleNumber'. Solo soportado en los 19 cantones LexWork (arbol de contenido real con granularidad de articulo) -- NO soportado en Zurich, Schwyz, Geneve/Neuchatel ni Jura (ninguna de esas fuentes expone una estructura de articulo verificada en esta fase; use get_cantonal_law para el documento completo).",
    inputSchema: {
      canton: z.string().length(2),
      systematicNumber: z.string().min(1),
      articleNumber: z.string().min(1),
    },
    requiredProviderIds: [],
    requireAnyProviderIds: LEXWORK_CANTONS.map((d) => `cantonal-${d.cantonCode.toLowerCase()}`),
    handler: async (input, context) => {
      const resolved = resolveCantonalProvider(context.providers, input.canton);
      if (resolved.family === "lexwork") {
        const doc = await resolved.provider.getArticle(input.systematicNumber, input.articleNumber);
        return envelope(input.canton, resolved, doc);
      }
      const familyLabel: Record<Exclude<ResolvedCantonalProvider["family"], "lexwork">, string> = {
        "zh-own": "ZH-Lex",
        sz: "la coleccion sistematica de Schwyz",
        sil: "la plataforma SIL (Geneve/Neuchatel)",
        ju: "el portal de Jura",
      };
      throw new NotFoundError(
        `${resolved.provider.id}:${input.systematicNumber}#${input.articleNumber}`,
        `${input.canton.toUpperCase()} no esta soportado por get_cantonal_article: ${familyLabel[resolved.family]} no expone articulos individuales verificados en esta fase. Use get_cantonal_law para el documento completo.`,
      );
    },
  });
}
