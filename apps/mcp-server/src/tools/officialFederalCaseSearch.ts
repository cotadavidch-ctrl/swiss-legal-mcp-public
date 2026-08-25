import { deduplicateStable, type DeduplicationSummary } from "./caseDeduplication.js";

/**
 * Descubrimiento oficial masivo de resoluciones del Tribunal Federal suizo
 * (`search.bger.ch`), separado deliberadamente del resolvedor de un unico
 * caso (`officialSwissCaseResolver.ts`). Ver
 * docs/challenge-7-days/day-01-swiss/improvement-plan.md ("Create
 * search_federal_cases": recomendado) y
 * docs/challenge-7-days/day-01-swiss/limitations-analysis.md (LIM-002,
 * LIM-003, LIM-004, LIM-007).
 *
 * Este modulo SOLO descubre candidatos oficiales (no verifica identidad ni
 * recupera texto completo -- eso sigue siendo responsabilidad de
 * `resolve_official_swiss_case`/`batch_resolve_official_cases`). Cada
 * resultado se marca `identity_status: "candidate_discovered"`: presencia en
 * un resultado de busqueda oficial nunca equivale a identidad verificada.
 *
 * HALLAZGOS VERIFICADOS EN VIVO (2026-08-07, contra search.bger.ch real):
 *  1. El formato de fecha real del servidor es `DD.MM.JJJJ` (con puntos), no
 *     `DD-MM-JJJJ` (con guiones). Con guiones el servidor responde con la
 *     pagina del formulario y un error "Das Enddatum '...' der
 *     Datumseinschraenkung ist ungueltig" -- nunca resultados, nunca 0
 *     resultados reales. `toSwissDate()` produce puntos.
 *  2. `query_words` vacio (incluso con fechas validas) devuelve el
 *     formulario de busqueda vacio (sin resultados, sin error) -- este
 *     endpoint no soporta "listar todo" sin un termino de busqueda. Por eso
 *     el modo "chamber_prefix_multi_query" existe: cuando el llamador no da
 *     `query`, se generan consultas internas explicitas usando los prefijos
 *     reales de numero de expediente de la sala (ver
 *     FEDERAL_CHAMBER_PREFIX_MAP), nunca un comodin arbitrario. Los prefijos
 *     "5A" y "5D" (II. zivilrechtliche Abteilung) fueron verificados en vivo
 *     el 2026-08-07 devolviendo listados reales etiquetados con esa sala en
 *     los tres idiomas oficiales.
 *  3. El parametro real de paginacion es `page` (numero de pagina, 1-indexado,
 *     ~10 resultados por pagina, tamano no configurable por el cliente), no
 *     `start` (offset) como se asumia antes sin poder verificarlo contra la
 *     red real. El enlace "siguiente pagina" real usa el texto "Vorwärts".
 *     `extractNextCursorFromHtml` acepta ambos parametros (`page=` y `start=`)
 *     por compatibilidad con fixtures existentes, y ambos textos.
 *
 * Cada resultado de busqueda con `highlight_docid` real fue confirmado
 * contra la estructura real de search.bger.ch (ver
 * _day1-validation-output/search-bger-raw-response.html y las capturas
 * posteriores de esta sesion).
 */

export type FederalChamberCode =
  | "I_public_law"
  | "II_public_law"
  | "I_civil_law"
  | "II_civil_law"
  | "criminal_law"
  | "I_social_law"
  | "II_social_law";

/**
 * Mapeo documentado (no inferido por IA) de prefijos de numero de expediente
 * del Tribunal Federal suizo a su division/sala. Es estructura organizativa
 * publica del tribunal, no autoria individual -- nunca debe usarse como
 * evidencia de identidad ni de autoria (ver LIM-005/LIM-016).
 *
 * "5A" y "5D" (II_civil_law) fueron re-verificados en vivo el 2026-08-07:
 * consultas reales con query_words="5A" y query_words="5D" devolvieron
 * listados de resultados reales etiquetados "II. zivilrechtliche
 * Abteilung"/"IIe Cour de droit civil"/"II Corte di diritto civile" (mismo
 * significado, 3 idiomas oficiales). El resto de prefijos de este mapa
 * proviene de documentacion previa del proyecto y no fue re-verificado en
 * vivo en esta sesion -- ver `prefixes_verified_live` en la salida de
 * `discoverFederalCaseCandidates` para saber exactamente cuales lo fueron en
 * cada llamada.
 */
export const FEDERAL_CHAMBER_PREFIX_MAP: Record<FederalChamberCode, readonly string[]> = {
  I_public_law: ["1C"],
  II_public_law: ["2C", "2D"],
  I_civil_law: ["4A", "4D"],
  II_civil_law: ["5A", "5D"],
  criminal_law: ["6B", "6F"],
  I_social_law: ["8C", "8D"],
  II_social_law: ["9C"],
};

/** Prefijos verificados en vivo contra search.bger.ch en esta sesion (2026-08-07). */
const LIVE_VERIFIED_PREFIXES: ReadonlySet<string> = new Set(["5A", "5D"]);

const ALL_KNOWN_PREFIXES: ReadonlySet<string> = new Set(
  Object.values(FEDERAL_CHAMBER_PREFIX_MAP).flat(),
);

function chamberDivisionForPrefix(prefix: string | null): FederalChamberCode | null {
  if (!prefix) return null;
  const upper = prefix.toUpperCase();
  for (const [division, prefixes] of Object.entries(FEDERAL_CHAMBER_PREFIX_MAP) as [
    FederalChamberCode,
    readonly string[],
  ][]) {
    if (prefixes.includes(upper)) return division;
  }
  return null;
}

export type FederalCaseIdentityStatus =
  "candidate_discovered" | "identity_verified" | "identity_mismatch" | "identity_not_verifiable";

export type FederalCaseFullTextStatus =
  | "not_fetched"
  | "full_text_verified_official"
  | "official_extract"
  | "metadata_only"
  | "unavailable";

export type FederalDocumentType = "judgment" | "decision" | "order" | "unknown";

export interface FederalCaseSearchResultItem {
  readonly case_number: string | null;
  readonly decision_date: string | null;
  readonly chamber: string | null;
  readonly chamber_division: FederalChamberCode | null;
  readonly language: "de" | "fr" | "it" | null;
  readonly title: string | null;
  readonly subject: string | null;
  readonly document_type: FederalDocumentType;
  readonly official_url: string;
  readonly official_identifier: string | null;
  readonly identity_status: FederalCaseIdentityStatus;
  readonly full_text_status: FederalCaseFullTextStatus;
  readonly source_type: "official_court_search_portal";
  readonly provider: "swiss_federal_supreme_court_official_search";
  readonly verification_notes: readonly string[];
}

export interface FederalCaseSearchInput {
  readonly query?: string;
  readonly chamber?: FederalChamberCode;
  readonly language?: "de" | "fr" | "it";
  readonly date_from?: string;
  readonly date_to?: string;
  readonly subject?: string;
  readonly document_type?: FederalDocumentType;
  readonly page?: number;
  readonly page_size?: number;
  readonly max_results?: number;
  readonly official_only?: boolean;
  readonly full_text_preferred?: boolean;
  readonly cursor?: string | null;
}

/** Una unica consulta interna real ejecutada contra search.bger.ch. */
export interface DiscoveryStrategyQueryLog {
  readonly kind: "direct_query" | "chamber_prefix_query";
  readonly query_words: string;
  readonly date_from: string | null;
  readonly date_to: string | null;
  readonly pages_fetched: number;
  readonly results_returned: number;
}

/**
 * Traza completa y honesta de como se descubrieron los candidatos: si el
 * llamador dio un termino de busqueda se usa tal cual (`direct_query`); si
 * no, se documentan aqui todas las consultas internas por prefijo/ventana de
 * fecha realmente ejecutadas (`chamber_prefix_multi_query`) -- nunca se
 * presenta como una unica busqueda nativa si en realidad fueron varias.
 */
export interface DiscoveryStrategyLog {
  readonly mode: "direct_query" | "chamber_prefix_multi_query";
  readonly prefixes_used: readonly string[];
  readonly prefixes_verified_live: readonly string[];
  readonly date_windows: readonly { readonly from: string | null; readonly to: string | null }[];
  readonly queries_executed: readonly DiscoveryStrategyQueryLog[];
}

export interface FederalCaseSearchOutput {
  readonly results: readonly FederalCaseSearchResultItem[];
  readonly total_discovered: number | null;
  readonly returned_count: number;
  readonly next_page: number | null;
  readonly next_cursor: string | null;
  readonly filters_applied: Record<string, unknown>;
  readonly provider: "swiss_federal_supreme_court_official_search";
  readonly source_status: "official" | "unavailable" | "partial";
  readonly warnings: readonly string[];
  readonly partial_results: boolean;
  readonly deduplication_summary: DeduplicationSummary;
  readonly discovery_strategy: DiscoveryStrategyLog;
}

const SEARCH_HOST = "search.bger.ch";
const ALLOWED_SEARCH_HOSTS = new Set(["search.bger.ch", "bger.ch", "www.bger.ch"]);
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const DEFAULT_MAX_RESULTS = 100;
const MAX_MAX_RESULTS = 500;
/** Limite tecnico duro exportado para que llamadores (p.ej. `caseCorpusExport`)
 * puedan acotar su propio `candidate_pool_size` sin duplicar el numero
 * magico ni excederlo nunca (ver Fase 1, "provider_safe_limit"). */
export const PROVIDER_MAX_RESULTS_PER_CALL = MAX_MAX_RESULTS;
const MAX_AUTO_PAGES_PER_CALL = 10;
/** Suelo/techo para el numero de paginas que una sub-consulta individual
 * (un prefijo de sala x una ventana de fecha, modo `chamber_prefix_multi_query`)
 * puede recorrer. Antes era una constante fija (2), lo que topaba cada
 * sub-consulta a ~20 resultados sin importar cuanto presupuesto (`max_results`)
 * quedara disponible -- causa raiz verificada de que `candidates_discovered`
 * quedara fijo en ~20 sin importar `target_size`. Ahora se calcula
 * dinamicamente por sub-consulta a partir del presupuesto restante (ver
 * `runSingleQuery` invocado desde el bucle `chamber_prefix_multi_query`).
 */
const MAX_AUTO_PAGES_PER_SUBQUERY_FLOOR = 2;
const MAX_AUTO_PAGES_PER_SUBQUERY_CEILING = 10;
/** Estimacion documentada (no configurable por el cliente, verificada en vivo
 * el 2026-08-07): ~10 resultados por pagina real de search.bger.ch. Solo se
 * usa para dimensionar cuantas paginas pedir por sub-consulta, nunca para
 * fabricar un total. */
const RESULTS_PER_PAGE_ESTIMATE = 10;
const MAX_AUTO_SUBQUERIES_PER_CALL = 24;
const MAX_DISCOVERY_WINDOWS = 6;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 8_000_000;
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);
const MAX_TRANSIENT_RETRIES = 2;

export interface FederalSearchHttpResponse {
  readonly status_code: number;
  readonly final_url: string;
  readonly body: string;
  readonly headers: Record<string, string>;
}

export type FederalSearchHttpTransport = (url: string) => Promise<FederalSearchHttpResponse>;

async function liveFederalSearchFetch(url: string): Promise<FederalSearchHttpResponse> {
  if (
    process["env"]["NODE_ENV"] === "test" &&
    process["env"]["SWISS_LEGAL_MCP_LIVE_HTTP"] !== "1"
  ) {
    throw new Error("live_http_disabled_in_test");
  }
  const parsed = new URL(url);
  if (!ALLOWED_SEARCH_HOSTS.has(parsed.hostname)) {
    throw new Error(`network_policy_blocked:${parsed.hostname}`);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "User-Agent": "swiss-legal-mcp/1.0 official-federal-case-search",
      },
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_RESPONSE_BYTES) {
      throw new Error("response_too_large");
    }
    const body = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return {
      status_code: response.status,
      final_url: response.url || url,
      body,
      headers: Object.fromEntries(response.headers.entries()),
    };
  } finally {
    clearTimeout(timer);
  }
}

let federalSearchHttpTransport: FederalSearchHttpTransport = liveFederalSearchFetch;

export function setFederalCaseSearchHttpTransportForTests(
  transport: FederalSearchHttpTransport | null,
): void {
  if (process["env"]["NODE_ENV"] === "production") {
    throw new Error("mock_transport_detected_in_production");
  }
  federalSearchHttpTransport = transport ?? liveFederalSearchFetch;
}

function isTransientFetchError(error: unknown): boolean {
  if (error instanceof Error && error.name === "AbortError") return true;
  const message = error instanceof Error ? error.message : String(error);
  const statusMatch = /^http_(\d{3})/i.exec(message);
  if (statusMatch) return RETRYABLE_STATUS_CODES.has(Number(statusMatch[1]));
  return /network|timeout|ECONNRESET|ETIMEDOUT/i.test(message);
}

async function fetchWithRetry(url: string): Promise<FederalSearchHttpResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt += 1) {
    try {
      const response = await federalSearchHttpTransport(url);
      if (RETRYABLE_STATUS_CODES.has(response.status_code)) {
        throw new Error(`http_${response.status_code}_transient`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (!isTransientFetchError(error) || attempt >= MAX_TRANSIENT_RETRIES) {
        throw error;
      }
      const backoffMs = Math.min(2000, 100 * 2 ** attempt) + Math.random() * 50;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function buildSearchUrl(input: {
  readonly query: string;
  readonly language: "de" | "fr" | "it";
  readonly dateFrom: string | null;
  readonly dateTo: string | null;
  readonly page?: number;
}): string {
  const url = new URL(`https://${SEARCH_HOST}/ext/eurospider/live/de/php/aza/http/index.php`);
  url.searchParams.set("lang", input.language);
  url.searchParams.set("query_words", input.query);
  url.searchParams.set("from_date", input.dateFrom ? toSwissDate(input.dateFrom) : "");
  url.searchParams.set("to_date", input.dateTo ? toSwissDate(input.dateTo) : "");
  url.searchParams.set("top_subcollection_aza", "all");
  url.searchParams.set("type", "simple_query");
  // Parametro de paginacion real verificado en vivo el 2026-08-07: `page`
  // (numero de pagina, 1-indexado). La pagina 1 es el comportamiento por
  // defecto del servidor y se omite del URL, igual que en las peticiones
  // reales observadas.
  if (input.page && input.page > 1) {
    url.searchParams.set("page", String(input.page));
  }
  return url.toString();
}

function toSwissDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  // Formato real verificado en vivo el 2026-08-07: DD.MM.JJJJ (puntos). Con
  // guiones el servidor rechaza la fecha como invalida y nunca devuelve
  // resultados, incluso con un query_words valido.
  return `${match[3]}.${match[2]}.${match[1]}`;
}

const RESULT_ANCHOR_PATTERN =
  /<a\s[^>]*href=["']([^"']*(?:type=show_document|highlight_docid)[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const DOCID_PATTERN = /aza:\/\/(\d{2})-(\d{2})-(\d{4})-(.+)$/i;

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'");
}

function stripHtmlTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function inferCaseReferenceFromDocidTail(tail: string): string | null {
  // El identificador incrusta la referencia con "/" sustituido por "-"
  // (mismo esquema que apps/mcp-server/src/tools/officialSwissCaseResolver.ts
  // usa al construir docids sinteticos: reference.replace("/", "-")). El ano
  // final es siempre el ultimo segmento tras el ultimo "-".
  const match = /^(.*)-(\d{4})$/.exec(tail);
  if (!match) return null;
  return `${match[1]}/${match[2]}`;
}

function extractPrefix(caseReference: string | null): string | null {
  if (!caseReference) return null;
  const match = /^(\d+[A-Za-z])[._]/.exec(caseReference);
  return match ? ((match[1] ?? null)?.toUpperCase() ?? null) : null;
}

function classifyDocumentType(title: string | null): FederalDocumentType {
  if (!title) return "unknown";
  const lower = title.toLowerCase();
  if (/urteil|arr[êe]t|sentenza/.test(lower)) return "judgment";
  if (/verf[üu]gung|beschluss|d[ée]cision|ordonnance|decisione|ordinanza/.test(lower))
    return "order";
  return "unknown";
}

/**
 * Verificado en vivo el 2026-08-07: el conteo real de search.bger.ch NO usa
 * siempre "N Treffer" a secas -- usa "N exakter Treffer gefunden für ..." y
 * "N partielle Treffer" (calificador intercalado entre el numero y la
 * palabra clave). El grupo opcional `(?:[\p{L}]+\s+)?` permite como maximo
 * una palabra intercalada (backtracking seguro: si no hay palabra
 * intercalada, cae al literal "Treffer"/"Dokumente"/"Ergebnisse" tal cual,
 * preservando el comportamiento previo con fixtures sinteticas "N Treffer").
 * Cuando la pagina expone varios conteos (p.ej. "exakter" Y "partielle" a la
 * vez, como ocurre en la pagina real), se toma el MAYOR de los valores
 * encontrados: "partielle Treffer" refleja el volumen total real de
 * resultados descubribles (coincide con la cantidad de candidatos que
 * realmente aparecen al paginar), mientras "exakter Treffer" es un
 * subconjunto de calidad/relevancia, no el total. Tomar el mayor nunca
 * fabrica un numero que no estuviera ya impreso en la pagina -- solo evita
 * subestimar el total cuando coexisten varias cifras.
 */
function extractTotalHits(html: string): number | null {
  const patterns = [
    /(\d[\d'.,]*)\s*(?:[\p{L}]+\s+)?(?:Treffer|Dokumente|Ergebnisse)/giu,
    /(\d[\d'.,]*)\s*(?:[\p{L}]+\s+)?(?:r[ée]sultats?|documents?)/giu,
    /(\d[\d'.,]*)\s*(?:[\p{L}]+\s+)?(?:risultati|documenti)/giu,
  ];
  let best: number | null = null;
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const raw = match[1];
      if (!raw) continue;
      const numeric = Number(raw.replace(/['.,]/g, ""));
      if (Number.isFinite(numeric) && (best === null || numeric > best)) {
        best = numeric;
      }
    }
  }
  return best;
}

function extractNextCursorFromHtml(html: string, currentUrl: string): string | null {
  // Acepta tanto `page=` (parametro real, verificado en vivo el 2026-08-07)
  // como `start=` (mantenido por compatibilidad con fixtures/tests
  // existentes que ya usaban ese nombre). El texto real del enlace "pagina
  // siguiente" es "Vorwärts"; se conservan las demas palabras clave por
  // resiliencia multi-idioma, aunque no todas fueron verificadas en vivo.
  const nextLinkPattern =
    /<a\s[^>]*href=["']([^"']*(?:page|start)=\d+[^"']*)["'][^>]*>(?:[^<]*(?:vorw[äa]rts|n[äa]chste|weiter|suivant|next|successiv|avanti)[^<]*)<\/a>/gi;
  const match = nextLinkPattern.exec(html);
  if (!match?.[1]) return null;
  try {
    return new URL(decodeHtmlEntities(match[1]), currentUrl).toString();
  } catch {
    return null;
  }
}

function parseResultsPage(
  html: string,
  requestedUrl: string,
): readonly FederalCaseSearchResultItem[] {
  const items: FederalCaseSearchResultItem[] = [];
  for (const match of html.matchAll(RESULT_ANCHOR_PATTERN)) {
    const hrefRaw = match[1] ?? "";
    const linkText = stripHtmlTags(match[2] ?? "");
    let href: string;
    try {
      href = new URL(decodeHtmlEntities(hrefRaw), requestedUrl).toString();
    } catch {
      continue;
    }
    const url = new URL(href);
    const docid = url.searchParams.get("highlight_docid");
    if (!docid) continue;
    const docidMatch = DOCID_PATTERN.exec(docid);
    if (!docidMatch) continue;
    const [, day, month, year, tail] = docidMatch;
    const decisionDate = day && month && year ? `${year}-${month}-${day}` : null;
    const caseReference = tail ? inferCaseReferenceFromDocidTail(tail) : null;
    const prefix = extractPrefix(caseReference);
    items.push({
      case_number: caseReference,
      decision_date: decisionDate,
      chamber: prefix,
      chamber_division: chamberDivisionForPrefix(prefix),
      language: (url.searchParams.get("lang") as "de" | "fr" | "it" | null) ?? null,
      title: linkText.length > 0 ? linkText : null,
      subject: null,
      document_type: classifyDocumentType(linkText),
      official_url: href,
      official_identifier: docid,
      identity_status: "candidate_discovered",
      full_text_status: "not_fetched",
      source_type: "official_court_search_portal",
      provider: "swiss_federal_supreme_court_official_search",
      verification_notes: [
        "discovery_only_identity_not_yet_verified",
        "language_field_reflects_requested_locale_not_verified_document_language",
      ],
    });
  }
  return items;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Divide un rango de fechas en hasta `maxWindows` ventanas (la mas reciente
 * primero), usadas por el modo `chamber_prefix_multi_query` para repartir
 * las consultas por prefijo a lo largo de todo el periodo solicitado en vez
 * de agotar `max_results` solo con los resultados mas recientes de cada
 * prefijo. Si no hay rango de fechas (o es invalido), devuelve una unica
 * ventana sin acotar.
 */
function splitDateRangeIntoWindows(
  dateFrom: string | null,
  dateTo: string | null,
  maxWindows: number,
): readonly { readonly from: string | null; readonly to: string | null }[] {
  if (!dateFrom || !dateTo) return [{ from: dateFrom, to: dateTo }];
  const start = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [{ from: dateFrom, to: dateTo }];
  }
  const dayMs = 86_400_000;
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs) + 1);
  const windowCount = Math.max(1, Math.min(maxWindows, Math.ceil(totalDays / 366)));
  const windowDays = Math.ceil(totalDays / windowCount);
  const windows: { from: string; to: string }[] = [];
  for (let i = 0; i < windowCount; i += 1) {
    const windowStart = new Date(start.getTime() + i * windowDays * dayMs);
    if (windowStart > end) break;
    const windowEndCandidate = new Date(windowStart.getTime() + (windowDays - 1) * dayMs);
    const windowEnd = windowEndCandidate.getTime() > end.getTime() ? end : windowEndCandidate;
    windows.push({
      from: windowStart.toISOString().slice(0, 10),
      to: windowEnd.toISOString().slice(0, 10),
    });
  }
  return windows.reverse(); // mas reciente primero
}

interface SingleQueryRunResult {
  readonly results: readonly FederalCaseSearchResultItem[];
  readonly warnings: readonly string[];
  readonly sourceStatus: FederalCaseSearchOutput["source_status"];
  readonly partial: boolean;
  readonly pagesFetched: number;
  readonly totalDiscovered: number | null;
  readonly nextCursorFinal: string | null;
}

/**
 * Ejecuta una unica consulta real (un `query_words`, un rango de fechas) con
 * paginacion automatica, hasta `maxResultsForQuery` o `maxPages`. Extraida
 * como funcion reutilizable: el modo `direct_query` la llama una vez: el
 * modo `chamber_prefix_multi_query` la llama una vez por (prefijo, ventana).
 */
async function runSingleQuery(options: {
  readonly queryWords: string;
  readonly language: "de" | "fr" | "it";
  readonly dateFrom: string | null;
  readonly dateTo: string | null;
  readonly maxResultsForQuery: number;
  readonly startUrl?: string | null;
  readonly maxPages?: number;
}): Promise<SingleQueryRunResult> {
  const warnings: string[] = [];
  let sourceStatus: FederalCaseSearchOutput["source_status"] = "official";
  let totalDiscovered: number | null = null;
  const collected: FederalCaseSearchResultItem[] = [];
  let pagesFetched = 0;
  let partial = false;
  const maxPages = options.maxPages ?? MAX_AUTO_PAGES_PER_CALL;
  let currentUrl: string | null =
    options.startUrl ??
    buildSearchUrl({
      query: options.queryWords,
      language: options.language,
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
    });

  while (currentUrl && collected.length < options.maxResultsForQuery && pagesFetched < maxPages) {
    let response: FederalSearchHttpResponse;
    try {
      response = await fetchWithRetry(currentUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`fetch_failed:${message}`);
      sourceStatus = collected.length > 0 ? "partial" : "unavailable";
      partial = true;
      break;
    }
    pagesFetched += 1;

    if (response.status_code === 204) {
      warnings.push(
        "http_204_no_content: treated as provider unavailability for this page, never as absence of jurisprudence.",
      );
      sourceStatus = collected.length > 0 ? "partial" : "unavailable";
      partial = true;
      break;
    }
    if (response.status_code < 200 || response.status_code >= 300) {
      warnings.push(`unexpected_http_status:${response.status_code}`);
      sourceStatus = collected.length > 0 ? "partial" : "unavailable";
      partial = true;
      break;
    }

    if (totalDiscovered === null) {
      totalDiscovered = extractTotalHits(response.body);
    }
    const pageResults = parseResultsPage(response.body, response.final_url);
    collected.push(...pageResults);

    const nextCursor = extractNextCursorFromHtml(response.body, response.final_url);
    if (!nextCursor) break;
    currentUrl = nextCursor;
  }

  const nextCursorFinal = pagesFetched >= maxPages && currentUrl ? currentUrl : null;
  if (pagesFetched >= maxPages && currentUrl) {
    warnings.push(`max_auto_pages_reached:${maxPages}`);
    partial = true;
  }

  return {
    results: collected,
    warnings,
    sourceStatus,
    partial,
    pagesFetched,
    totalDiscovered,
    nextCursorFinal,
  };
}

/**
 * Descubre candidatos oficiales del Tribunal Federal suizo. Nunca marca un
 * resultado como texto completo ni como identidad verificada: eso requiere
 * `resolve_official_swiss_case`/`batch_resolve_official_cases` sobre cada
 * candidato.
 *
 * Dos modos, siempre trazados en `discovery_strategy`:
 *  - `direct_query`: el llamador dio `query` (o esta reanudando un cursor).
 *    Sigue automaticamente hasta `MAX_AUTO_PAGES_PER_CALL` paginas de esa
 *    unica consulta.
 *  - `chamber_prefix_multi_query`: el llamador no dio `query`. search.bger.ch
 *    exige un query_words no vacio (verificado en vivo), asi que se lanzan
 *    varias consultas internas reales usando los prefijos de expediente de
 *    la sala solicitada (o todos los prefijos conocidos si no se dio sala)
 *    repartidas en ventanas de fecha, deduplicadas globalmente. Nunca se usa
 *    un comodin arbitrario ni se inventan prefijos.
 */
export async function discoverFederalCaseCandidates(
  input: FederalCaseSearchInput,
): Promise<FederalCaseSearchOutput> {
  const language = input.language ?? "de";
  const pageSize = clamp(input.page_size ?? DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const maxResults = clamp(input.max_results ?? DEFAULT_MAX_RESULTS, 1, MAX_MAX_RESULTS);
  const page = input.page && input.page > 0 ? Math.trunc(input.page) : 1;
  const warnings: string[] = [];

  if (input.chamber && !FEDERAL_CHAMBER_PREFIX_MAP[input.chamber]) {
    warnings.push(`unknown_chamber_code:${input.chamber}`);
  }

  const filtersApplied: Record<string, unknown> = {
    query: input.query ?? null,
    chamber: input.chamber ?? null,
    language,
    date_from: input.date_from ?? null,
    date_to: input.date_to ?? null,
    subject: input.subject ?? null,
    document_type: input.document_type ?? null,
    page,
    page_size: pageSize,
    max_results: maxResults,
    official_only: true,
    full_text_preferred: input.full_text_preferred ?? false,
  };

  if (input.official_only === false) {
    warnings.push(
      "official_only_forced_true: search_federal_cases only ever queries the official Federal Supreme Court portal; aggregators are never used as authority here (see search_cases for aggregator-backed discovery).",
    );
  }

  const trimmedQuery = (input.query ?? "").trim();
  let collected: FederalCaseSearchResultItem[] = [];
  let sourceStatus: FederalCaseSearchOutput["source_status"] = "official";
  let totalDiscovered: number | null = null;
  let pagesFetched = 0;
  let partial = false;
  let nextCursorFinal: string | null = null;
  let discoveryStrategy: DiscoveryStrategyLog;

  if (trimmedQuery.length > 0 || input.cursor) {
    const startUrl =
      input.cursor ??
      buildSearchUrl({
        query: trimmedQuery,
        language,
        dateFrom: input.date_from ?? null,
        dateTo: input.date_to ?? null,
        page: page > 1 ? page : undefined,
      });
    const run = await runSingleQuery({
      queryWords: trimmedQuery,
      language,
      dateFrom: input.date_from ?? null,
      dateTo: input.date_to ?? null,
      maxResultsForQuery: maxResults,
      startUrl,
    });
    collected = [...run.results];
    warnings.push(...run.warnings);
    sourceStatus = run.sourceStatus;
    partial = run.partial;
    pagesFetched = run.pagesFetched;
    totalDiscovered = run.totalDiscovered;
    nextCursorFinal = run.nextCursorFinal;
    discoveryStrategy = {
      mode: "direct_query",
      prefixes_used: [],
      prefixes_verified_live: [],
      date_windows: [{ from: input.date_from ?? null, to: input.date_to ?? null }],
      queries_executed: [
        {
          kind: "direct_query",
          query_words: trimmedQuery,
          date_from: input.date_from ?? null,
          date_to: input.date_to ?? null,
          pages_fetched: run.pagesFetched,
          results_returned: run.results.length,
        },
      ],
    };
  } else {
    const prefixesRaw = input.chamber
      ? (FEDERAL_CHAMBER_PREFIX_MAP[input.chamber] ?? [])
      : [...ALL_KNOWN_PREFIXES];
    const prefixes = prefixesRaw.length > 0 ? prefixesRaw : [...ALL_KNOWN_PREFIXES];
    if (prefixesRaw.length === 0 && input.chamber) {
      warnings.push(`no_verified_prefixes_for_chamber_falling_back_to_all:${input.chamber}`);
    }
    const windows = splitDateRangeIntoWindows(
      input.date_from ?? null,
      input.date_to ?? null,
      MAX_DISCOVERY_WINDOWS,
    );

    const queriesExecuted: DiscoveryStrategyQueryLog[] = [];
    let subqueries = 0;
    outer: for (const window of windows) {
      for (const prefix of prefixes) {
        if (collected.length >= maxResults) break outer;
        if (subqueries >= MAX_AUTO_SUBQUERIES_PER_CALL) {
          warnings.push(`max_auto_subqueries_reached:${MAX_AUTO_SUBQUERIES_PER_CALL}`);
          partial = true;
          break outer;
        }
        subqueries += 1;
        const remaining = maxResults - collected.length;
        // Presupuesto de paginas dinamico: antes fijo en 2 (~20 resultados
        // por sub-consulta pasara lo que pasara con `max_results`). Ahora se
        // dimensiona al presupuesto restante real, acotado por un suelo (no
        // pedir menos de 2 paginas) y un techo (no perseguir una sola
        // sub-consulta indefinidamente; el resto del presupuesto lo cubren
        // las demas ventanas/prefijos).
        const subqueryMaxPages = clamp(
          Math.ceil(remaining / RESULTS_PER_PAGE_ESTIMATE),
          MAX_AUTO_PAGES_PER_SUBQUERY_FLOOR,
          MAX_AUTO_PAGES_PER_SUBQUERY_CEILING,
        );
        const run = await runSingleQuery({
          queryWords: prefix,
          language,
          dateFrom: window.from,
          dateTo: window.to,
          maxResultsForQuery: remaining,
          maxPages: subqueryMaxPages,
        });
        pagesFetched += run.pagesFetched;
        if (run.totalDiscovered !== null && totalDiscovered === null) {
          // No se suma entre sub-consultas (cada una tiene su propio total);
          // se conserva null a nivel agregado salvo que solo haya una
          // sub-consulta, para no fabricar un total combinado inexistente.
        }
        for (const w of run.warnings) {
          warnings.push(
            `chamber_prefix_query[${prefix}][${window.from ?? ""}..${window.to ?? ""}]:${w}`,
          );
        }
        collected.push(...run.results);
        if (run.partial) partial = true;
        queriesExecuted.push({
          kind: "chamber_prefix_query",
          query_words: prefix,
          date_from: window.from,
          date_to: window.to,
          pages_fetched: run.pagesFetched,
          results_returned: run.results.length,
        });
      }
    }
    if (collected.length === 0) {
      sourceStatus = "unavailable";
      warnings.push(
        "prefix_sweep_found_zero_candidates: every internal per-prefix query returned zero results for the requested filters; this reflects real official-source availability, not a fabricated shortfall.",
      );
    } else if (partial) {
      sourceStatus = "partial";
    }
    discoveryStrategy = {
      mode: "chamber_prefix_multi_query",
      prefixes_used: prefixes,
      prefixes_verified_live: prefixes.filter((p) => LIVE_VERIFIED_PREFIXES.has(p)),
      date_windows: windows,
      queries_executed: queriesExecuted,
    };
  }

  // Filtrado post-recuperacion, siempre determinista, nunca por similitud de
  // titulo (ver LIM-004, LIM-011, LIM-012).
  let filtered = collected;
  if (input.chamber) {
    const allowedPrefixes = FEDERAL_CHAMBER_PREFIX_MAP[input.chamber] ?? [];
    filtered = filtered.filter(
      (item) => item.chamber !== null && allowedPrefixes.includes(item.chamber),
    );
  }
  if (input.date_from) {
    filtered = filtered.filter(
      (item) => item.decision_date === null || item.decision_date >= input.date_from!,
    );
  }
  if (input.date_to) {
    filtered = filtered.filter(
      (item) => item.decision_date === null || item.decision_date <= input.date_to!,
    );
  }
  if (input.subject) {
    const needle = input.subject.toLowerCase();
    filtered = filtered.map((item) =>
      item.title && item.title.toLowerCase().includes(needle)
        ? { ...item, subject: input.subject ?? null }
        : item,
    );
    filtered = filtered.filter(
      (item) => item.title !== null && item.title.toLowerCase().includes(needle),
    );
  }
  if (input.document_type) {
    filtered = filtered.filter((item) => item.document_type === input.document_type);
  }

  const dedup = deduplicateStable(filtered, (item) => ({
    official_identifier: item.official_identifier,
    case_number: item.case_number,
    decision_date: item.decision_date,
    official_url: item.official_url,
    metadata_hash: null,
  }));

  const bounded = dedup.deduplicated.slice(0, maxResults);
  if (dedup.deduplicated.length > bounded.length) {
    partial = true;
  }

  if (totalDiscovered === null && collected.length > 0) {
    warnings.push(
      "total_discovered_unavailable: the official portal did not expose a parseable hit-count on the fetched page(s); total_discovered is null rather than guessed.",
    );
  }

  const nextPage =
    trimmedQuery.length > 0 && collected.length >= maxResults ? page + pagesFetched : null;

  return {
    results: bounded,
    total_discovered: totalDiscovered,
    returned_count: bounded.length,
    next_page: nextPage,
    next_cursor: nextCursorFinal,
    filters_applied: filtersApplied,
    provider: "swiss_federal_supreme_court_official_search",
    source_status: sourceStatus,
    warnings,
    partial_results: partial,
    deduplication_summary: dedup.summary,
    discovery_strategy: discoveryStrategy,
  };
}
