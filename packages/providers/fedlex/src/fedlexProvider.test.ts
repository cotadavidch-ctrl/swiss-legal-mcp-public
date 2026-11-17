import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  AmbiguousCitationError,
  NotFoundError,
  ProviderResponseError,
} from "@swiss-legal-mcp/core";
import { FedlexProvider } from "./fedlexProvider.js";
import { loadFedlexConfig } from "./config.js";
import type { FedlexSparqlClient } from "./sparqlClient.js";
import type { SparqlJsonResult } from "./remoteTypes.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/fedlex",
);

const REAL_AKOMA_NTOSO_XML = readFileSync(
  path.join(fixturesDir, "akoma_ntoso_constitution_de_20240303.xml"),
  "utf8",
);

const CONSTITUTION_WORK_ELI = "https://fedlex.data.admin.ch/eli/cc/1999/404";
const CONSTITUTION_CURRENT_ELI = "https://fedlex.data.admin.ch/eli/cc/1999/404/20240303";
const CONSTITUTION_HISTORICAL_ELI = "https://fedlex.data.admin.ch/eli/cc/1999/404/20000101";
const XML_MANIFESTATION_URL =
  "https://fedlex.data.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/1999/404/20240303/de/xml/fedlex-data-admin-ch-eli-cc-1999-404-20240303-de-xml-10.xml";
const KVG_1994_WORK_ELI = "https://fedlex.data.admin.ch/eli/cc/1995/1328_1328_1328";
const KVG_1911_WORK_ELI = "https://fedlex.data.admin.ch/eli/cc/28/353_351_341";

function jsonResult(vars: string[], bindings: Record<string, unknown>[]): SparqlJsonResult {
  return {
    head: { vars },
    results: { bindings: bindings as SparqlJsonResult["results"]["bindings"] },
  };
}

function uri(value: string) {
  return { type: "uri" as const, value };
}
function literal(value: string) {
  return { type: "literal" as const, value };
}
function typedLiteral(value: string, datatype = "http://www.w3.org/2001/XMLSchema#date") {
  return { type: "typed-literal" as const, value, datatype };
}

/**
 * Fake de FedlexSparqlClient construido a partir de datos reales verificados
 * en Fase 3 (ver tests/fixtures/fedlex/). No usa red: responde segun el
 * contenido real de la consulta SPARQL recibida.
 */
function makeFakeClient(): FedlexSparqlClient {
  const query = vi.fn(async (sparql: string): Promise<SparqlJsonResult> => {
    // Los patrones mas especificos (isMemberOf, RS por numero) se comprueban
    // ANTES que el "describe" generico de <workEli>, porque ese mismo IRI
    // tambien aparece dentro de la consulta de consolidaciones.
    if (sparql.includes("jolux:isMemberOf")) {
      return jsonResult(
        ["consolidation", "dateApplicability", "dateEndApplicability"],
        [
          {
            consolidation: uri(CONSTITUTION_HISTORICAL_ELI),
            dateApplicability: typedLiteral("2000-01-01"),
            dateEndApplicability: typedLiteral("2001-06-09"),
          },
          {
            consolidation: uri(CONSTITUTION_CURRENT_ELI),
            dateApplicability: typedLiteral("2024-03-03"),
          },
        ],
      );
    }
    if (sparql.includes('"101"')) {
      return jsonResult(["work"], [{ work: uri(CONSTITUTION_WORK_ELI) }]);
    }
    if (sparql.includes('"832.10"')) {
      return jsonResult(
        ["work"],
        [{ work: uri(KVG_1994_WORK_ELI) }, { work: uri(KVG_1911_WORK_ELI) }],
      );
    }
    if (sparql.includes(`<${KVG_1994_WORK_ELI}>`)) {
      return jsonResult(
        ["p", "o"],
        [
          {
            p: uri("http://data.legilux.public.lu/resource/ontology/jolux#historicalLegalId"),
            o: literal("832.10"),
          },
          {
            p: uri("http://data.legilux.public.lu/resource/ontology/jolux#isRealizedBy"),
            o: uri(`${KVG_1994_WORK_ELI}/de`),
          },
        ],
      );
    }
    if (sparql.includes(`<${KVG_1994_WORK_ELI}/de>`)) {
      return jsonResult(
        ["p", "o"],
        [
          {
            p: uri("http://data.legilux.public.lu/resource/ontology/jolux#title"),
            o: literal("Bundesgesetz über die Krankenversicherung"),
          },
        ],
      );
    }
    if (sparql.includes(`<${KVG_1911_WORK_ELI}>`)) {
      return jsonResult(
        ["p", "o"],
        [
          {
            p: uri("http://data.legilux.public.lu/resource/ontology/jolux#historicalLegalId"),
            o: literal("832.10"),
          },
          {
            p: uri("http://data.legilux.public.lu/resource/ontology/jolux#isRealizedBy"),
            o: uri(`${KVG_1911_WORK_ELI}/de`),
          },
        ],
      );
    }
    if (sparql.includes(`<${KVG_1911_WORK_ELI}/de>`)) {
      return jsonResult(
        ["p", "o"],
        [
          {
            p: uri("http://data.legilux.public.lu/resource/ontology/jolux#title"),
            o: literal("Bundesgesetz betreffend die Kranken- und Unfallversicherung"),
          },
        ],
      );
    }
    if (sparql.includes(`<${CONSTITUTION_WORK_ELI}>`)) {
      return jsonResult(
        ["p", "o"],
        [
          {
            p: uri("http://data.legilux.public.lu/resource/ontology/jolux#historicalLegalId"),
            o: literal("101"),
          },
          {
            p: uri("http://data.legilux.public.lu/resource/ontology/jolux#inForceStatus"),
            o: uri("https://fedlex.data.admin.ch/vocabulary/enforcement-status/0"),
          },
          {
            p: uri("http://data.legilux.public.lu/resource/ontology/jolux#dateEntryInForce"),
            o: typedLiteral("2000-01-01"),
          },
          {
            p: uri("http://data.legilux.public.lu/resource/ontology/jolux#isRealizedBy"),
            o: uri(`${CONSTITUTION_WORK_ELI}/de`),
          },
        ],
      );
    }
    if (sparql.includes(`<${CONSTITUTION_WORK_ELI}/de>`)) {
      return jsonResult(
        ["p", "o"],
        [
          {
            p: uri("http://data.legilux.public.lu/resource/ontology/jolux#title"),
            o: literal("Bundesverfassung der Schweizerischen Eidgenossenschaft vom 18. April 1999"),
          },
        ],
      );
    }
    if (sparql.includes(`<${CONSTITUTION_CURRENT_ELI}/de>`)) {
      return jsonResult(
        ["p", "o"],
        [
          {
            p: uri("http://data.legilux.public.lu/resource/ontology/jolux#isEmbodiedBy"),
            o: uri("https://fedlex.data.admin.ch/manifestation/xml-node"),
          },
        ],
      );
    }
    if (sparql.includes(`<${CONSTITUTION_HISTORICAL_ELI}/de>`)) {
      return jsonResult(
        ["p", "o"],
        [
          {
            p: uri("http://data.legilux.public.lu/resource/ontology/jolux#isEmbodiedBy"),
            o: uri("https://fedlex.data.admin.ch/manifestation/pdf-node"),
          },
        ],
      );
    }
    if (sparql.includes("https://fedlex.data.admin.ch/manifestation/xml-node")) {
      return jsonResult(
        ["p", "o"],
        [
          {
            p: uri("http://data.legilux.public.lu/resource/ontology/jolux#userFormat"),
            o: uri("https://fedlex.data.admin.ch/vocabulary/user-format/xml"),
          },
          {
            p: uri("http://data.legilux.public.lu/resource/ontology/jolux#isExemplifiedBy"),
            o: uri(XML_MANIFESTATION_URL),
          },
        ],
      );
    }
    if (sparql.includes("https://fedlex.data.admin.ch/manifestation/pdf-node")) {
      return jsonResult(
        ["p", "o"],
        [
          {
            p: uri("http://data.legilux.public.lu/resource/ontology/jolux#userFormat"),
            o: uri("https://fedlex.data.admin.ch/vocabulary/user-format/pdf-a"),
          },
          {
            p: uri("http://data.legilux.public.lu/resource/ontology/jolux#isExemplifiedBy"),
            o: uri("https://fedlex.data.admin.ch/filestore/some-real-historical.pdf"),
          },
        ],
      );
    }
    return jsonResult([], []);
  });

  const fetchManifestation = vi.fn(async (url: string): Promise<string> => {
    if (url === XML_MANIFESTATION_URL) return REAL_AKOMA_NTOSO_XML;
    return "";
  });

  const ask = vi.fn(async () => true);

  return { query, fetchManifestation, ask } as unknown as FedlexSparqlClient;
}

function providerWith(fake: FedlexSparqlClient): FedlexProvider {
  return new FedlexProvider(loadFedlexConfig({}), fake);
}

describe("FedlexProvider (SPARQL mockeado con datos reales, sin red)", () => {
  it("getLaw resuelve la version vigente de la Constitucion por systematicNumber", async () => {
    const provider = providerWith(makeFakeClient());
    const doc = await provider.getLaw({
      systematicNumber: "101",
      language: "de",
      date: "2024-06-01",
    });
    expect(doc.legislation?.systematicNumber).toBe("101");
    expect(doc.legislation?.version.date).toBe("2024-03-03");
    expect(doc.legislation?.version.isHistorical).toBe(false);
    expect(doc.legislation?.manifestation?.format).toBe("xml");
  });

  it("getLaw resuelve la version historica cuando se pide una fecha anterior", async () => {
    const provider = providerWith(makeFakeClient());
    const doc = await provider.getLaw({
      systematicNumber: "101",
      language: "de",
      date: "2000-06-01",
    });
    expect(doc.legislation?.version.date).toBe("2000-01-01");
    expect(doc.legislation?.version.isHistorical).toBe(true);
    expect(doc.legislation?.version.structuredFormatAvailable).toBe(false);
    expect(doc.legislation?.manifestation?.format).toBe("pdf");
  });

  it("getLaw lanza NotFoundError para una fecha fuera de cobertura historica", async () => {
    const provider = providerWith(makeFakeClient());
    await expect(
      provider.getLaw({ systematicNumber: "101", language: "de", date: "1500-01-01" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("getArticle extrae el Art. 1 real via Akoma Ntoso", async () => {
    const provider = providerWith(makeFakeClient());
    const doc = await provider.getArticle({
      lawRef: { systematicNumber: "101", language: "de", date: "2024-06-01" },
      articleNumber: "1",
    });
    expect(doc.documentType).toBe("legislation_article");
    expect(doc.fullText).toContain("Schweizerische Eidgenossenschaft");
    expect(doc.legislation?.articleLocation?.articleNumber).toBe("1");
  }, 15000);

  it("getArticle lanza NotFoundError cuando la version no tiene manifestacion XML (hueco historico)", async () => {
    const provider = providerWith(makeFakeClient());
    await expect(
      provider.getArticle({
        lawRef: { systematicNumber: "101", language: "de", date: "2000-06-01" },
        articleNumber: "1",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("getArticle lanza NotFoundError para un numero de articulo inexistente dentro de un XML real", async () => {
    const provider = providerWith(makeFakeClient());
    await expect(
      provider.getArticle({
        lawRef: { systematicNumber: "101", language: "de", date: "2024-06-01" },
        articleNumber: "9999",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("compareArticleVersions compara la version historica (sin XML) sale de la comparacion como NotFoundError", async () => {
    const provider = providerWith(makeFakeClient());
    await expect(
      provider.compareArticleVersions(
        { lawRef: { systematicNumber: "101", language: "de" }, articleNumber: "1" },
        "2000-06-01",
        "2024-06-01",
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it("compareArticleVersions con la misma version en before/after devuelve 'unchanged'", async () => {
    const provider = providerWith(makeFakeClient());
    const comparison = await provider.compareArticleVersions(
      { lawRef: { systematicNumber: "101", language: "de" }, articleNumber: "1" },
      "2024-06-01",
      "2024-07-01",
    );
    expect(comparison.comparisonNature).toBe("literal");
    expect(comparison.changes).toEqual([
      { kind: "unchanged", beforeText: comparison.before.text, afterText: comparison.after.text },
    ]);
    expect(comparison.before.text).toBe(comparison.after.text);
  }, 15000);

  it("getArticleAtDate devuelve evidencia de la version elegida", async () => {
    const provider = providerWith(makeFakeClient());
    const result = await provider.getArticleAtDate(
      { lawRef: { systematicNumber: "101", language: "de" }, articleNumber: "1" },
      "2024-06-01",
    );
    expect(result.evidence.chosenEli).toBe(CONSTITUTION_CURRENT_ELI);
    expect(result.document.fullText).toContain("Schweizerische Eidgenossenschaft");
  });

  it("searchLegislation por systematicNumber advierte de ambiguedad real (RS 832.10)", async () => {
    const provider = providerWith(makeFakeClient());
    const result = await provider.searchLegislation({ systematicNumber: "832.10" });
    expect(result.items).toHaveLength(2);
    expect(result.warnings.some((w) => w.includes("2 actos distintos"))).toBe(true);
    expect(result.items.map((item) => item.title)).toEqual([
      "Bundesgesetz über die Krankenversicherung",
      "Bundesgesetz betreffend die Kranken- und Unfallversicherung",
    ]);
  });

  it("getAmendmentHistory devuelve las transiciones de fecha sin inventar amendingActs", async () => {
    const provider = providerWith(makeFakeClient());
    const history = await provider.getAmendmentHistory({ systematicNumber: "101", language: "de" });
    expect(history).toHaveLength(2);
    expect(history[0]?.amendingActs).toEqual([]);
    expect(history.map((h) => h.date)).toEqual(["2000-01-01", "2024-03-03"]);
  });

  it("resolveWorkEli lanza AmbiguousCitationError cuando el RS identifica mas de un acto", async () => {
    const fake = makeFakeClient();
    const provider = providerWith(fake);
    await expect(provider.getLaw({ systematicNumber: "832.10", language: "de" })).rejects.toThrow(
      AmbiguousCitationError,
    );
  });

  describe("RS compartido por una obra derogada y otra vigente", () => {
    const OLD = "https://fedlex.data.admin.ch/eli/cc/60/271_269_275";
    const CURRENT = "https://fedlex.data.admin.ch/eli/cc/2006/218";
    const clientFor = (opts: { failOld?: boolean; oldHasVersion?: boolean }) => {
      const base = makeFakeClient();
      return {
        ...base,
        query: vi.fn(async (sparql: string, key?: string, signal?: AbortSignal) => {
          if (sparql.includes('"173.110"')) {
            return jsonResult(["work"], [{ work: uri(OLD) }, { work: uri(CURRENT) }]);
          }
          if (sparql.includes("jolux:isMemberOf") && sparql.includes(`<${OLD}>`)) {
            if (opts.failOld) throw new Error("SPARQL no responde");
            return jsonResult(
              ["consolidation", "dateApplicability", "dateEndApplicability"],
              opts.oldHasVersion
                ? [
                    {
                      consolidation: uri(`${OLD}/19430101`),
                      dateApplicability: typedLiteral("1943-01-01"),
                    },
                  ]
                : [],
            );
          }
          if (sparql.includes("jolux:isMemberOf") && sparql.includes(`<${CURRENT}>`)) {
            return jsonResult(
              ["consolidation", "dateApplicability", "dateEndApplicability"],
              [
                {
                  consolidation: uri(`${CURRENT}/20070101`),
                  dateApplicability: typedLiteral("2007-01-01"),
                },
              ],
            );
          }
          return base.query(sparql, key, signal);
        }),
      } as unknown as FedlexSparqlClient;
    };

    it("descarta la obra sin version aplicable y elige la vigente", async () => {
      const provider = providerWith(clientFor({ oldHasVersion: false }));
      const resolve = (
        provider as unknown as {
          resolveWorkEli: (ref: { systematicNumber: string; language: "de" }) => Promise<string>;
        }
      ).resolveWorkEli.bind(provider);
      await expect(resolve({ systematicNumber: "173.110", language: "de" })).resolves.toBe(CURRENT);
    });

    it("si ambas tienen version aplicable sigue siendo ambiguo", async () => {
      const provider = providerWith(clientFor({ oldHasVersion: true }));
      await expect(
        provider.getLaw({ systematicNumber: "173.110", language: "de", date: "2026-01-01" }),
      ).rejects.toThrow(AmbiguousCitationError);
    });

    it("si falla la consulta de una candidata no se descarta nada (sigue ambiguo)", async () => {
      const provider = providerWith(clientFor({ failOld: true }));
      await expect(
        provider.getLaw({ systematicNumber: "173.110", language: "de" }),
      ).rejects.toThrow(AmbiguousCitationError);
    });
  });

  describe("isHistorical: una version en vigor cuyo fin esta programado NO es historica", () => {
    const WORK = "https://fedlex.data.admin.ch/eli/cc/27/317_321_377";
    const clientWith = (rows: Array<{ from: string; to?: string }>) => {
      const base = makeFakeClient();
      return {
        ...base,
        query: vi.fn(async (sparql: string, key?: string, signal?: AbortSignal) => {
          if (
            sparql.includes("jolux:isMemberOf") &&
            sparql.includes(`<${CONSTITUTION_WORK_ELI}>`)
          ) {
            return jsonResult(
              ["consolidation", "dateApplicability", "dateEndApplicability"],
              rows.map((r) => ({
                consolidation: uri(`${WORK}/${r.from.replaceAll("-", "")}`),
                dateApplicability: typedLiteral(r.from),
                ...(r.to ? { dateEndApplicability: typedLiteral(r.to) } : {}),
              })),
            );
          }
          return base.query(sparql, key, signal);
        }),
      } as unknown as FedlexSparqlClient;
    };
    const run = (rows: Array<{ from: string; to?: string }>, date?: string) =>
      providerWith(clientWith(rows)).getLaw({
        systematicNumber: "101",
        language: "de",
        ...(date ? { date } : {}),
      });

    it("version vigente hoy con fin FUTURO (ya hay otra consolidada): isHistorical=false", async () => {
      const doc = await run([{ from: "2000-01-01", to: "2099-06-30" }, { from: "2099-07-01" }]);
      expect(doc.legislation?.version.isHistorical).toBe(false);
    });

    it("version cuyo fin ya paso: isHistorical=true", async () => {
      const doc = await run(
        [{ from: "2000-01-01", to: "2001-06-09" }, { from: "2001-06-10" }],
        "2000-06-01",
      );
      expect(doc.legislation?.version.isHistorical).toBe(true);
    });
  });

  it("healthCheck devuelve healthy cuando el ASK responde", async () => {
    const provider = providerWith(makeFakeClient());
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  });
});

describe("FedlexProvider (traduccion de errores internos a ProviderResponseError)", () => {
  it("getLaw traduce un formato de manifestacion no reconocido (FedlexVocabularyError) a ProviderResponseError", async () => {
    const query = vi.fn(async (sparql: string): Promise<SparqlJsonResult> => {
      if (sparql.includes('"101"')) {
        return jsonResult(["work"], [{ work: uri(CONSTITUTION_WORK_ELI) }]);
      }
      if (sparql.includes("jolux:isMemberOf")) {
        return jsonResult(
          ["consolidation", "dateApplicability"],
          [
            {
              consolidation: uri(CONSTITUTION_CURRENT_ELI),
              dateApplicability: typedLiteral("2024-03-03"),
            },
          ],
        );
      }
      if (sparql.includes(`<${CONSTITUTION_WORK_ELI}>`)) {
        return jsonResult(
          ["p", "o"],
          [
            {
              p: uri("http://data.legilux.public.lu/resource/ontology/jolux#historicalLegalId"),
              o: literal("101"),
            },
            {
              p: uri("http://data.legilux.public.lu/resource/ontology/jolux#isRealizedBy"),
              o: uri(`${CONSTITUTION_WORK_ELI}/de`),
            },
          ],
        );
      }
      if (sparql.includes(`<${CONSTITUTION_WORK_ELI}/de>`)) {
        return jsonResult(
          ["p", "o"],
          [
            {
              p: uri("http://data.legilux.public.lu/resource/ontology/jolux#title"),
              o: literal("Bundesverfassung der Schweizerischen Eidgenossenschaft"),
            },
          ],
        );
      }
      if (sparql.includes(`<${CONSTITUTION_CURRENT_ELI}/de>`)) {
        return jsonResult(
          ["p", "o"],
          [
            {
              p: uri("http://data.legilux.public.lu/resource/ontology/jolux#isEmbodiedBy"),
              o: uri("https://fedlex.data.admin.ch/manifestation/bad-format-node"),
            },
          ],
        );
      }
      if (sparql.includes("https://fedlex.data.admin.ch/manifestation/bad-format-node")) {
        return jsonResult(
          ["p", "o"],
          [
            {
              p: uri("http://data.legilux.public.lu/resource/ontology/jolux#userFormat"),
              // Codigo de formato no observado en la auditoria real (solo se
              // verificaron xml/html/pdf-a/docx/doc): fuerza que
              // parseUserFormatUri lance FedlexVocabularyError.
              o: uri("https://fedlex.data.admin.ch/vocabulary/user-format/rtf"),
            },
            {
              p: uri("http://data.legilux.public.lu/resource/ontology/jolux#isExemplifiedBy"),
              o: uri("https://fedlex.data.admin.ch/filestore/some-real-file.rtf"),
            },
          ],
        );
      }
      return jsonResult([], []);
    });
    const fake = {
      query,
      fetchManifestation: vi.fn(),
      ask: vi.fn(),
    } as unknown as FedlexSparqlClient;
    const provider = providerWith(fake);

    await expect(provider.getLaw({ systematicNumber: "101", language: "de" })).rejects.toThrow(
      ProviderResponseError,
    );
  });

  it("getArticle traduce XmlSecurityError (XML malformado) a ProviderResponseError", async () => {
    const base = makeFakeClient();
    const fake = {
      query: base.query,
      ask: base.ask,
      fetchManifestation: vi.fn(async () => '<akomaNtoso><article eId="art_1">texto sin cerrar'),
    } as unknown as FedlexSparqlClient;

    const provider = providerWith(fake);
    await expect(
      provider.getArticle({
        lawRef: { systematicNumber: "101", language: "de", date: "2024-06-01" },
        articleNumber: "1",
      }),
    ).rejects.toThrow(ProviderResponseError);
  });
});
