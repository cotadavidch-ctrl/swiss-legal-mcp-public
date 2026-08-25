import { afterEach, describe, expect, it } from "vitest";
import {
  discoverFederalCaseCandidates,
  setFederalCaseSearchHttpTransportForTests,
  type FederalSearchHttpResponse,
  type FederalSearchHttpTransport,
} from "./officialFederalCaseSearch.js";

afterEach(() => {
  setFederalCaseSearchHttpTransportForTests(null);
});

interface ResultEntry {
  readonly reference: string;
  readonly date: string; // DD-MM-YYYY
  readonly lang?: "de" | "fr" | "it";
  readonly title?: string;
}

function anchor(entry: ResultEntry): string {
  const docId = entry.reference.replace("/", "-");
  const lang = entry.lang ?? "de";
  const title = entry.title ?? `Urteil ${entry.reference}`;
  return `<a href="https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=${lang}&type=show_document&highlight_docid=aza://${entry.date}-${docId}">${title}</a>`;
}

function resultsPageHtml(options: {
  readonly entries: readonly ResultEntry[];
  readonly totalHits?: number;
  readonly nextStart?: number;
}): string {
  const anchors = options.entries.map(anchor).join("\n");
  const hits =
    options.totalHits !== undefined ? `<div class="hits">${options.totalHits} Treffer</div>` : "";
  const next =
    options.nextStart !== undefined
      ? `<a href="https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&query_words=&start=${options.nextStart}">weiter</a>`
      : "";
  return `<html><body>${hits}${anchors}${next}</body></html>`;
}

function okResponse(body: string, statusCode = 200): FederalSearchHttpResponse {
  return {
    status_code: statusCode,
    final_url: "https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de",
    body,
    headers: { "content-type": "text/html" },
  };
}

function fixedTransport(response: FederalSearchHttpResponse): FederalSearchHttpTransport {
  return async () => response;
}

describe("discoverFederalCaseCandidates - federal-exclusive source", () => {
  it("only ever queries search.bger.ch, ignoring any attempt to point elsewhere", async () => {
    const requestedUrls: string[] = [];
    setFederalCaseSearchHttpTransportForTests(async (url) => {
      requestedUrls.push(url);
      return okResponse(resultsPageHtml({ entries: [] }));
    });
    await discoverFederalCaseCandidates({ query: "test" });
    expect(requestedUrls).toHaveLength(1);
    expect(new URL(requestedUrls[0]!).hostname).toBe("search.bger.ch");
  });

  it("forces official_only true and warns if the caller requested official_only=false", async () => {
    setFederalCaseSearchHttpTransportForTests(
      fixedTransport(okResponse(resultsPageHtml({ entries: [] }))),
    );
    const output = await discoverFederalCaseCandidates({ query: "x", official_only: false });
    expect(output.filters_applied["official_only"]).toBe(true);
    expect(output.warnings.some((w) => w.startsWith("official_only_forced_true"))).toBe(true);
  });

  it("marks every discovered result as candidate_discovered / not_fetched, never as verified or full text", async () => {
    setFederalCaseSearchHttpTransportForTests(
      fixedTransport(
        okResponse(
          resultsPageHtml({ entries: [{ reference: "9C_999/2026", date: "15-01-2026" }] }),
        ),
      ),
    );
    const output = await discoverFederalCaseCandidates({ query: "x" });
    expect(output.results).toHaveLength(1);
    expect(output.results[0]!.identity_status).toBe("candidate_discovered");
    expect(output.results[0]!.full_text_status).toBe("not_fetched");
  });
});

describe("discoverFederalCaseCandidates - filters", () => {
  const mixed: ResultEntry[] = [
    { reference: "9C_100/2020", date: "01-01-2020" }, // II_social_law
    { reference: "4A_200/2021", date: "01-01-2021" }, // I_civil_law
    { reference: "1C_300/2022", date: "01-01-2022" }, // I_public_law
  ];

  it("filters by chamber, keeping only results whose case-number prefix maps to that chamber", async () => {
    setFederalCaseSearchHttpTransportForTests(
      fixedTransport(okResponse(resultsPageHtml({ entries: mixed }))),
    );
    const output = await discoverFederalCaseCandidates({ query: "x", chamber: "II_social_law" });
    expect(output.results.map((r) => r.case_number)).toEqual(["9C_100/2020"]);
  });

  it("reflects the requested language in filters_applied and in each result's language field", async () => {
    setFederalCaseSearchHttpTransportForTests(
      fixedTransport(
        okResponse(
          resultsPageHtml({
            entries: [{ reference: "4A_1/2024", date: "01-01-2024", lang: "fr" }],
          }),
        ),
      ),
    );
    const output = await discoverFederalCaseCandidates({ query: "x", language: "fr" });
    expect(output.filters_applied["language"]).toBe("fr");
    expect(output.results[0]!.language).toBe("fr");
  });

  it("filters by date_from / date_to (inclusive) deterministically, never by fuzzy matching", async () => {
    setFederalCaseSearchHttpTransportForTests(
      fixedTransport(okResponse(resultsPageHtml({ entries: mixed }))),
    );
    const output = await discoverFederalCaseCandidates({
      query: "x",
      date_from: "2021-01-01",
      date_to: "2021-12-31",
    });
    expect(output.results.map((r) => r.case_number)).toEqual(["4A_200/2021"]);
  });

  it("filters by subject using the linked result title, never by title similarity across different decisions", async () => {
    setFederalCaseSearchHttpTransportForTests(
      fixedTransport(
        okResponse(
          resultsPageHtml({
            entries: [
              {
                reference: "4A_1/2024",
                date: "01-01-2024",
                title: "Urteil Mehrwertsteuer 4A_1/2024",
              },
              {
                reference: "4A_2/2024",
                date: "02-01-2024",
                title: "Urteil Arbeitsrecht 4A_2/2024",
              },
            ],
          }),
        ),
      ),
    );
    const output = await discoverFederalCaseCandidates({ query: "x", subject: "Mehrwertsteuer" });
    expect(output.results.map((r) => r.case_number)).toEqual(["4A_1/2024"]);
    expect(output.results[0]!.subject).toBe("Mehrwertsteuer");
  });
});

describe("discoverFederalCaseCandidates - pagination and volume", () => {
  it("follows next_cursor across multiple pages within a single call", async () => {
    let call = 0;
    setFederalCaseSearchHttpTransportForTests(async () => {
      call += 1;
      if (call === 1) {
        return okResponse(
          resultsPageHtml({
            entries: [{ reference: "9C_1/2024", date: "01-01-2024" }],
            nextStart: 20,
          }),
        );
      }
      return okResponse(
        resultsPageHtml({ entries: [{ reference: "9C_2/2024", date: "02-01-2024" }] }),
      );
    });
    const output = await discoverFederalCaseCandidates({ query: "x", max_results: 50 });
    expect(call).toBe(2);
    expect(output.results.map((r) => r.case_number)).toEqual(["9C_1/2024", "9C_2/2024"]);
  });

  it("can discover more than 100 candidates across pages when the source has them", async () => {
    const pages = 6; // 6 * 20 = 120 candidates
    let call = 0;
    setFederalCaseSearchHttpTransportForTests(async () => {
      call += 1;
      const pageIndex = call - 1;
      const entries: ResultEntry[] = Array.from({ length: 20 }, (_, i) => ({
        reference: `9C_${pageIndex * 20 + i}/2024`,
        date: "01-01-2024",
      }));
      const hasNext = pageIndex < pages - 1;
      return okResponse(
        resultsPageHtml({
          entries,
          totalHits: 120,
          nextStart: hasNext ? (pageIndex + 1) * 20 : undefined,
        }),
      );
    });
    const output = await discoverFederalCaseCandidates({
      query: "x",
      max_results: 200,
      page_size: 20,
    });
    expect(output.total_discovered).toBe(120);
    expect(output.returned_count).toBeGreaterThanOrEqual(100);
    expect(new Set(output.results.map((r) => r.case_number)).size).toBe(output.results.length);
  });

  it("never fabricates total_discovered when the page does not expose a parseable hit count", async () => {
    setFederalCaseSearchHttpTransportForTests(
      fixedTransport(
        okResponse(resultsPageHtml({ entries: [{ reference: "9C_1/2024", date: "01-01-2024" }] })),
      ),
    );
    const output = await discoverFederalCaseCandidates({ query: "x" });
    expect(output.total_discovered).toBeNull();
    expect(output.warnings.some((w) => w.startsWith("total_discovered_unavailable"))).toBe(true);
  });
});

describe("discoverFederalCaseCandidates - deduplication", () => {
  it("deduplicates results that share the same official docid across pages", async () => {
    let call = 0;
    setFederalCaseSearchHttpTransportForTests(async () => {
      call += 1;
      if (call === 1) {
        return okResponse(
          resultsPageHtml({
            entries: [{ reference: "9C_1/2024", date: "01-01-2024" }],
            nextStart: 20,
          }),
        );
      }
      // Same reference/date repeated (e.g. source overlap between pages).
      return okResponse(
        resultsPageHtml({ entries: [{ reference: "9C_1/2024", date: "01-01-2024" }] }),
      );
    });
    const output = await discoverFederalCaseCandidates({ query: "x" });
    expect(output.results).toHaveLength(1);
    expect(output.deduplication_summary.duplicates_removed).toBe(1);
  });

  it("does not deduplicate two distinct decisions that happen to share a rendered title", async () => {
    setFederalCaseSearchHttpTransportForTests(
      fixedTransport(
        okResponse(
          resultsPageHtml({
            entries: [
              { reference: "9C_1/2024", date: "01-01-2024", title: "Urteil" },
              { reference: "9C_2/2024", date: "02-01-2024", title: "Urteil" },
            ],
          }),
        ),
      ),
    );
    const output = await discoverFederalCaseCandidates({ query: "x" });
    expect(output.results).toHaveLength(2);
    expect(output.deduplication_summary.duplicates_removed).toBe(0);
  });
});

describe("discoverFederalCaseCandidates - real search.bger.ch response shape (live-verified 2026-08-07)", () => {
  // Fixture sanitizada, NO copiada literalmente del HTML real capturado (no
  // tenemos los bytes crudos en este entorno -- ver
  // _day1-validation-output/search-bger-valid-query-EVIDENCE-via-claude-web-fetch.json).
  // Reproduce con fidelidad estructural lo verificado EN VIVO el 2026-08-07
  // contra search.bger.ch con query_words=5A_936/2022 (referencia real ya
  // documentada como "official full text verified" en
  // docs/challenge-7-days/day-01-swiss/example-brief.md): el conteo de
  // resultados real usa "N exakter Treffer gefunden für ..." / "N partielle
  // Treffer" (NUNCA "N Treffer" a secas, que es lo que asumia el helper
  // synthetic resultsPageHtml() de mas arriba), y el enlace de "pagina
  // siguiente" real usa el texto "Vorwärts" (no "weiter").
  function realShapedResultsPage(options: {
    readonly exactHits: number;
    readonly partialHits: number;
    readonly queryWords: string;
    readonly entries: readonly ResultEntry[];
    readonly nextPage?: number;
  }): string {
    const anchors = options.entries.map(anchor).join("\n");
    const hitsBlock = `<div class="hits">${options.exactHits} exakter Treffer gefunden für ${options.queryWords}</div><div class="hits">${options.partialHits} partielle Treffer</div>`;
    const next =
      options.nextPage !== undefined
        ? `<a href="https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&query_words=${options.queryWords}&page=${options.nextPage}">Vorwärts</a>`
        : "";
    return `<html><body>${hitsBlock}${anchors}${next}</body></html>`;
  }

  it("discovers the real-verified case 5A_936/2022 from a page shaped like the live response", async () => {
    setFederalCaseSearchHttpTransportForTests(
      fixedTransport(
        okResponse(
          realShapedResultsPage({
            exactHits: 1,
            partialHits: 267,
            queryWords: "5A_936/2022",
            entries: [
              {
                reference: "5A_936/2022",
                date: "08-11-2023",
                title:
                  "Urteil 5A_936/2022 vom 08.11.2023 (Familienrecht / Unterhalt und Kinderbelange)",
              },
            ],
          }),
        ),
      ),
    );
    const output = await discoverFederalCaseCandidates({
      query: "5A_936/2022",
      language: "de",
      date_from: "2023-11-01",
      date_to: "2023-11-15",
    });
    expect(output.results).toHaveLength(1);
    expect(output.results[0]!.case_number).toBe("5A_936/2022");
    expect(output.results[0]!.decision_date).toBe("2023-11-08");
    expect(output.results[0]!.chamber_division).toBe("II_civil_law");
    expect(output.results[0]!.identity_status).toBe("candidate_discovered");
    expect(output.source_status).toBe("official");
  });

  it("parses total_discovered from the real 'N exakter Treffer' / 'N partielle Treffer' phrasing, taking the larger (broader) count, never fabricating beyond what the page printed", async () => {
    // extractTotalHits() fue corregido para aceptar un calificador
    // intercalado ("exakter"/"partielle") entre el numero y "Treffer",
    // porque el HTML real observado en vivo el 2026-08-07 nunca usa "N
    // Treffer" a secas para search.bger.ch. Cuando la pagina imprime ambas
    // cifras (como ocurre en la real), se toma la mayor ("partielle
    // Treffer" = 267) por representar el volumen total de resultados
    // descubribles, no la cifra de coincidencias exactas (1) que es un
    // subconjunto de calidad. Ninguna de las dos cifras se inventa: ambas
    // estan impresas en la pagina real.
    setFederalCaseSearchHttpTransportForTests(
      fixedTransport(
        okResponse(
          realShapedResultsPage({
            exactHits: 1,
            partialHits: 267,
            queryWords: "5A_936/2022",
            entries: [{ reference: "5A_936/2022", date: "08-11-2023" }],
          }),
        ),
      ),
    );
    const output = await discoverFederalCaseCandidates({ query: "5A_936/2022" });
    expect(output.total_discovered).toBe(267);
    expect(output.warnings.some((w) => w.startsWith("total_discovered_unavailable"))).toBe(false);
    expect(output.results).toHaveLength(1);
  });

  it("still returns null (never fabricated) when the real page shape has no parseable hit-count at all", async () => {
    setFederalCaseSearchHttpTransportForTests(
      fixedTransport(
        okResponse(
          `<html><body>${anchor({ reference: "5A_936/2022", date: "08-11-2023" })}</body></html>`,
        ),
      ),
    );
    const output = await discoverFederalCaseCandidates({ query: "5A_936/2022" });
    expect(output.total_discovered).toBeNull();
    expect(output.warnings.some((w) => w.startsWith("total_discovered_unavailable"))).toBe(true);
  });

  it("follows the real 'Vorwärts' pagination link text (not only 'weiter')", async () => {
    let call = 0;
    setFederalCaseSearchHttpTransportForTests(async () => {
      call += 1;
      if (call === 1) {
        return okResponse(
          realShapedResultsPage({
            exactHits: 1,
            partialHits: 267,
            queryWords: "5A_936/2022",
            entries: [{ reference: "5A_936/2022", date: "08-11-2023" }],
            nextPage: 2,
          }),
        );
      }
      return okResponse(
        realShapedResultsPage({
          exactHits: 1,
          partialHits: 267,
          queryWords: "5A_936/2022",
          entries: [{ reference: "5A_937/2022", date: "09-11-2023" }],
        }),
      );
    });
    const output = await discoverFederalCaseCandidates({ query: "5A_936/2022", max_results: 50 });
    expect(call).toBe(2);
    expect(output.results.map((r) => r.case_number)).toEqual(["5A_936/2022", "5A_937/2022"]);
  });
});

describe("discoverFederalCaseCandidates - HTTP and network handling", () => {
  it("treats HTTP 204 as provider unavailability, never as absence of jurisprudence (FIND-05 pattern)", async () => {
    setFederalCaseSearchHttpTransportForTests(fixedTransport(okResponse("", 204)));
    const output = await discoverFederalCaseCandidates({ query: "x" });
    expect(output.source_status).toBe("unavailable");
    expect(output.results).toHaveLength(0);
    expect(output.warnings.some((w) => w.startsWith("http_204_no_content"))).toBe(true);
  });

  it("surfaces a timeout as a fetch failure with partial_results and unavailable status, not a silent empty result", async () => {
    setFederalCaseSearchHttpTransportForTests(async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    });
    const output = await discoverFederalCaseCandidates({ query: "x" });
    expect(output.source_status).toBe("unavailable");
    expect(output.partial_results).toBe(true);
    expect(output.warnings.some((w) => w.startsWith("fetch_failed:"))).toBe(true);
  });

  it("retries transient errors (HTTP 503) and succeeds once the source recovers", async () => {
    let call = 0;
    setFederalCaseSearchHttpTransportForTests(async () => {
      call += 1;
      if (call === 1) return okResponse("", 503);
      return okResponse(
        resultsPageHtml({ entries: [{ reference: "9C_1/2024", date: "01-01-2024" }] }),
      );
    });
    const output = await discoverFederalCaseCandidates({ query: "x" });
    expect(call).toBe(2);
    expect(output.results).toHaveLength(1);
    expect(output.source_status).toBe("official");
  });

  it("does not retry a non-transient error (e.g. HTTP 404) and reports it once", async () => {
    let call = 0;
    setFederalCaseSearchHttpTransportForTests(async () => {
      call += 1;
      throw new Error("http_404_not_found");
    });
    const output = await discoverFederalCaseCandidates({ query: "x" });
    expect(call).toBe(1);
    expect(output.source_status).toBe("unavailable");
    expect(output.warnings.some((w) => w.includes("http_404_not_found"))).toBe(true);
  });

  it("returns partial_results when the auto-pagination cap is reached with more pages remaining", async () => {
    let call = 0;
    setFederalCaseSearchHttpTransportForTests(async () => {
      call += 1;
      return okResponse(
        resultsPageHtml({
          entries: [{ reference: `9C_${call}/2024`, date: "01-01-2024" }],
          nextStart: call * 20,
        }),
      );
    });
    const output = await discoverFederalCaseCandidates({
      query: "x",
      max_results: 5000,
      page_size: 1,
    });
    expect(output.partial_results).toBe(true);
    expect(output.warnings.some((w) => w.startsWith("max_auto_pages_reached"))).toBe(true);
    expect(output.next_cursor).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fase 1/4 (2026-08-07): escenarios H, M, N -- descubrimiento por
// `chamber_prefix_multi_query` (sin `query` explicito) no debe quedar topado
// silenciosamente a ~20 resultados sin importar `max_results`, debe consultar
// SIEMPRE ambos prefijos reales de II_civil_law (5A y 5D) como estrategias
// separadas, y debe deduplicar de forma GLOBAL entre prefijos/paginas, nunca
// solo dentro de una sub-consulta.
// ---------------------------------------------------------------------------

/** A diferencia de `resultsPageHtml()` (cuyo enlace "siguiente pagina"
 * sintetico deja `query_words=` vacio a proposito, para no dar por sentado
 * ningun comportamiento del proveedor real en los tests que no lo necesitan),
 * este helper preserva el prefijo en el enlace de paginacion, como hace
 * realmente search.bger.ch (el `query_words` original se repite en cada
 * pagina siguiente de esa misma consulta). */
function prefixedResultsPage(
  prefix: string,
  entries: readonly ResultEntry[],
  nextStart?: number,
): string {
  const anchors = entries.map(anchor).join("\n");
  const next =
    nextStart !== undefined
      ? `<a href="https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&query_words=${prefix}&start=${nextStart}">weiter</a>`
      : "";
  return `<html><body>${anchors}${next}</body></html>`;
}

describe("discoverFederalCaseCandidates - Fase 1: multi-prefix chamber sweep (scenarios H, M, N)", () => {
  it("[H] queries both 5A and 5D for II_civil_law as separate strategies and does not stop the sweep after the first prefix's results", async () => {
    setFederalCaseSearchHttpTransportForTests(async (url) => {
      const u = new URL(url);
      const prefix = u.searchParams.get("query_words") ?? "";
      const start = Number(u.searchParams.get("start") ?? "0");
      const perPage = 10;
      const totalForPrefix = 15; // > 1 pagina real (~10/pagina): fuerza 2a pagina por prefijo.
      const entries: ResultEntry[] = [];
      for (let i = start; i < Math.min(start + perPage, totalForPrefix); i += 1) {
        entries.push({ reference: `${prefix}_${i}/2024`, date: "01-01-2024" });
      }
      const hasNext = start + perPage < totalForPrefix;
      return okResponse(
        prefixedResultsPage(prefix, entries, hasNext ? start + perPage : undefined),
      );
    });

    const output = await discoverFederalCaseCandidates({
      chamber: "II_civil_law",
      max_results: 30,
    });

    expect(output.discovery_strategy.mode).toBe("chamber_prefix_multi_query");
    expect(output.discovery_strategy.prefixes_used).toEqual(["5A", "5D"]);
    expect(output.discovery_strategy.prefixes_verified_live).toEqual(["5A", "5D"]);
    const from5A = output.results.filter((r) => r.case_number?.startsWith("5A_"));
    const from5D = output.results.filter((r) => r.case_number?.startsWith("5D_"));
    // Cada prefijo aporta genuinamente resultados propios: 5D nunca se
    // descarta silenciosamente solo porque 5A ya devolvio candidatos.
    expect(from5A.length).toBeGreaterThan(0);
    expect(from5D.length).toBeGreaterThan(0);
    // Antes del fix cada sub-consulta topaba en maxPages=2 FIJO (~20
    // resultados totales, sin importar max_results); aqui el total (30) ya
    // demuestra que no hubo un tope silencioso de ~20.
    expect(output.results.length).toBe(30);
    expect(output.results.length).toBeGreaterThan(20);
  });

  it("[M] deduplicates globally across prefixes, not only within a single sub-query", async () => {
    setFederalCaseSearchHttpTransportForTests(async (url) => {
      const u = new URL(url);
      const prefix = u.searchParams.get("query_words") ?? "";
      // Ambas sub-consultas (5A y 5D) devuelven, por construccion del test,
      // la MISMA referencia -- el pipeline debe deduplicar globalmente entre
      // ellas, no solo dentro de cada una.
      return okResponse(
        prefixedResultsPage(prefix, [{ reference: "5A_1/2024", date: "01-01-2024" }]),
      );
    });

    const output = await discoverFederalCaseCandidates({
      chamber: "II_civil_law",
      max_results: 30,
    });

    expect(output.results).toHaveLength(1);
    expect(output.deduplication_summary.duplicates_removed).toBeGreaterThanOrEqual(1);
  });

  it("[N] reports partial_results honestly when a per-prefix subquery hits its dynamic page ceiling before the simulated source is exhausted", async () => {
    setFederalCaseSearchHttpTransportForTests(async (url) => {
      const u = new URL(url);
      const prefix = u.searchParams.get("query_words") ?? "";
      const start = Number(u.searchParams.get("start") ?? "0");
      // Fuente "infinita" simulada: siempre hay una pagina siguiente, para
      // que el techo dinamico de paginas por sub-consulta
      // (MAX_AUTO_PAGES_PER_SUBQUERY_CEILING) se alcance de verdad.
      return okResponse(
        prefixedResultsPage(
          prefix,
          [{ reference: `${prefix}_${start}/2024`, date: "01-01-2024" }],
          start + 10,
        ),
      );
    });

    const output = await discoverFederalCaseCandidates({
      chamber: "II_civil_law",
      max_results: 500,
    });

    expect(output.partial_results).toBe(true);
    expect(output.warnings.some((w) => w.includes("max_auto_pages_reached"))).toBe(true);
    expect(output.discovery_strategy.prefixes_used).toEqual(["5A", "5D"]);
    // Se sigue reportando de forma trazable cual sub-consulta (prefijo +
    // ventana) fue la que topo, nunca un warning generico sin origen.
    expect(output.warnings.some((w) => w.startsWith("chamber_prefix_query[5A]"))).toBe(true);
    expect(output.warnings.some((w) => w.startsWith("chamber_prefix_query[5D]"))).toBe(true);
  });
});
