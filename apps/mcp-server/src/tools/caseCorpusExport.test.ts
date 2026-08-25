import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearOfficialSwissCaseResolverCache,
  setOfficialSwissCaseHttpTransportForTests,
} from "./officialSwissCaseResolver.js";
import { setFederalCaseSearchHttpTransportForTests } from "./officialFederalCaseSearch.js";
import { exportCaseCorpus } from "./caseCorpusExport.js";

const originalCacheDir = process.env["SWISS_LEGAL_CACHE_DIR"];
let testDir: string | null = null;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "swiss-legal-corpus-test-"));
  process.env["SWISS_LEGAL_CACHE_DIR"] = testDir;
  clearOfficialSwissCaseResolverCache();
});

afterEach(() => {
  setOfficialSwissCaseHttpTransportForTests(null);
  setFederalCaseSearchHttpTransportForTests(null);
  clearOfficialSwissCaseResolverCache();
  if (originalCacheDir === undefined) {
    delete process.env["SWISS_LEGAL_CACHE_DIR"];
  } else {
    process.env["SWISS_LEGAL_CACHE_DIR"] = originalCacheDir;
  }
  if (testDir) {
    fs.rmSync(testDir, { recursive: true, force: true });
    testDir = null;
  }
});

function bgerAnchorHtml(reference: string, date = "15-01-2024") {
  const docId = reference.replace("/", "-");
  return `<html><body><a href="https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&type=show_document&highlight_docid=aza://${date}-${docId}">Urteil ${reference}</a></body></html>`;
}

function completeContent(reference: string) {
  const longReasoning = Array.from(
    { length: 30 },
    (_, index) =>
      `Paragraph ${index + 1}: The court reviews the record, the challenged decision, the party submissions, the applicable procedural guarantees and the autonomous ground reviewed for the outcome.`,
  ).join(" ");
  return [
    `[header] ${reference} swiss_federal_supreme_court Bundesgericht 15. Januar 2024`,
    `[facts] Official facts. ${longReasoning}`,
    "[procedural_history] Procedural history.",
    "[party_arguments] Party submissions.",
    "[lower_authority_reasoning] Lower authority reasoning.",
    `[reasoning] First independent ground reviewed. independent ground reviewed. ${longReasoning}`,
    `[final_reasoning] Second autonomous ground reviewed. autonomous ground reviewed. ${longReasoning}`,
    "[dispositive] Operative part.",
    "[costs] Costs.",
  ].join("\n");
}

function liveResponse(url: string, body: string, contentType = "text/html;charset=iso-8859-1") {
  const bytes = new TextEncoder().encode(body);
  return {
    requested_url: url,
    final_url: url,
    status_code: 200,
    redirect_chain: [],
    response_headers: {
      "content-type": contentType,
      "content-length": String(bytes.byteLength),
      server: "test-http",
      date: "Tue, 04 Aug 2026 00:00:00 GMT",
    },
    mime_type: contentType,
    content_length: bytes.byteLength,
    bytes_received: bytes.byteLength,
    retrieved_at: "2026-08-04T00:00:00.000Z",
    body: bytes,
    network_transport: "live_http" as const,
    mock_or_fixture: false,
  };
}

function federalSearchResponse(body: string, statusCode = 200) {
  return {
    status_code: statusCode,
    final_url: "https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de",
    body,
    headers: { "content-type": "text/html" },
  };
}

/** Two distinct references that both discovery and resolution can serve consistently. */
const REFERENCES = ["9C_1/2024", "9C_2/2024"];

function wireCleanTwoCaseCorpus(): void {
  setFederalCaseSearchHttpTransportForTests(async () => {
    const anchors = REFERENCES.map((ref) => bgerAnchorHtml(ref)).join("");
    return federalSearchResponse(`<html><body>${anchors}</body></html>`);
  });
  setOfficialSwissCaseHttpTransportForTests(async (url: string) => {
    const parsed = new URL(url);
    const query = parsed.searchParams.get("query_words");
    if (query) {
      const matched = REFERENCES.find((ref) => query.includes(ref)) ?? REFERENCES[0]!;
      return liveResponse(url, bgerAnchorHtml(matched));
    }
    // Direct highlight_docid fetch (the source_url_hint / canonical_url path
    // that DirectUrlResolverAdapter uses): resolve which of the two
    // references this particular URL's docid actually points at, instead of
    // always returning REFERENCES[0]. Each candidate must receive its own
    // matching official document -- never the other candidate's content.
    const docid = parsed.searchParams.get("highlight_docid");
    const matchedByDocid = docid
      ? REFERENCES.find((ref) => docid.includes(ref.replace("/", "-")))
      : undefined;
    return liveResponse(url, completeContent(matchedByDocid ?? REFERENCES[0]!));
  });
}

describe("exportCaseCorpus", () => {
  it("produces a schema-versioned, JSON-serializable export with consistent statistics", async () => {
    wireCleanTwoCaseCorpus();
    const output = await exportCaseCorpus({
      filters: { chamber: "II_social_law", language: "de" },
      minimum_size: 1,
      target_size: 1,
      max_candidates: 10,
    });

    // Round-trips through JSON without throwing and without losing fields
    // (guards against non-serializable values such as functions or cycles).
    const roundTripped = JSON.parse(JSON.stringify(output));
    expect(roundTripped.schema_version).toBe(output.schema_version);
    expect(typeof output.generated_at).toBe("string");
    expect(() => new Date(output.generated_at).toISOString()).not.toThrow();

    expect(output.statistics.included_count).toBe(output.included.length);
    expect(output.statistics.official_extract_count).toBe(output.official_extracts.length);
    expect(output.statistics.metadata_only_count).toBe(output.metadata_only.length);
    expect(output.statistics.identity_mismatch_count).toBe(output.identity_mismatches.length);
    expect(output.statistics.failed_count).toBe(output.failed.length);
    expect(output.statistics.candidates_resolved).toBe(
      output.included.length +
        output.official_extracts.length +
        output.metadata_only.length +
        output.identity_mismatches.length +
        output.excluded_incomplete.length +
        output.failed.length,
    );
  });

  it("honestly reports when the minimum corpus size is not reached, never silently hiding the shortfall", async () => {
    wireCleanTwoCaseCorpus();
    const output = await exportCaseCorpus({
      filters: { chamber: "II_social_law" },
      minimum_size: 50,
      target_size: 60,
      max_candidates: 10,
    });
    expect(output.statistics.minimum_target_reached).toBe(false);
    expect(output.statistics.objective_target_reached).toBe(false);
    expect(output.warnings.some((w) => w.startsWith("minimum_corpus_size_not_reached"))).toBe(true);
  });

  it("keeps the checkpoint alive (not cleared) while the minimum corpus size has not been reached", async () => {
    wireCleanTwoCaseCorpus();
    const checkpointId = `corpus-test-${Date.now()}`;
    const output = await exportCaseCorpus({
      filters: { chamber: "II_social_law" },
      minimum_size: 50,
      target_size: 60,
      max_candidates: 10,
      checkpoint_id: checkpointId,
    });
    expect(output.checkpoint.checkpoint_id).toBe(checkpointId);
    expect(["saved", "resumed"]).toContain(output.checkpoint.status);
  });

  it("clears the checkpoint once discovery is complete and the minimum size is reached", async () => {
    wireCleanTwoCaseCorpus();
    const checkpointId = `corpus-test-complete-${Date.now()}`;
    const output = await exportCaseCorpus({
      filters: { chamber: "II_social_law" },
      minimum_size: 1,
      target_size: 1,
      max_candidates: 10,
      checkpoint_id: checkpointId,
    });
    expect(output.checkpoint.status).toBe("completed_and_cleared");
  });

  it("never fabricates included entries: an unresolvable candidate never appears under included", async () => {
    setFederalCaseSearchHttpTransportForTests(async () =>
      federalSearchResponse(`<html><body>${bgerAnchorHtml("9C_404/2024")}</body></html>`),
    );
    setOfficialSwissCaseHttpTransportForTests(async (url: string) => {
      const parsed = new URL(url);
      if (parsed.searchParams.get("query_words")) {
        return liveResponse(url, "<html><body>no results</body></html>");
      }
      return liveResponse(url, "<html><body>not found</body></html>");
    });
    const output = await exportCaseCorpus({
      filters: {},
      minimum_size: 1,
      target_size: 1,
      max_candidates: 5,
    });
    expect(output.included).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Fase 1/4 (2026-08-07): escenarios I, J, K, L, O -- el descubrimiento a nivel
// de exportacion de corpus no debe heredar un tope silencioso de ~20
// candidatos sin importar target_size, la formula documentada del pool debe
// cumplirse exactamente, y el checkpoint/resume debe funcionar en flujos con
// mas de una pagina real.
// ---------------------------------------------------------------------------

/** Pagina de resultados con multiples entradas para un prefijo de sala
 * concreto, preservando `query_words=<prefix>` en el enlace de "siguiente
 * pagina" (a diferencia de `bgerAnchorHtml`, que solo modela una unica
 * entrada, sin paginacion). */
function federalPrefixPage(
  prefix: string,
  entries: readonly { reference: string; date: string }[],
  nextStart?: number,
): string {
  const anchors = entries
    .map((e) => {
      const docId = e.reference.replace("/", "-");
      return `<a href="https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&type=show_document&highlight_docid=aza://${e.date}-${docId}">Urteil ${e.reference}</a>`;
    })
    .join("\n");
  const next =
    nextStart !== undefined
      ? `<a href="https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&query_words=${prefix}&start=${nextStart}">weiter</a>`
      : "";
  return `<html><body>${anchors}${next}</body></html>`;
}

/** Fuente simulada con `perPrefixTotal` candidatos disponibles por cada
 * prefijo de sala (5A y 5D para II_civil_law), mas alla de lo que cabe en una
 * sola pagina real (~10/pagina) -- para poder comprobar que el pool de
 * candidatos deja de estar topado en ~20. La resolucion de texto completo se
 * deja deliberadamente minima/rapida: estos escenarios verifican el volumen y
 * la trazabilidad del DESCUBRIMIENTO, no cuantos terminan `included`. */
function wireLargeDiscoveryPool(perPrefixTotal: number): void {
  setFederalCaseSearchHttpTransportForTests(async (url) => {
    const u = new URL(url);
    const prefix = u.searchParams.get("query_words") ?? "";
    const start = Number(u.searchParams.get("start") ?? "0");
    const perPage = 10;
    const entries: { reference: string; date: string }[] = [];
    for (let i = start; i < Math.min(start + perPage, perPrefixTotal); i += 1) {
      entries.push({ reference: `${prefix}_${i}/2024`, date: "15-01-2024" });
    }
    const hasNext = start + perPage < perPrefixTotal;
    return federalSearchResponse(
      federalPrefixPage(prefix, entries, hasNext ? start + perPage : undefined),
    );
  });
  setOfficialSwissCaseHttpTransportForTests(async (url: string) =>
    liveResponse(url, "<html><body>not found</body></html>"),
  );
}

describe("exportCaseCorpus - Fase 1: candidate pool no longer capped at ~20 (scenarios I, J, K)", () => {
  it("[K] candidate_pool_size follows the documented formula (target 50 -> 88, target 60 -> 105, given default max_candidates=140)", async () => {
    wireCleanTwoCaseCorpus();
    const output50 = await exportCaseCorpus({
      filters: { chamber: "II_social_law" },
      minimum_size: 1,
      target_size: 50,
      max_candidates: 140,
    });
    expect(output50.discovery_strategy.candidate_pool_requested).toBe(88);

    const output60 = await exportCaseCorpus({
      filters: { chamber: "II_social_law" },
      minimum_size: 1,
      target_size: 60,
      max_candidates: 140,
    });
    expect(output60.discovery_strategy.candidate_pool_requested).toBe(105);
  });

  // These volume tests intentionally resolve 88/105 discovered candidates.
  // Their assertions verify the former pagination cap regression; the local
  // timeout reflects deterministic fixture volume, not network flakiness.
  it("[I] target_size=50 discovers well beyond the previous silent ~20 cap when the source has enough candidates", async () => {
    wireLargeDiscoveryPool(60); // 60 por prefijo x 2 prefijos (5A, 5D) = 120 disponibles > pool de 88
    const output = await exportCaseCorpus({
      filters: { chamber: "II_civil_law" },
      minimum_size: 1,
      target_size: 50,
      max_candidates: 140,
    });
    expect(output.discovery_strategy.candidate_pool_requested).toBe(88);
    expect(output.statistics.candidates_discovered).toBe(88);
    expect(output.discovery_strategy.candidate_pool_obtained).toBe(88);
    expect(output.statistics.candidates_discovered).toBeGreaterThan(20);
    expect(output.discovery_strategy.prefixes_used).toEqual(["5A", "5D"]);
  }, 15_000);

  it("[J] target_size=60 discovers well beyond the previous silent ~20 cap when the source has enough candidates", async () => {
    wireLargeDiscoveryPool(70); // 70 por prefijo x 2 = 140 disponibles > pool de 105
    const output = await exportCaseCorpus({
      filters: { chamber: "II_civil_law" },
      minimum_size: 1,
      target_size: 60,
      max_candidates: 140,
    });
    expect(output.discovery_strategy.candidate_pool_requested).toBe(105);
    expect(output.statistics.candidates_discovered).toBe(105);
    expect(output.discovery_strategy.candidate_pool_obtained).toBe(105);
    expect(output.statistics.candidates_discovered).toBeGreaterThan(20);
    expect(output.discovery_strategy.prefixes_used).toEqual(["5A", "5D"]);
  }, 15_000);

  it("honestly reports a partial pool (never a fabricated shortfall) when the real source has fewer candidates than the requested pool size", async () => {
    wireLargeDiscoveryPool(10); // 10 por prefijo x 2 = 20 disponibles < pool de 88
    const output = await exportCaseCorpus({
      filters: { chamber: "II_civil_law" },
      minimum_size: 1,
      target_size: 50,
      max_candidates: 140,
    });
    expect(output.discovery_strategy.candidate_pool_requested).toBe(88);
    expect(output.discovery_strategy.candidate_pool_obtained).toBe(20);
    expect(output.discovery_strategy.partial_results).toBe(true);
    expect(output.warnings.some((w) => w.startsWith("candidate_pool_partial:"))).toBe(true);
  });
});

describe("exportCaseCorpus - Fase 1/4: multi-page discovery and checkpoint/resume (scenarios L, O)", () => {
  it("[L] a single free-text query discovery spans multiple real pages (pages_fetched > 1), never fabricating a single-page total", async () => {
    // 20 paginas simuladas de 10 resultados (200 candidatos disponibles):
    // fuerza que la auto-paginacion interna de `direct_query`
    // (MAX_AUTO_PAGES_PER_CALL=10) recorra de verdad varias paginas antes de
    // devolver un next_cursor no nulo.
    let call = 0;
    setFederalCaseSearchHttpTransportForTests(async () => {
      call += 1;
      const pageIndex = call - 1;
      const entries = Array.from({ length: 10 }, (_, i) => ({
        reference: `9C_${pageIndex * 10 + i}/2024`,
        date: "15-01-2024",
      }));
      const hasNext = pageIndex < 19;
      return federalSearchResponse(
        federalPrefixPage("9C", entries, hasNext ? (pageIndex + 1) * 10 : undefined),
      );
    });
    setOfficialSwissCaseHttpTransportForTests(async (url: string) =>
      liveResponse(url, "<html><body>not found</body></html>"),
    );

    const output = await exportCaseCorpus({
      filters: { query: "9C" },
      minimum_size: 1,
      target_size: 60, // candidate_pool_size = 105
      max_candidates: 140,
    });

    expect(output.discovery_strategy.pages_fetched).toBeGreaterThan(1);
    expect(output.statistics.candidates_discovered).toBe(105);
    expect(output.statistics.candidates_discovered).toBeGreaterThan(20);
  }, 15_000);

  it("[O] resumes discovery from a persisted checkpoint instead of silently restarting from zero", async () => {
    wireCleanTwoCaseCorpus();
    const checkpointId = `corpus-resume-test-${Date.now()}`;

    const first = await exportCaseCorpus({
      filters: { chamber: "II_social_law" },
      minimum_size: 50,
      target_size: 60,
      max_candidates: 10,
      checkpoint_id: checkpointId,
    });
    // La fuente de prueba solo ofrece 2 casos reales: el minimo (50) no se
    // alcanza, asi que el checkpoint debe permanecer vivo (nunca borrado).
    expect(first.statistics.minimum_target_reached).toBe(false);
    expect(["saved", "resumed"]).toContain(first.checkpoint.status);

    const second = await exportCaseCorpus({
      filters: { chamber: "II_social_law" },
      minimum_size: 50,
      target_size: 60,
      max_candidates: 10,
      checkpoint_id: checkpointId,
      resume: true,
    });
    // La segunda llamada reanuda explicitamente el checkpoint persistido de
    // la primera -- nunca se reporta como una ejecucion nueva desde cero.
    expect(second.checkpoint.status).toBe("resumed");
    expect(second.checkpoint.checkpoint_id).toBe(checkpointId);
  });
});
