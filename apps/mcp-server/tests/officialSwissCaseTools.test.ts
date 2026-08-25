import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createLogger, loadEnv } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { buildRegistries } from "../src/registry.js";
import {
  clearOfficialSwissCaseResolverCache,
  compareSwissCaseSources,
  compareSwissCaseSourcesByIdentifier,
  fetchOfficialSwissCaseFullText,
  fetchOfficialSwissCaseFullTextByIdentifier,
  getOfficialCaseCacheDiagnostics,
  normalizeSwissCaseReference,
  OfficialCaseCacheError,
  resolveOfficialCaseStorePath,
  resolveOfficialSwissCase,
  setOfficialSwissCaseHttpTransportForTests,
  validateSwissCaseGroundCoverage,
  verifyCompleteness,
  verifySwissCaseIdentity,
  verifySwissCaseIdentityByIdentifier,
  type FullTextFetchResult,
  type OfficialCaseCandidate,
} from "../src/tools/officialSwissCaseResolver.js";

const logger = createLogger({ level: "silent" });
const originalCacheDir = process.env["SWISS_LEGAL_CACHE_DIR"];
let testCacheDir: string | null = null;

interface StoredResolutionFixture {
  readonly candidates: readonly unknown[];
  readonly rejected_candidates: readonly unknown[];
  readonly selected_candidate_id: string | null;
  readonly ambiguity_status: string;
  readonly selection_blockers: readonly string[];
}

interface OfficialCaseStoreFixture {
  readonly resolutions: Record<string, StoredResolutionFixture>;
  readonly candidates: Record<string, unknown>;
}

async function buildClient() {
  const env = loadEnv({ NODE_ENV: "test" });
  const { providers, legislationProviders, tools } = buildRegistries(env);
  await Promise.all([providers.checkAllHealth(), legislationProviders.checkAllHealth()]);
  const server = createMcpServer({
    name: "swiss-legal-mcp-test",
    version: "0.0.0",
    tools,
    providers,
    legislationProviders,
    logger,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

function completeContent(reference = "9C_999/2026") {
  const longReasoning = Array.from(
    { length: 30 },
    (_, index) =>
      `Paragraph ${index + 1}: The court reviews the record, the challenged decision, the party submissions, the applicable procedural guarantees and the autonomous ground reviewed for the outcome.`,
  ).join(" ");
  return [
    `[header] ${reference} swiss_federal_supreme_court Bundesgericht 15. Januar 2026`,
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

function candidate(overrides: Partial<OfficialCaseCandidate> = {}): OfficialCaseCandidate {
  const normalized = normalizeSwissCaseReference("9C_999/2026");
  return {
    candidate_id: "test-candidate",
    source: "test-official",
    source_url:
      "https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&type=show_document&highlight_docid=aza://15-01-2026-9C_999-2026",
    canonical_url:
      "https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&type=show_document&highlight_docid=aza://15-01-2026-9C_999-2026",
    official: true,
    court: "swiss_federal_supreme_court",
    court_family: "swiss_federal_supreme_court",
    canton: null,
    reference: normalized.normalized_reference,
    decision_date: "2026-01-15",
    chamber: "9C",
    language: "de",
    title: "Test official judgment",
    mime_type: "text/html",
    content: completeContent(),
    content_kind: "html",
    score: 91,
    matched_features: ["exact_reference_match"],
    mismatched_features: [],
    missing_features: [],
    selection_reason: "fixture",
    rejected_reason: null,
    ...overrides,
  };
}

function candidateWithoutEmbeddedContent(): OfficialCaseCandidate {
  const { content: _content, ...rest } = candidate();
  return rest;
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

function liveBinaryResponse(url: string, body: Uint8Array, contentType = "application/pdf") {
  return {
    requested_url: url,
    final_url: url,
    status_code: 200,
    redirect_chain: [],
    response_headers: {
      "content-type": contentType,
      "content-length": String(body.byteLength),
      server: "test-http",
      date: "Tue, 04 Aug 2026 00:00:00 GMT",
    },
    mime_type: contentType,
    content_length: body.byteLength,
    bytes_received: body.byteLength,
    retrieved_at: "2026-08-04T00:00:00.000Z",
    body,
    network_transport: "live_http" as const,
    mock_or_fixture: false,
  };
}

function bgerSearchHtml(reference = "9C_999/2026", date = "15-01-2026") {
  const docId = reference.replace("/", "-");
  return `<html><body><a href="https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&type=show_document&highlight_docid=aza://${date}-${docId}">Urteil ${reference}</a></body></html>`;
}

function case2a348Content() {
  const filler = Array.from(
    { length: 24 },
    (_, index) =>
      `Absatz ${index + 1}: Das Bundesgericht prüft Akten, Steuerpflicht, Vorsteuerabzug, Beschwerdebegründung und die angefochtene Verfügung.`,
  ).join(" ");
  return [
    "[header] 2A.348/2004 swiss_federal_supreme_court Bundesgericht 1. Dezember 2004",
    `[facts] Sachverhalt zur Stiftung, Mehrwertsteuer und Vorsteuerabzug. ${filler}`,
    "[procedural_history] Verfahren vor der Eidgenössischen Steuerrekurskommission und Verwaltungsgerichtsbeschwerde.",
    "[party_arguments] Die Beschwerdeführerin verlangt weiteren Vorsteuerabzug.",
    "[lower_authority_reasoning] Die Vorinstanz verneinte den weitergehenden Abzug.",
    `[reasoning] 3.4.3 Erforderlich ist, dass die von der Stiftung bezogenen Eingangsumsätze tatsächlich, sei es unmittelbar oder mittelbar für Ausgangsumsätze, d.h. für steuerbare Lieferungen oder Dienstleistungen verwendet werden. Mit Ausnahme der fakturierten Forschungskosten konnte dieser Nachweis für weitere Ausgangsumsätze nicht erbracht werden. Eine Verletzung von Bundesrecht liegt nicht vor. Die Beschwerde ist schon aus diesem Grund abzuweisen. 4.2 Kein Vorsteuerabzug ist demnach für Leistungen möglich, die unentgeltlich erfolgen, weil es in solchen Fällen an der Steuerbarkeit des Umsatzes fehlt. 4.3 Mit Ausnahme der zuvor erwähnten fakturierten Forschungsleistungen erbringt die Beschwerdeführerin keinen Beweis dafür, dass sie weitere Leistungen gegen Entgelt deklariert oder in Rechnung gestellt hat. Deshalb ist die Beschwerde auch mangels Entgeltlichkeit abzuweisen sei. ${filler}`,
    "[final_reasoning] Zusammenfassend ist die Verwaltungsgerichtsbeschwerde abzuweisen.",
    "[dispositive] Die Verwaltungsgerichtsbeschwerde wird abgewiesen.",
    "[costs] Die Gerichtskosten werden der Beschwerdeführerin auferlegt.",
  ].join("\n");
}

function bgerPublishedSearchHtml() {
  return `<html><body>
    <a href="https://search.bger.ch/ext/eurospider/live/de/php/clir/http/index.php?lang=de&type=highlight_simple_query&highlight_docid=atf%3A%2F%2F142-III-91%3Ade&rank=1">142 III 91</a>
    <div>12. Auszug aus dem Urteil der I. zivilrechtlichen Abteilung i.S A. SA gegen Genossenschaft B. (Beschwerde in Zivilsachen) 4A_327/2015 vom 9. Februar 2016</div>
  </body></html>`;
}

function bgerPublishedDocumentHtml() {
  const reasoning = Array.from(
    { length: 20 },
    (_, index) =>
      `Erwägung ${index + 1}: Die selbständig tragende Begründung geprüft trägt den Entscheid für sich. Nicht entscheidwesentlich ist die historische Nebenbemerkung.`,
  ).join(" ");
  return `<html><body>
    <br>BGE 142 III 91<br><br>
    <div class="paraatf">12. Auszug aus dem Urteil der I. zivilrechtlichen Abteilung i.S A. SA gegen Genossenschaft B. (Beschwerde in Zivilsachen)</div>
    <div class="paraatf">4A_327/2015 vom 9. Februar 2016</div>
    <a name="page91"></a><div class="center pagebreak">BGE 142 III 91 S. 91</div>
    <div class="paraatf"><span class="bold">A. </span>Die Beschwerdeführerin schildert den Sachverhalt und die Prozessgeschichte.</div>
    <div class="paraatf">In teilweiser Gutheissung der Beschwerde hebt das Bundesgericht den angefochtenen Entscheid auf.</div>
    <a name="page92"></a><div class="center pagebreak">BGE 142 III 91 S. 92</div>
    <h2>Aus den Erwägungen:</h2>
    <div class="paraatf">${reasoning}</div>
  </body></html>`;
}

function bvgerDocumentHtml(reference = "A-4733/2022") {
  const longReasoning = Array.from(
    { length: 30 },
    (_, index) =>
      `Absatz ${index + 1}: Die Vorinstanz, die Verfügung und die Beschwerde werden geprüft; an independent ground reviewed and an autonomous ground reviewed are addressed.`,
  ).join(" ");
  return [
    "<html><body>",
    `Bundesverwaltungsgericht Abteilung I ${reference}`,
    "Urteil vom 31. Oktober 2024",
    "Sachverhalt: Die Beschwerde betrifft die Verfügung der Vorinstanz; der Beschwerdeführer beantragt die Aufhebung und macht geltend, die Vorbringen seien zu prüfen.",
    "Das Bundesverwaltungsgericht stellt fest und erwägt:",
    `${longReasoning} ${longReasoning}`,
    "Demnach erkennt das Bundesverwaltungsgericht:",
    "1. Die Beschwerde wird abgewiesen. Gerichtskosten werden erhoben.",
    "</body></html>",
  ].join("\n");
}

function bvgerSearchDocument(
  reference = "A-4733/2022",
  leid = "95e341c9-505f-497b-9fde-5323b747a59f",
) {
  const fileReference = reference.replace("/", "-");
  return {
    leid,
    metadataKeywordTextMap: {
      leid: [leid],
      title: [`Urteil ${reference}`],
      originalUrl: [`/pdf/${fileReference}_2024-10-31_${leid}.pdf`],
      language: ["de"],
    },
    metadataDateMap: {
      rulingDate: "2024-10-31T00:00:00.000Z",
    },
  };
}

function bvgerSearchJson(documents: readonly unknown[]) {
  return JSON.stringify({
    totalNumberOfDocuments: documents.length,
    hasMoreResults: false,
    documents,
    aggregations: {},
  });
}

function bstgerDocumentHtml(reference = "SK.2023.1") {
  const longReasoning = Array.from(
    { length: 30 },
    (_, index) =>
      `Considérant ${index + 1}: La Cour examine le Ministère public, les conclusions, the independent ground reviewed and the autonomous ground reviewed for the outcome.`,
  ).join(" ");
  return [
    "<html><body>",
    "Bundesstrafgericht Tribunal pénal fédéral",
    `Jugement du 17 mars 2023 Cour des affaires pénales Numéro du dossier: ${reference}`,
    "Faits: Le recourant et le Ministère public déposent leurs conclusions; la Cour des affaires pénales retient les éléments utiles.",
    "La Cour considère en droit:",
    `${longReasoning} ${longReasoning}`,
    "La Cour prononce:",
    "1. La cause est tranchée. Les frais judiciaires sont mis à charge selon le dispositif.",
    "</body></html>",
  ].join("\n");
}

function bstgerSearchDocument(
  reference = "SK.2023.1",
  leid = "01e7b851-1e32-3ea9-93ca-042e0b20230d",
  language = "fr",
  rulingDate = "2023-03-17T11:00:00.000Z",
) {
  const fileReference = reference.replaceAll(".", "_");
  return {
    leid,
    metadataKeywordTextMap: {
      title: [`<em>${reference.split(".").join("</em>.<em>")}</em>`],
      fileName: [`20230317_${fileReference}.pdf`],
      court: ["Strafkammer;;Cour des affaires pénales;;Corte penale;;Criminal Court"],
      language: [language],
    },
    metadataDateMap: {
      rulingDate,
    },
  };
}

function bstgerSearchJson(documents: readonly unknown[]) {
  return JSON.stringify({
    status: "success",
    data: {
      totalNumberOfDocuments: documents.length,
      hasMoreResults: false,
      documents,
      aggregations: {},
      aggregationsHasMore: {},
    },
  });
}

function arDocumentHtml(reference = "O2V 19 21") {
  const longReasoning = Array.from(
    { length: 30 },
    (_, index) =>
      `Absatz ${index + 1}: Das Obergericht prüft die Verfügung der Vorinstanz, den Einspracheentscheid, the independent ground reviewed and the autonomous ground reviewed for the outcome.`,
  ).join(" ");
  return [
    "<html><body>",
    "Obergericht Appenzell Ausserrhoden",
    "2. Abteilung",
    "Zirkular-Urteil vom 19. Mai 2020",
    `Verfahren Nr. ${reference}`,
    "Gegenstand Direkte Bundessteuer 2015 und 2016",
    "Rechtsbegehren: Der Beschwerdeführer beantragt die Aufhebung des Einspracheentscheids; die Steuerverwaltung beantragt Abweisung.",
    "Sachverhalt: Die Beschwerde betrifft einen Einspracheentscheid der Steuerverwaltung; die Vorinstanz und das Kantonsgericht werden im Verfahren erwähnt.",
    "Erwägungen:",
    `${longReasoning} ${longReasoning}`,
    "Das Obergericht erkennt:",
    "1. Die Beschwerde wird abgewiesen. Die Gerichtskosten werden auferlegt.",
    "</body></html>",
  ].join("\n");
}

function arSearchDocument(
  reference = "O2V 19 21",
  leid = "834a4adb-0042-30b6-8d14-f0a7b47f2fd1",
  originalUrl = "https://rechtsprechung.ar.ch/download/Obergericht/2020/OG-20200519-O2V-19-21-20200721.pdf",
  decisionDate = "2020-05-19T00:00:00.000Z",
  publicationDate = "2020-07-21T00:00:00.000Z",
) {
  const fileReference = reference.replaceAll(" ", "-");
  return {
    leid,
    metadataKeywordTextMap: {
      leid: [leid],
      title: [`OG <em>${reference.replaceAll(" ", "</em>-<em>")}</em>`],
      fileName: [`OG-20200519-${fileReference}-20200721.pdf`],
      originalUrl: [originalUrl],
      argvpBehoerde: ["OG"],
      entscheidKategorie: ["Übrige Entscheide"],
    },
    metadataDateMap: {
      decisionDate,
      publicationDate,
    },
  };
}

function arSearchJson(documents: readonly unknown[]) {
  return JSON.stringify({
    totalNumberOfDocuments: documents.length,
    hasMoreResults: false,
    documents,
    aggregations: {},
  });
}

function setSuccessfulArTransport(
  calls: { url: string; method: string | undefined; body: string | undefined }[] = [],
) {
  setOfficialSwissCaseHttpTransportForTests(async (url, options) => {
    calls.push({ url, method: options?.method, body: options?.body });
    if (url.includes("searchQueryService")) {
      return liveResponse(url, arSearchJson([arSearchDocument()]), "application/json");
    }
    return liveResponse(url, arDocumentHtml(), "text/html;charset=utf-8");
  });
  return calls;
}

async function resolveArOfficial(
  input: Partial<Parameters<typeof resolveOfficialSwissCase>[0]> = {},
) {
  return resolveOfficialSwissCase({
    case_reference: "O2V 19 21",
    require_official_source: true,
    require_full_text: true,
    strict_identity_match: true,
    ...input,
  });
}

beforeEach(() => {
  testCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "swiss-legal-mcp-test-"));
  process.env["SWISS_LEGAL_CACHE_DIR"] = testCacheDir;
  setOfficialSwissCaseHttpTransportForTests(async (url) => {
    if (url.includes("type=search") || url.includes("type=simple_query")) {
      return liveResponse(url, bgerSearchHtml());
    }
    return liveResponse(url, completeContent());
  });
});

afterEach(() => {
  setOfficialSwissCaseHttpTransportForTests(null);
  clearOfficialSwissCaseResolverCache();
  if (testCacheDir) fs.rmSync(testCacheDir, { recursive: true, force: true });
  testCacheDir = null;
  if (originalCacheDir === undefined) delete process.env["SWISS_LEGAL_CACHE_DIR"];
  else process.env["SWISS_LEGAL_CACHE_DIR"] = originalCacheDir;
});

async function fetchAndCompleteness(item: OfficialCaseCandidate) {
  const fetch = await fetchOfficialSwissCaseFullText({ candidate: item });
  return { fetch, completeness: verifyCompleteness(fetch) };
}

function blockedLocalUrl(hostParts: readonly string[]) {
  return `https://${hostParts.join(".")}/case`;
}

function estvPdfFixture() {
  return fs.readFileSync(
    path.join(process.cwd(), "tests/fixtures/estv/kreisschreiben_50a_bestechungsgelder_de.pdf"),
  );
}

function setOfficialCaseHttpTransportForTestsForPdfWithoutText() {
  const blankPdf = new TextEncoder().encode(`%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Resources<<>>/Contents 4 0 R>>endobj
4 0 obj<</Length 0>>
stream

endstream
endobj
trailer<</Size 5/Root 1 0 R>>
%%EOF`);
  setOfficialSwissCaseHttpTransportForTests(async (url) => {
    if (url.includes("type=search") || url.includes("type=simple_query")) {
      return liveResponse(url, bgerSearchHtml());
    }
    return liveBinaryResponse(url, blankPdf, "application/pdf");
  });
}

describe("official Swiss case persistent store path", () => {
  it("uses explicit SWISS_LEGAL_CACHE_DIR and supports spaces and unicode", () => {
    const dir = path.join(os.tmpdir(), "Swiss Legal Cache ünicode path");
    const resolved = resolveOfficialCaseStorePath({
      env: { SWISS_LEGAL_CACHE_DIR: dir },
      checkWritable: false,
    });
    expect(resolved.source).toBe("SWISS_LEGAL_CACHE_DIR");
    expect(resolved.directory).toBe(path.resolve(dir));
    expect(resolved.file).toBe(path.join(path.resolve(dir), "official-swiss-case-store.json"));
  });

  it("uses platform cache fallbacks without depending on cwd", () => {
    expect(
      resolveOfficialCaseStorePath({
        env: {},
        platform: "darwin",
        homedir: "/Users/example",
        checkWritable: false,
      }),
    ).toMatchObject({
      source: "macos_user_cache",
      directory: "/Users/example/Library/Caches/swiss-legal-mcp",
    });
    expect(
      resolveOfficialCaseStorePath({
        env: { XDG_CACHE_HOME: "/xdg/cache" },
        platform: "linux",
        homedir: "/home/example",
        checkWritable: false,
      }),
    ).toMatchObject({ source: "linux_xdg_cache", directory: "/xdg/cache/swiss-legal-mcp" });
    expect(
      resolveOfficialCaseStorePath({
        env: {},
        platform: "linux",
        homedir: "/home/example",
        checkWritable: false,
      }),
    ).toMatchObject({
      source: "linux_home_cache",
      directory: "/home/example/.cache/swiss-legal-mcp",
    });
    expect(
      resolveOfficialCaseStorePath({
        env: { LOCALAPPDATA: "C:\\Users\\Example\\AppData\\Local" },
        platform: "win32",
        checkWritable: false,
      }).source,
    ).toBe("windows_localappdata");
    expect(
      resolveOfficialCaseStorePath({
        env: {},
        platform: "freebsd" as NodeJS.Platform,
        homedir: "",
        tmpdir: "/tmp",
        checkWritable: false,
      }),
    ).toMatchObject({ source: "tmpdir_fallback", directory: "/tmp/swiss-legal-mcp-cache" });
  });

  it("rejects empty, file URL, root and root cache paths", () => {
    for (const value of ["", "file:///tmp/cache", "/", "/.cache"]) {
      expect(() =>
        resolveOfficialCaseStorePath({
          env: { SWISS_LEGAL_CACHE_DIR: value },
          checkWritable: false,
        }),
      ).toThrow(OfficialCaseCacheError);
    }
  });

  it("is independent of cwd / and /tmp", () => {
    const original = process.cwd();
    try {
      process.chdir("/");
      const fromRoot = resolveOfficialCaseStorePath({
        env: {},
        platform: "darwin",
        homedir: "/Users/example",
        checkWritable: false,
      });
      process.chdir("/tmp");
      const fromTmp = resolveOfficialCaseStorePath({
        env: {},
        platform: "darwin",
        homedir: "/Users/example",
        checkWritable: false,
      });
      expect(fromRoot.file).toBe(fromTmp.file);
      expect(fromRoot.directory).not.toBe("/.cache");
    } finally {
      process.chdir(original);
    }
  });

  it("is independent of an inaccessible simulated cwd", () => {
    const cwd = vi.spyOn(process, "cwd").mockReturnValue("/path/that/does/not/exist");
    try {
      const resolved = resolveOfficialCaseStorePath({
        env: {},
        platform: "darwin",
        homedir: "/Users/example",
        checkWritable: false,
      });
      expect(resolved.directory).toBe("/Users/example/Library/Caches/swiss-legal-mcp");
    } finally {
      cwd.mockRestore();
    }
  });

  it("creates the cache directory recursively and validates writability", () => {
    const dir = path.join(testCacheDir!, "nested", "cache");
    const resolved = resolveOfficialCaseStorePath({
      env: { SWISS_LEGAL_CACHE_DIR: dir },
    });
    expect(fs.existsSync(resolved.directory)).toBe(true);
  });

  it("rejects an existing symlink that resolves to the filesystem root", () => {
    if (process.platform === "win32") return;
    const link = path.join(testCacheDir!, "root-cache-link");
    fs.symlinkSync("/", link, "dir");
    expect(() =>
      resolveOfficialCaseStorePath({
        env: { SWISS_LEGAL_CACHE_DIR: link },
      }),
    ).toThrow(OfficialCaseCacheError);
  });

  it("returns structured cache errors instead of raw ENOENT", () => {
    const fileAsDirectory = path.join(testCacheDir!, "not-a-directory");
    fs.writeFileSync(fileAsDirectory, "x");
    try {
      resolveOfficialCaseStorePath({
        env: { SWISS_LEGAL_CACHE_DIR: path.join(fileAsDirectory, "cache") },
      });
      throw new Error("expected cache error");
    } catch (error) {
      expect(error).toBeInstanceOf(OfficialCaseCacheError);
      expect((error as OfficialCaseCacheError).safeMessage).not.toContain("ENOENT");
    }
  });

  it("renames corrupt stores and continues with a clean store", async () => {
    const resolved = resolveOfficialCaseStorePath();
    fs.mkdirSync(path.dirname(resolved.file), { recursive: true });
    fs.writeFileSync(resolved.file, "{not-json", { mode: 0o600 });
    const result = await fetchOfficialSwissCaseFullTextByIdentifier({ document_id: "doc_missing" });
    expect(result.warnings).toContain("stale_identifier");
    expect(
      fs.readdirSync(path.dirname(resolved.file)).some((name) => name.includes(".corrupt-")),
    ).toBe(true);
    expect(getOfficialCaseCacheDiagnostics().warning).toBe("cache_store_corrupt_renamed");
  });

  it("supports concurrent atomic writers and restart reads", async () => {
    await Promise.all([
      resolveOfficialSwissCase({ case_reference: "9C_999/2026" }),
      resolveOfficialSwissCase({ case_reference: "9C_999/2026" }),
    ]);
    const diagnostics = getOfficialCaseCacheDiagnostics();
    expect(diagnostics.cache_store_initialized).toBe(true);
    expect(diagnostics.cache_directory_writable).toBe(true);
    expect(diagnostics.cwd_independent).toBe(true);
  });

  it("runs the resolution pipeline from a cwd outside the project", async () => {
    const original = process.cwd();
    try {
      process.chdir("/tmp");
      const result = await resolveOfficialSwissCase({ case_reference: "9C_999/2026" });
      expect(result.discovery_status).toBe("candidate_selected");
      expect(result.cache_status).toBe("cache_miss");
      expect(getOfficialCaseCacheDiagnostics()).toMatchObject({
        cache_store_initialized: true,
        cache_directory_writable: true,
        cwd_independent: true,
      });
    } finally {
      process.chdir(original);
    }
  });
});

describe("official Swiss case resolver normalization", () => {
  it("normalizes BGer case numbers", () => {
    expect(normalizeSwissCaseReference("1B_352/2019")).toMatchObject({
      normalized_reference: "1B_352/2019",
      citation_family: "federal_case_number",
      court_family: "swiss_federal_supreme_court",
      decision_year: 2019,
      sequence_number: "352",
      chamber_or_division: "1B",
    });
  });

  it("normalizes BGE and ATF", () => {
    expect(normalizeSwissCaseReference("BGE 136 II 457")).toMatchObject({
      normalized_reference: "BGE 136 II 457",
      citation_family: "published_federal_report",
      publication_type: "official_report",
    });
    expect(normalizeSwissCaseReference("ATF 136 II 457")).toMatchObject({
      normalized_reference: "BGE 136 II 457",
      court_family: "swiss_federal_supreme_court",
    });
  });

  it("normalizes BVGer references", () => {
    expect(normalizeSwissCaseReference("A-1234/2025")).toMatchObject({
      citation_family: "bvger_case_number",
      court_family: "federal_administrative_court",
      chamber_or_division: "A",
    });
  });

  it("normalizes BStGer references", () => {
    expect(normalizeSwissCaseReference("BB.2025.10")).toMatchObject({
      citation_family: "bstger_case_number",
      court_family: "federal_criminal_court",
      chamber_or_division: "BB",
      decision_year: 2025,
    });
  });

  it("keeps cantonal references ambiguous without canton hints", () => {
    expect(normalizeSwissCaseReference("AC/2050/2024")).toMatchObject({
      citation_family: "cantonal_case_number",
      court_family: "cantonal_court",
      possible_cantons: [],
      normalization_confidence: 0.56,
    });
  });

  it("recognizes official direct URLs", () => {
    expect(normalizeSwissCaseReference("https://www.bger.ch/case/9C_999%2F2026")).toMatchObject({
      citation_family: "url",
      court_family: "swiss_federal_supreme_court",
      publication_type: "url",
    });
  });

  it("recognizes non-official URLs without making them official", () => {
    const result = normalizeSwissCaseReference("https://entscheidsuche.ch/case/9C_999-2026");
    expect(result.citation_family).toBe("url");
    expect(result.court_family).toBe("unknown");
  });
});

describe("official Swiss case identity and ranking", () => {
  it("selects an exact official candidate", async () => {
    const result = await resolveOfficialSwissCase({ case_reference: "9C_999/2026" });
    expect(result.discovery_status).toBe("candidate_selected");
    expect(result.selected_candidate?.official).toBe(true);
  });

  it("returns ambiguity on equal candidate scores", async () => {
    const result = await resolveOfficialSwissCase({
      case_reference: "9C_999/2026",
      court_hint: "ambiguous_test",
    });
    expect(result.discovery_status).toBe("candidate_ambiguous");
    expect(result.selected_candidate).toBeNull();
  });

  it("verifies identity with multiple fields", () => {
    const result = verifySwissCaseIdentity({
      normalized: normalizeSwissCaseReference("9C_999/2026"),
      candidate: candidate(),
      liveDocumentMetadata: {
        reference: "9C_999/2026",
        decision_date: "2026-01-15",
        court_family: "swiss_federal_supreme_court",
        title: "Swiss Federal Supreme Court judgment",
      },
    });
    expect(result.status).toBe("identity_verified");
    expect(result.matched_fields).toEqual(expect.arrayContaining(["reference", "court_family"]));
  });

  it("marks non-official identity as probable only", () => {
    const result = verifySwissCaseIdentity({
      normalized: normalizeSwissCaseReference("9C_999/2026"),
      candidate: candidate({ official: false, source_url: "https://entscheidsuche.ch/case/9C" }),
      liveDocumentMetadata: {
        reference: "9C_999/2026",
        decision_date: "2026-01-15",
        court_family: "swiss_federal_supreme_court",
        title: "Swiss Federal Supreme Court judgment",
      },
      strict: false,
    });
    expect(result.status).toBe("identity_probable");
    expect(result.official_identity_verified).toBe(false);
  });

  it("detects identity mismatch", () => {
    const result = verifySwissCaseIdentity({
      normalized: normalizeSwissCaseReference("9C_999/2026"),
      candidate: candidate({ reference: "9C_998/2026" }),
      liveDocumentMetadata: {
        reference: "9C_998/2026",
        decision_date: "2026-01-15",
        court_family: "swiss_federal_supreme_court",
        title: "Swiss Federal Supreme Court judgment",
      },
    });
    expect(result.status).toBe("identity_mismatch");
    expect(result.mismatched_fields).toContain("reference");
  });

  it("separates reference year from decision year without identity mismatch", () => {
    const result = verifySwissCaseIdentity({
      normalized: normalizeSwissCaseReference("9C_999/2026"),
      candidate: candidate({ decision_date: "2025-12-31" }),
      liveDocumentMetadata: {
        reference: "9C_999/2026",
        decision_date: "2025-12-31",
        court_family: "swiss_federal_supreme_court",
        title: "Swiss Federal Supreme Court judgment",
      },
    });
    expect(result.mismatched_fields).not.toContain("decision_year");
    expect(result.reference_year).toBe(2026);
    expect(result.decision_year).toBe(2025);
    expect(result.year_relationship).toBe("decision_before_reference_year");
    expect(result.year_mismatch).toBe(false);
    expect(result.year_mismatch_blocking).toBe(false);
  });

  it("detects court discrepancy", () => {
    const result = verifySwissCaseIdentity({
      normalized: normalizeSwissCaseReference("9C_999/2026"),
      candidate: candidate({ court_family: "federal_administrative_court" }),
      liveDocumentMetadata: {
        reference: "9C_999/2026",
        decision_date: "2026-01-15",
        court_family: "federal_administrative_court",
        title: "Swiss Federal Supreme Court judgment",
      },
    });
    expect(result.status).toBe("identity_mismatch");
    expect(result.mismatched_fields).toContain("court_family");
  });

  it("keeps cantonal identity ambiguous without canton", () => {
    const result = verifySwissCaseIdentity({
      normalized: normalizeSwissCaseReference("AC/2050/2024"),
      candidate: candidate({
        reference: "AC/2050/2024",
        court_family: "cantonal_court",
        chamber: "AC",
        decision_date: "2024-01-15",
      }),
      liveDocumentMetadata: {
        reference: "AC/2050/2024",
        decision_date: "2024-01-15",
        court_family: "cantonal_court",
        title: "Cantonal judgment",
      },
    });
    expect(result.status).toBe("identity_ambiguous");
  });

  it("blocks circular identity verification without live document metadata", () => {
    const result = verifySwissCaseIdentity({
      normalized: normalizeSwissCaseReference("9C_999/2026"),
      candidate: candidate(),
    });
    expect(result.status).toBe("identity_not_verifiable");
    expect(result.circular_verification_detected).toBe(true);
    expect(result.official_identity_verified).toBe(false);
  });
});

describe("official Swiss case fetch and completeness", () => {
  it("tracks physical PDF pages separately from logical document units", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveBinaryResponse(url, estvPdfFixture(), "application/pdf"),
    );

    const fetch = await fetchOfficialSwissCaseFullText({
      candidate: candidateWithoutEmbeddedContent(),
    });
    const completeness = verifyCompleteness(fetch);

    expect(fetch.physical_page_count).toBeGreaterThan(1);
    expect(fetch.extracted_page_count).toBe(fetch.physical_page_count);
    expect(fetch.pages_with_text?.length).toBe(fetch.physical_page_count);
    expect(fetch.pages_without_text).toEqual([]);
    expect(fetch.pages_failed).toEqual([]);
    expect(fetch.physical_page_coverage).toBe(1);
    expect(fetch.document_unit_count).toBeUndefined();
    expect(completeness.total_pages).toBe(fetch.physical_page_count);
    expect(completeness.document_unit_count).toBeUndefined();
    // FALLO 2 regression: real physical page ranges matched to a section must be preserved
    // (never nulled out or collapsed to a fabricated page 1) once the document genuinely has
    // pagination.
    expect(fetch.section_evidence?.length).toBeGreaterThan(0);
    const matchedSection = fetch.section_evidence?.find((entry) => entry.page_start !== null);
    expect(matchedSection?.page_start).toBeGreaterThan(0);
    expect(matchedSection?.page_end).toBeGreaterThanOrEqual(matchedSection?.page_start ?? 0);
    expect(matchedSection?.page_start).toBeLessThanOrEqual(fetch.physical_page_count ?? 0);
  }, 15000);

  it("does not present HTML document units as physical pages", async () => {
    const { fetch, completeness } = await fetchAndCompleteness(candidate());

    expect(fetch.physical_page_count).toBeNull();
    expect(fetch.document_unit_count).toBe(1);
    expect(completeness.total_pages).toBeNull();
    expect(completeness.document_unit_count).toBe(1);
    expect(completeness.page_coverage).toBe(1);
  });

  it("blocks legal eligibility when OCR is required for an otherwise official PDF", async () => {
    setOfficialCaseHttpTransportForTestsForPdfWithoutText();

    const result = await resolveOfficialSwissCase({
      case_reference: "9C_999/2026",
      require_official_source: true,
      require_full_text: true,
      retrieval_mode: "refresh",
    });

    expect(result.fetch?.fetch_status).not.toBe("fetch_success");
    expect(result.legal_use.official_verification_status).not.toBe("full_text_verified_official");
    expect(result.legal_use.ratio_status).toBe("ratio_not_confirmed");
    expect(result.legal_use.strategy_eligibility).toBe("blocked");
  });

  it("detects language mismatches between URL locale and extracted content", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(`${url}&locale=fr`, bvgerDocumentHtml(), "text/html;charset=utf-8"),
    );

    const fetch = await fetchOfficialSwissCaseFullText({
      candidate: candidate({
        source_url: "https://bvger.weblaw.ch/pdf/A-4733-2022.pdf?locale=fr",
        canonical_url: "https://bvger.weblaw.ch/pdf/A-4733-2022.pdf?locale=fr",
        court_family: "federal_administrative_court",
        mime_type: "text/html",
        content_kind: "html",
        language: "fr",
      }),
    });

    expect(fetch.requested_locale).toBe("fr");
    expect(fetch.document_language_detected).toBe("de");
    expect(fetch.document_language_sources).toContain("content_dominant_terms");
    expect(fetch.language_mismatch).toBe(true);
  });

  it("downloads complete HTML", async () => {
    const { fetch, completeness } = await fetchAndCompleteness(candidate());
    expect(fetch.fetch_status).toBe("fetch_success");
    expect(completeness.completeness_status).toBe("complete");
  });

  it("rejects malformed PDF bytes passively", async () => {
    const { fetch, completeness } = await fetchAndCompleteness(
      candidate({ mime_type: "application/pdf", content_kind: "pdf" }),
    );
    expect(fetch.mime_type).toBe("application/pdf");
    expect(fetch.fetch_status).toBe("unsupported_format");
    expect(fetch.warnings).toContain("pdf_extraction_failed");
    expect(completeness.completeness_status).toBe("unknown");
  });

  it("detects truncated content", async () => {
    const { completeness } = await fetchAndCompleteness(
      candidate({
        content: completeContent().replace("Official facts.", "Official facts. [TRUNCATED]"),
      }),
    );
    expect(completeness.completeness_status).toBe("truncated");
  });

  it("detects missing dispositive", async () => {
    const { completeness } = await fetchAndCompleteness(
      candidate({ content: completeContent().replace(/\[dispositive\][^[]+/, "") }),
    );
    expect(completeness.completeness_status).toBe("missing_dispositive");
  });

  it("detects missing facts", async () => {
    const { completeness } = await fetchAndCompleteness(
      candidate({ content: completeContent().replace(/\[facts\][^[]+/, "") }),
    );
    expect(completeness.completeness_status).toBe("missing_facts");
  });

  it("detects missing final reasoning", async () => {
    const { completeness } = await fetchAndCompleteness(
      candidate({ content: completeContent().replace(/\[final_reasoning\][^[]+/, "") }),
    );
    expect(completeness.completeness_status).toBe("missing_final_reasoning");
  });

  it("detects OCR defects", async () => {
    const { completeness } = await fetchAndCompleteness(
      candidate({ content: completeContent().replace("Official facts.", "OCR_DEFECTIVE") }),
    );
    expect(completeness.completeness_status).toBe("ocr_defective");
  });

  it("detects challenge pages", async () => {
    const fetch = await fetchOfficialSwissCaseFullText({
      candidate: candidate({ content: "challenge page captcha" }),
    });
    expect(fetch.fetch_status).toBe("access_restricted");
  });

  it("detects login walls", async () => {
    const fetch = await fetchOfficialSwissCaseFullText({
      candidate: candidate({ content: "login required" }),
    });
    expect(fetch.fetch_status).toBe("access_restricted");
  });

  it("detects rate limits", async () => {
    const fetch = await fetchOfficialSwissCaseFullText({
      candidate: candidate({ content: "rate limit" }),
    });
    expect(fetch.fetch_status).toBe("rate_limited");
  });

  it("rejects wrong executable MIME", async () => {
    const fetch = await fetchOfficialSwissCaseFullText({
      candidate: candidate({ mime_type: "application/javascript" }),
    });
    expect(fetch.fetch_status).toBe("unsupported_format");
  });

  it("rejects oversized content", async () => {
    const fetch = await fetchOfficialSwissCaseFullText({
      candidate: candidate({ content: "x".repeat(5_000_001) }),
    });
    expect(fetch.fetch_status).toBe("fetch_failed");
    expect(fetch.warnings).toContain("response_too_large");
  });

  it("blocks synthetic content even in a candidate fixture", async () => {
    const fetch = await fetchOfficialSwissCaseFullText({
      candidate: candidate({ content: "Synthetic official facts for 9C_999/2026" }),
    });
    expect(fetch.fetch_status).toBe("fetch_failed");
    expect(fetch.warnings).toContain("synthetic_content_detected");
  });

  it("blocks fetch success without bytes", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) => ({
      ...liveResponse(url, ""),
      bytes_received: 0,
      content_length: 0,
      body: new Uint8Array(),
    }));
    const fetch = await fetchOfficialSwissCaseFullText({
      candidate: candidateWithoutEmbeddedContent(),
    });
    expect(fetch.fetch_status).toBe("empty_document");
    expect(fetch.document_hash).toBeNull();
  });

  it("blocks epoch retrieval timestamps", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) => ({
      ...liveResponse(url, completeContent()),
      retrieved_at: "1970-01-01T00:00:00.000Z",
    }));
    const fetch = await fetchOfficialSwissCaseFullText({
      candidate: candidateWithoutEmbeddedContent(),
    });
    expect(fetch.fetch_status).toBe("fetch_failed");
    expect(fetch.warnings).toContain("invalid_retrieved_at");
  });

  it("rejects fictitious bger case URLs", async () => {
    const fetch = await fetchOfficialSwissCaseFullText({
      candidate: candidate({
        content: completeContent(),
        source_url: "https://www.bger.ch/case/9C_999%2F2026",
        canonical_url: "https://www.bger.ch/case/9C_999%2F2026",
      }),
    });
    expect(fetch.fetch_status).toBe("fetch_failed");
    expect(fetch.warnings).toContain("fictional_official_url_rejected");
  });

  it("blocks redirection to a non-allowlisted domain", async () => {
    const result = await resolveOfficialSwissCase({
      case_reference: "9C_999/2026",
      source_url_hint: "https://evil.example/case/9C_999",
    });
    expect(result.selected_candidate?.source_url).toContain("bger.ch");
  });

  it("blocks localhost SSRF direct URLs", async () => {
    const result = await resolveOfficialSwissCase({
      case_reference: "9C_999/2026",
      source_url_hint: blockedLocalUrl(["127", "0", "0", "1"]),
    });
    expect(result.candidates.every((item) => !item.source_url.includes("127"))).toBe(true);
  });

  it("blocks private network SSRF direct URLs", async () => {
    const result = await resolveOfficialSwissCase({
      case_reference: "9C_999/2026",
      source_url_hint: blockedLocalUrl(["192", "168", "1", "2"]),
    });
    expect(result.candidates.every((item) => !item.source_url.includes("192.168"))).toBe(true);
  });
});

describe("official Swiss case BVGer official adapter", () => {
  it("posts to the official BVGer Weblaw API and selects the exact PDF candidate", async () => {
    const calls: { url: string; method: string | undefined; body: string | undefined }[] = [];
    setOfficialSwissCaseHttpTransportForTests(async (url, options) => {
      calls.push({ url, method: options?.method, body: options?.body });
      if (url.includes("searchQueryService")) {
        return liveResponse(url, bvgerSearchJson([bvgerSearchDocument()]), "application/json");
      }
      return liveResponse(url, bvgerDocumentHtml(), "text/html;charset=utf-8");
    });

    const result = await resolveOfficialSwissCase({
      case_reference: "A-4733/2022",
      require_official_source: true,
      require_full_text: true,
      strict_identity_match: true,
      retrieval_mode: "refresh",
    });

    expect(calls[0]).toMatchObject({
      url: "https://bvger.weblaw.ch/api/.netlify/functions/searchQueryService",
      method: "POST",
    });
    expect(JSON.parse(calls[0]!.body!)).toMatchObject({
      queryString: "A-4733/2022",
      guiLanguage: "de",
    });
    expect(result.discovery_status).toBe("candidate_selected");
    expect(result.selected_candidate?.source_adapter).toBe("federal_administrative_court");
    expect(calls.some((call) => call.url.includes("/pdf/A-4733-2022_2024-10-31_"))).toBe(true);
    expect(result.identity.status).toBe("identity_verified");
    expect(result.legal_use.official_verification_status).toBe("full_text_verified_official");
  });

  it("does not select a citing BVGer document when an exact result is present", async () => {
    const calls: string[] = [];
    setOfficialSwissCaseHttpTransportForTests(async (url) => {
      calls.push(url);
      if (url.includes("searchQueryService")) {
        return liveResponse(
          url,
          bvgerSearchJson([
            bvgerSearchDocument("C-1111/2023", "citing-document"),
            bvgerSearchDocument("A-4733/2022", "exact-document"),
          ]),
          "application/json",
        );
      }
      return liveResponse(url, bvgerDocumentHtml(), "text/html;charset=utf-8");
    });

    const result = await resolveOfficialSwissCase({
      case_reference: "A-4733/2022",
      require_official_source: true,
      require_full_text: true,
      strict_identity_match: true,
      retrieval_mode: "refresh",
    });

    expect(calls.some((url) => url.includes("exact-document.pdf"))).toBe(true);
    expect(calls.every((url) => !url.includes("citing-document.pdf"))).toBe(true);
    expect(result.identity.status).toBe("identity_verified");
  });

  it("reports a portal-accessible no-result BVGer response without fabricating content", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(url, bvgerSearchJson([]), "application/json"),
    );

    const result = await resolveOfficialSwissCase({
      case_reference: "A-4733/2022",
      require_official_source: true,
      require_full_text: true,
      retrieval_mode: "refresh",
    });

    expect(result.discovery_status).toBe("candidate_selected");
    expect(result.fetch?.fetch_status).toBe("fetch_failed");
    expect(result.fetch?.warnings).toContain("portal_accessible_no_result");
    expect(result.legal_use.official_verification_status).not.toBe("full_text_verified_official");
  });

  it("reports a BVGer API parse failure as an adapter failure", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(url, "{not-json", "application/json"),
    );

    const result = await resolveOfficialSwissCase({
      case_reference: "A-4733/2022",
      require_official_source: true,
      require_full_text: true,
      retrieval_mode: "refresh",
    });

    expect(result.fetch?.fetch_status).toBe("fetch_failed");
    expect(
      result.fetch?.warnings.some((warning) =>
        warning.startsWith("bvger_search_response_unparseable"),
      ),
    ).toBe(true);
  });

  it("treats duplicate exact BVGer documents as ambiguous instead of choosing arbitrarily", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(
        url,
        bvgerSearchJson([
          bvgerSearchDocument("A-4733/2022", "first-exact"),
          bvgerSearchDocument("A-4733/2022", "second-exact"),
        ]),
        "application/json",
      ),
    );

    const result = await resolveOfficialSwissCase({
      case_reference: "A-4733/2022",
      require_official_source: true,
      require_full_text: true,
      retrieval_mode: "refresh",
    });

    expect(result.fetch?.fetch_status).toBe("fetch_failed");
    expect(result.fetch?.warnings).toContain("candidate_not_found");
  });
});

describe("official Swiss case BStGer official adapter", () => {
  it("posts to the official BStGer Weblaw API and selects the exact PDF candidate", async () => {
    const calls: { url: string; method: string | undefined; body: string | undefined }[] = [];
    setOfficialSwissCaseHttpTransportForTests(async (url, options) => {
      calls.push({ url, method: options?.method, body: options?.body });
      if (url.includes("/api/getDocuments")) {
        return liveResponse(url, bstgerSearchJson([bstgerSearchDocument()]), "application/json");
      }
      return liveResponse(url, bstgerDocumentHtml(), "text/html;charset=utf-8");
    });

    const result = await resolveOfficialSwissCase({
      case_reference: "SK.2023.1",
      require_official_source: true,
      require_full_text: true,
      strict_identity_match: true,
      retrieval_mode: "refresh",
    });

    expect(calls[0]).toMatchObject({
      url: "https://bstger.weblaw.ch/api/getDocuments?withAggregations=true",
      method: "POST",
    });
    expect(JSON.parse(calls[0]!.body!)).toMatchObject({
      queryString: "SK.2023.1",
      guiLanguage: "de",
      aggs: { fields: [], size: 10 },
    });
    expect(calls[1]).toMatchObject({
      url: "https://bstger.weblaw.ch/api/getDocumentFile/01e7b851-1e32-3ea9-93ca-042e0b20230d?locale=fr&userID=",
      method: "POST",
    });
    expect(JSON.parse(calls[1]!.body!)).toEqual({
      documentTitle: "20230317_SK_2023_1.pdf",
    });
    expect(result.discovery_status).toBe("candidate_selected");
    expect(result.selected_candidate?.source_adapter).toBe("federal_criminal_court");
    expect(result.identity.status).toBe("identity_verified");
    expect(result.fetch?.live_metadata?.decision_date).toBe("2023-03-17");
    expect(result.legal_use.official_verification_status).toBe("full_text_verified_official");
  });

  it("does not select a citing BStGer document when an exact result is present", async () => {
    const calls: string[] = [];
    setOfficialSwissCaseHttpTransportForTests(async (url) => {
      calls.push(url);
      if (url.includes("/api/getDocuments")) {
        return liveResponse(
          url,
          bstgerSearchJson([
            bstgerSearchDocument("BB.2024.1", "citing-document", "de", "2024-04-09T10:00:00Z"),
            bstgerSearchDocument("SK.2023.1", "exact-document", "fr", "2023-03-17T11:00:00Z"),
          ]),
          "application/json",
        );
      }
      return liveResponse(url, bstgerDocumentHtml(), "text/html;charset=utf-8");
    });

    const result = await resolveOfficialSwissCase({
      case_reference: "SK.2023.1",
      require_official_source: true,
      require_full_text: true,
      strict_identity_match: true,
      retrieval_mode: "refresh",
    });

    expect(calls.some((url) => url.includes("/api/getDocumentFile/exact-document"))).toBe(true);
    expect(calls.every((url) => !url.includes("/api/getDocumentFile/citing-document"))).toBe(true);
    expect(result.identity.status).toBe("identity_verified");
  });

  it("reports a portal-accessible no-result BStGer response without fabricating content", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(url, bstgerSearchJson([]), "application/json"),
    );

    const result = await resolveOfficialSwissCase({
      case_reference: "SK.2023.1",
      require_official_source: true,
      require_full_text: true,
      retrieval_mode: "refresh",
    });

    expect(result.discovery_status).toBe("candidate_selected");
    expect(result.fetch?.fetch_status).toBe("fetch_failed");
    expect(result.fetch?.warnings).toContain("portal_accessible_no_result");
    expect(result.legal_use.official_verification_status).not.toBe("full_text_verified_official");
  });

  it("reports a BStGer API parse failure as an adapter failure", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(url, "{not-json", "application/json"),
    );

    const result = await resolveOfficialSwissCase({
      case_reference: "SK.2023.1",
      require_official_source: true,
      require_full_text: true,
      retrieval_mode: "refresh",
    });

    expect(result.fetch?.fetch_status).toBe("fetch_failed");
    expect(
      result.fetch?.warnings.some((warning) =>
        warning.startsWith("bstger_search_response_unparseable"),
      ),
    ).toBe(true);
  });

  it("treats duplicate exact BStGer documents as ambiguous instead of choosing arbitrarily", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(
        url,
        bstgerSearchJson([
          bstgerSearchDocument("SK.2023.1", "first-exact"),
          bstgerSearchDocument("SK.2023.1", "second-exact"),
        ]),
        "application/json",
      ),
    );

    const result = await resolveOfficialSwissCase({
      case_reference: "SK.2023.1",
      require_official_source: true,
      require_full_text: true,
      retrieval_mode: "refresh",
    });

    expect(result.fetch?.fetch_status).toBe("fetch_failed");
    expect(result.fetch?.warnings).toContain("candidate_not_found");
  });
});

describe("official Swiss case Appenzell Ausserrhoden official adapter", () => {
  it("normalizes AR Obergericht references with canton evidence", () => {
    expect(normalizeSwissCaseReference("O2V 19 21")).toMatchObject({
      normalized_reference: "O2V 19 21",
      citation_family: "cantonal_case_number",
      court_family: "cantonal_court",
      possible_cantons: ["AR"],
      possible_courts: ["Obergericht Appenzell Ausserrhoden"],
      chamber_or_division: "O2V",
      sequence_number: "21",
    });
  });

  it("posts to the official AR search API and selects the exact PDF candidate", async () => {
    const calls: { url: string; method: string | undefined; body: string | undefined }[] = [];
    setOfficialSwissCaseHttpTransportForTests(async (url, options) => {
      calls.push({ url, method: options?.method, body: options?.body });
      if (url.includes("searchQueryService")) {
        return liveResponse(url, arSearchJson([arSearchDocument()]), "application/json");
      }
      return liveResponse(url, arDocumentHtml(), "text/html;charset=utf-8");
    });

    const result = await resolveOfficialSwissCase({
      case_reference: "O2V 19 21",
      canton_hint: "AR",
      court_hint: "ar",
      require_official_source: true,
      require_full_text: true,
      strict_identity_match: true,
      retrieval_mode: "refresh",
    });

    expect(calls[0]).toMatchObject({
      url: "https://rechtsprechung.ar.ch/api/.netlify/functions/searchQueryService",
      method: "POST",
    });
    expect(JSON.parse(calls[0]!.body!)).toMatchObject({
      queryString: "O2V 19 21",
      guiLanguage: "de",
    });
    expect(calls.some((call) => call.url.includes("/download/Obergericht/2020/"))).toBe(true);
    expect(result.discovery_status).toBe("candidate_selected");
    expect(result.selected_candidate).toMatchObject({
      source_adapter: "canton_appenzell_ausserrhoden",
      canton: "AR",
      court: "Obergericht Appenzell Ausserrhoden",
      official: true,
    });
    expect(result.identity.status).toBe("identity_verified");
    expect(result.fetch?.live_metadata).toMatchObject({
      reference: "O2V 19 21",
      decision_date: "2020-05-19",
      court_family: "cantonal_court",
    });
    expect(result.legal_use.official_verification_status).toBe("full_text_verified_official");
  });

  it("resolves O2V 19 21 on the first default call with generic cantonal_court and AR hints", async () => {
    const calls = setSuccessfulArTransport();

    const result = await resolveArOfficial({
      court_hint: "cantonal_court",
      canton_hint: "AR",
    });

    expect(result.discovery_status).toBe("candidate_selected");
    expect(result.source_adapter).toBe("canton_appenzell_ausserrhoden");
    expect(result.candidates).toHaveLength(1);
    expect(result.selected_candidate).toMatchObject({
      source_adapter: "canton_appenzell_ausserrhoden",
      canton: "AR",
      court: "Obergericht Appenzell Ausserrhoden",
    });
    expect(result.attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          adapter: "canton_appenzell_ausserrhoden",
          status: "attempted",
        }),
      ]),
    );
    expect(calls[0]).toMatchObject({
      url: "https://rechtsprechung.ar.ch/api/.netlify/functions/searchQueryService",
      method: "POST",
    });
    expect(result.cache_key).toBe("O2V 19 21:");
    expect(result.cache_status).toBe("cache_miss");
    expect(result.identity).toMatchObject({
      status: "identity_verified",
      official_identity_verified: true,
      circular_verification_detected: false,
    });
    expect(result.legal_use.official_verification_status).toBe("full_text_verified_official");
    expect(result.legal_use.ratio_status).toBe("ratio_confirmed");
    expect(result.warnings).not.toContain("official_source_not_found");
  });

  it.each([
    ["canton hint only", { canton_hint: "AR" }],
    ["both generic hints", { court_hint: "cantonal_court", canton_hint: "AR" }],
    ["no hints", {}],
    ["explicit AR court hint", { court_hint: "ar" }],
    ["official court name hint", { court_hint: "Obergericht Appenzell Ausserrhoden" }],
    [
      "refresh mode",
      { court_hint: "cantonal_court", canton_hint: "AR", retrieval_mode: "refresh" },
    ],
  ] satisfies readonly [string, Partial<Parameters<typeof resolveOfficialSwissCase>[0]>][])(
    "selects the AR adapter deterministically with %s",
    async (_label, input) => {
      setSuccessfulArTransport();

      const result = await resolveArOfficial(input);

      expect(result.discovery_status).toBe("candidate_selected");
      expect(result.source_adapter).toBe("canton_appenzell_ausserrhoden");
      expect(result.selected_candidate?.canton).toBe("AR");
      expect(result.candidates.map((item) => item.source_adapter)).toEqual([
        "canton_appenzell_ausserrhoden",
      ]);
      expect(result.identity.circular_verification_detected).toBe(false);
    },
  );

  it("does not let a prior no-candidate resolution for a generic or wrong canton hint block the specific AR adapter", async () => {
    setSuccessfulArTransport();

    const wrongCanton = await resolveArOfficial({
      canton_hint: "AI",
    });
    expect(wrongCanton.discovery_status).toBe("no_candidate");
    expect(wrongCanton.identity).toMatchObject({
      status: "identity_not_verifiable",
      identity_score: null,
      identity_confidence: null,
      circular_verification_detected: false,
    });

    const result = await resolveArOfficial({
      court_hint: "cantonal_court",
      canton_hint: "AR",
    });

    expect(result.discovery_status).toBe("candidate_selected");
    expect(result.source_adapter).toBe("canton_appenzell_ausserrhoden");
    expect(result.cache_status).toBe("cache_miss");
    expect(result.warnings).not.toContain("official_source_not_found");
  });

  it("does not persist AR parser failures as definitive negative cache entries", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(url, "{not-json", "application/json"),
    );

    const parserFailure = await resolveArOfficial({
      court_hint: "cantonal_court",
      canton_hint: "AR",
    });
    expect(parserFailure.discovery_status).toBe("candidate_selected");
    expect(parserFailure.fetch?.fetch_status).toBe("fetch_failed");
    expect(
      parserFailure.fetch?.warnings.some((warning) =>
        warning.startsWith("ar_search_response_unparseable"),
      ),
    ).toBe(true);

    clearOfficialSwissCaseResolverCache();
    setSuccessfulArTransport();

    const result = await resolveArOfficial({
      court_hint: "cantonal_court",
      canton_hint: "AR",
    });

    expect(result.discovery_status).toBe("candidate_selected");
    expect(result.source_adapter).toBe("canton_appenzell_ausserrhoden");
    expect(result.identity.status).toBe("identity_verified");
  });

  it("resolves AR with an existing store that contains another reference but not O2V 19 21", async () => {
    await resolveOfficialSwissCase({
      case_reference: "9C_999/2026",
      require_official_source: true,
      require_full_text: true,
    });
    clearOfficialSwissCaseResolverCache();
    setSuccessfulArTransport();

    const result = await resolveArOfficial({
      court_hint: "cantonal_court",
      canton_hint: "AR",
    });

    expect(result.discovery_status).toBe("candidate_selected");
    expect(result.source_adapter).toBe("canton_appenzell_ausserrhoden");
    expect(getOfficialCaseCacheDiagnostics().persistence_between_independent_calls).toBe(true);
  });

  it("resolves AR after clearing the in-memory cache, simulating a fresh process", async () => {
    setSuccessfulArTransport();
    const first = await resolveArOfficial({
      court_hint: "cantonal_court",
      canton_hint: "AR",
    });
    expect(first.discovery_status).toBe("candidate_selected");

    clearOfficialSwissCaseResolverCache();
    const second = await resolveArOfficial({
      court_hint: "cantonal_court",
      canton_hint: "AR",
    });

    expect(second.discovery_status).toBe("candidate_selected");
    expect(second.source_adapter).toBe("canton_appenzell_ausserrhoden");
    expect(second.document_hash).toBe(first.document_hash);
  });

  it("resolves AR from a cwd outside the project", async () => {
    setSuccessfulArTransport();
    const original = process.cwd();
    try {
      process.chdir(os.tmpdir());
      const result = await resolveArOfficial({
        court_hint: "cantonal_court",
        canton_hint: "AR",
      });
      expect(result.discovery_status).toBe("candidate_selected");
      expect(result.source_adapter).toBe("canton_appenzell_ausserrhoden");
      expect(getOfficialCaseCacheDiagnostics().cwd_independent).toBe(true);
    } finally {
      process.chdir(original);
    }
  });

  it("produces stable AR results across two consecutive default calls", async () => {
    setSuccessfulArTransport();

    const first = await resolveArOfficial({
      court_hint: "cantonal_court",
      canton_hint: "AR",
    });
    const second = await resolveArOfficial({
      court_hint: "cantonal_court",
      canton_hint: "AR",
    });

    expect(first.discovery_status).toBe("candidate_selected");
    expect(second.discovery_status).toBe("candidate_selected");
    expect(second.source_adapter).toBe(first.source_adapter);
    expect(second.selected_candidate?.candidate_id).toBe(first.selected_candidate?.candidate_id);
    expect(second.cache_status).toBe("cache_hit_valid");
  });

  it("does not select a citing AR document when an exact result is present", async () => {
    const calls: string[] = [];
    setOfficialSwissCaseHttpTransportForTests(async (url) => {
      calls.push(url);
      if (url.includes("searchQueryService")) {
        return liveResponse(
          url,
          arSearchJson([
            arSearchDocument(
              "O2V 19 19",
              "citing-document",
              "https://rechtsprechung.ar.ch/download/Obergericht/2020/OG-20200408-O2V-19-19-20200618.pdf",
            ),
            arSearchDocument("O2V 19 21", "exact-document"),
          ]),
          "application/json",
        );
      }
      return liveResponse(url, arDocumentHtml(), "text/html;charset=utf-8");
    });

    const result = await resolveOfficialSwissCase({
      case_reference: "O2V 19 21",
      canton_hint: "AR",
      require_official_source: true,
      require_full_text: true,
      strict_identity_match: true,
      retrieval_mode: "refresh",
    });

    expect(calls.some((url) => url.includes("O2V-19-21"))).toBe(true);
    expect(calls.every((url) => !url.includes("O2V-19-19"))).toBe(true);
    expect(result.identity.status).toBe("identity_verified");
  });

  it("reports a portal-accessible no-result AR response without fabricating content", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(url, arSearchJson([]), "application/json"),
    );

    const result = await resolveOfficialSwissCase({
      case_reference: "O2V 19 21",
      canton_hint: "AR",
      require_official_source: true,
      require_full_text: true,
      retrieval_mode: "refresh",
    });

    expect(result.discovery_status).toBe("no_candidate");
    expect(result.selected_candidate_id).toBeNull();
    expect(result.document_availability_status).toBe("document_not_found");
    expect(result.fetchability_status).toBe("not_fetchable");
    expect(result.fetch?.fetch_status).toBe("fetch_failed");
    expect(result.fetch?.warnings).toContain("portal_accessible_no_result");
    expect(result.legal_use.official_verification_status).not.toBe("full_text_verified_official");
  });

  it("reports an AR API parse failure as an adapter failure", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(url, "{not-json", "application/json"),
    );

    const result = await resolveOfficialSwissCase({
      case_reference: "O2V 19 21",
      canton_hint: "AR",
      require_official_source: true,
      require_full_text: true,
      retrieval_mode: "refresh",
    });

    expect(result.fetch?.fetch_status).toBe("fetch_failed");
    expect(
      result.fetch?.warnings.some((warning) =>
        warning.startsWith("ar_search_response_unparseable"),
      ),
    ).toBe(true);
  });

  it("treats duplicate exact AR documents as ambiguous instead of choosing arbitrarily", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(
        url,
        arSearchJson([
          arSearchDocument("O2V 19 21", "first-exact"),
          arSearchDocument("O2V 19 21", "second-exact"),
        ]),
        "application/json",
      ),
    );

    const result = await resolveOfficialSwissCase({
      case_reference: "O2V 19 21",
      canton_hint: "AR",
      require_official_source: true,
      require_full_text: true,
      retrieval_mode: "refresh",
    });

    expect(result.fetch?.fetch_status).toBe("fetch_failed");
    expect(result.fetch?.warnings).toContain("candidate_not_found");
  });

  it("does not confuse Appenzell Ausserrhoden AR with Appenzell Innerrhoden AI hints", async () => {
    const result = await resolveOfficialSwissCase({
      case_reference: "O2V 19 21",
      canton_hint: "AI",
      require_official_source: true,
      retrieval_mode: "refresh",
    });

    expect(result.selected_candidate?.canton).not.toBe("AR");
    expect(result.selected_candidate?.source_adapter).not.toBe("canton_appenzell_ausserrhoden");
  });
});

describe("official Swiss case multi-candidate identity, metadata and ambiguity", () => {
  it("extracts BGer primary_reference from the official docid instead of an internal cited case", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) => {
      if (url.includes("type=search") || url.includes("type=simple_query")) {
        return liveResponse(
          url,
          '<html><body><a href="https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&type=show_document&highlight_docid=aza://06-05-2024-6B_1034-2020">Urteil 6B_1034/2020</a></body></html>',
        );
      }
      return liveResponse(
        url,
        completeContent("6B_1034/2020")
          .replace("15. Januar 2026", "06.05.2024")
          .replace("Official facts.", "Official facts. CR.2020.5 is cited as related matter."),
      );
    });

    const result = await resolveOfficialSwissCase({
      case_reference: "6B_1034/2020",
      require_official_source: true,
      require_full_text: true,
      strict_identity_match: true,
      retrieval_mode: "refresh",
    });

    expect(result.fetch?.live_metadata).toMatchObject({
      primary_reference: "6B_1034/2020",
      reference: "6B_1034/2020",
      primary_reference_source: "official_url_docid",
    });
    expect(result.fetch?.live_metadata?.cited_references).toContain("CR.2020.5");
    expect(result.identity.status).toBe("identity_verified");
  });

  it("keeps 6B reference year and 2024 decision year consistent across embedded and standalone identity", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) => {
      if (url.includes("type=search") || url.includes("type=simple_query")) {
        return liveResponse(
          url,
          '<html><body><a href="https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&type=show_document&highlight_docid=aza://06-05-2024-6B_1034-2020">Urteil 6B_1034/2020</a></body></html>',
        );
      }
      return liveResponse(
        url,
        [
          "Bundesgericht Tribunal fédéral",
          "6B_1034/2020 06.05.2024",
          "Faits:",
          "La décision cantonale CR.2020.5 est citée uniquement comme procédure liée.",
          "Par ces motifs, la procédure 6B_1034/2020 est rayée du rôle.",
        ].join("\n"),
        "text/html;charset=utf-8",
      );
    });

    const resolved = await resolveOfficialSwissCase({
      case_reference: "6B_1034/2020",
      require_official_source: true,
      require_full_text: true,
      strict_identity_match: true,
      retrieval_mode: "refresh",
    });
    const standalone = await verifySwissCaseIdentityByIdentifier({
      document_id: resolved.document_id!,
      requested_reference: "6B_1034/2020",
    });

    expect(resolved.identity).toMatchObject({
      status: "identity_verified",
      official_identity_verified: true,
      mismatched_fields: [],
      circular_verification_detected: false,
      reference_year: 2020,
      decision_year: 2024,
      year_relationship: "decision_after_reference_year",
      year_mismatch: false,
      year_mismatch_blocking: false,
    });
    expect(standalone).toMatchObject({
      status: "identity_verified",
      official_identity_verified: true,
      mismatched_fields: [],
      circular_verification_detected: false,
      reference_year: 2020,
      decision_year: 2024,
      year_relationship: "decision_after_reference_year",
    });
    expect({
      identity_status_same: standalone.status === resolved.identity.status,
      official_identity_verified_same:
        standalone.official_identity_verified === resolved.identity.official_identity_verified,
      mismatched_fields_same:
        JSON.stringify(standalone.mismatched_fields) ===
        JSON.stringify(resolved.identity.mismatched_fields),
      identity_score_same: standalone.identity_score === resolved.identity.identity_score,
      identity_confidence_same:
        standalone.identity_confidence === resolved.identity.identity_confidence,
    }).toEqual({
      identity_status_same: true,
      official_identity_verified_same: true,
      mismatched_fields_same: true,
      identity_score_same: true,
      identity_confidence_same: true,
    });
  });

  it("extracts BStGer primary_reference from official search metadata instead of reviewed decision text", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) => {
      if (url.includes("getDocuments")) {
        return liveResponse(
          url,
          bstgerSearchJson([bstgerSearchDocument("CR.2020.5", "cr-leid", "fr", "2020-08-04")]),
          "application/json",
        );
      }
      return liveResponse(
        url,
        [
          "Tribunal pénal fédéral Cour d'appel",
          "Par jugement du 14 juin 2018 (SK.2016.30), la Cour des affaires pénales a statué.",
          "La procédure de révision CR.2020.5 est rejetée.",
          "La Cour prononce: la demande est rejetée.",
        ].join("\n"),
      );
    });

    const result = await resolveOfficialSwissCase({
      case_reference: "CR.2020.5",
      court_hint: "bstger",
      require_official_source: true,
      require_full_text: true,
      strict_identity_match: true,
      retrieval_mode: "refresh",
    });

    expect(result.fetch?.live_metadata).toMatchObject({
      primary_reference: "CR.2020.5",
      reference: "CR.2020.5",
      primary_reference_source: "official_search_result_metadata",
    });
    expect(result.fetch?.live_metadata?.reviewed_decision_references).toContain("SK.2016.30");
    expect(result.identity.status).toBe("identity_verified");
  });

  it("uses the official BVGer filename date instead of a generic year fallback", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) => {
      if (url.includes("searchQueryService")) {
        return liveResponse(
          url,
          bvgerSearchJson([bvgerSearchDocument("C-7133/2023", "c7133")]).replace(
            "2024-10-31",
            "2024-12-13",
          ),
          "application/json",
        );
      }
      return liveResponse(
        "https://bvger.weblaw.ch/pdf/C-7133-2023_2024-12-13_d8d315a8-90a1-4883-b23e-81ceba0b5958.pdf",
        [
          "Bundesverwaltungsgericht",
          "C-7133/2023",
          "Das Verfahren bezieht sich auf C-1918/2018.",
          "Demnach erkennt das Bundesverwaltungsgericht: Die Beschwerde wird abgewiesen.",
        ].join("\n"),
      );
    });

    const result = await resolveOfficialSwissCase({
      case_reference: "C-7133/2023",
      court_hint: "bvger",
      require_official_source: true,
      require_full_text: true,
      strict_identity_match: true,
      retrieval_mode: "refresh",
    });

    expect(result.fetch?.live_metadata?.decision_date).toBe("2024-12-13");
    expect(result.fetch?.live_metadata?.decision_date_source).toBe("official_filename");
    expect(result.fetch?.live_metadata?.decision_date).not.toBe("2019-01-01");
    expect(result.identity.status).toBe("identity_verified");
  });

  it("keeps failed live fetch identity not verifiable without circular verification", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) => {
      if (url.includes("type=search") || url.includes("type=simple_query")) {
        return liveResponse(url, bgerSearchHtml("9C_999/2026"));
      }
      return liveBinaryResponse(url, new Uint8Array(), "text/html");
    });

    const result = await resolveOfficialSwissCase({
      case_reference: "9C_999/2026",
      require_official_source: true,
      require_full_text: true,
      strict_identity_match: true,
      retrieval_mode: "refresh",
    });

    expect(result.fetch?.fetch_status).toBe("empty_document");
    expect(result.fetch?.warnings).toContain("empty_response");
    expect(result.fetch?.response_body_type).toBe("empty");
    expect(result.fetch?.parser_status).toBe("empty_response");
    expect(result.identity).toMatchObject({
      status: "identity_not_verifiable",
      identity_score: null,
      identity_confidence: null,
      circular_verification_detected: false,
    });
  });

  it("marks BGE search-page hits as metadata-only and not fetchable", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(url, "<html><body>Search results without exact BGE document link</body></html>"),
    );

    const result = await resolveOfficialSwissCase({
      case_reference: "BGE 142 III 91",
      require_official_source: true,
      require_full_text: true,
      strict_identity_match: true,
      retrieval_mode: "refresh",
    });

    expect(result.discovery_status).toBe("candidate_selected");
    expect(result.document_availability_status).toBe("invalid_download_url");
    expect(result.fetchability_status).toBe("not_fetchable");
    expect(result.selected_candidate_status).toBe("selected_metadata_only");
    expect(result.fetch?.fetch_status).toBe("fetch_failed");
    expect(result.fetch?.warnings).toContain("invalid_download_url");
    expect(result.identity.official_identity_verified).toBe(false);
    expect(result.legal_use.comparability_eligibility).toBe("blocked");
  });

  it("maps a published BGE citation through the official BGer CLIR docid", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) => {
      if (url.includes("type=simple_query")) return liveResponse(url, bgerPublishedSearchHtml());
      return liveResponse(url, bgerPublishedDocumentHtml());
    });

    const result = await resolveOfficialSwissCase({
      case_reference: "ATF 142 III 91",
      require_official_source: true,
      require_full_text: true,
      strict_identity_match: true,
      retrieval_mode: "refresh",
    });

    expect(result.normalized).toMatchObject({
      citation_family: "published_federal_report",
      normalized_reference: "BGE 142 III 91",
      canonical_published_citation: "BGE 142 III 91",
    });
    expect(result.fetch).toMatchObject({
      fetch_status: "fetch_success",
      publication_mapping_status: "mapping_verified",
      published_citation: "BGE 142 III 91",
      case_reference: "4A_327/2015",
      official_docid: "atf://142-III-91:de",
      reading_status: "full_text_verified_official",
      mock_or_fixture: false,
    });
    expect(result.fetch?.bytes_received ?? 0).toBeGreaterThan(0);
    expect(result.identity).toMatchObject({
      status: "identity_verified",
      official_identity_verified: true,
      circular_verification_detected: false,
    });
    expect(result.completeness?.physical_page_count).toBe(2);
  });

  it("returns auditable obiter details without promoting them to ratio", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) => {
      if (url.includes("type=search") || url.includes("type=simple_query")) {
        return liveResponse(url, bgerSearchHtml());
      }
      return liveResponse(
        url,
        completeContent().replace(
          "[final_reasoning]",
          "[final_reasoning] Obiter dictum: this historical note is not necessary for the result. ",
        ),
      );
    });
    const resolved = await resolveOfficialSwissCase({ case_reference: "9C_999/2026" });
    expect(resolved.legal_use.ratio_analysis?.obiter_details?.[0]).toMatchObject({
      necessary_for_dispositive: false,
      relation_to_main_ground: "explicitly_marked_non_decisive",
      reviewed: true,
    });
    expect(resolved.legal_use.ratio_analysis?.ratio_summary).not.toContain("Obiter dictum");
    expect(resolved.legal_use.ratio_analysis?.warnings).toContain("obiter_excluded_from_ratio");
  });

  it("blocks ratio confirmation when an autonomous ground is not reviewed", async () => {
    const result = await resolveOfficialSwissCase({
      case_reference: "9C_999/2026",
      retrieval_mode: "refresh",
    });
    expect(result.legal_use.ratio_analysis?.independent_ground_details.length).toBeGreaterThan(0);
    expect(result.legal_use.ratio_status).toBe("ratio_confirmed");

    setOfficialSwissCaseHttpTransportForTests(async (url) => {
      if (url.includes("type=search") || url.includes("type=simple_query")) {
        return liveResponse(url, bgerSearchHtml());
      }
      return liveResponse(
        url,
        completeContent().replace("Second autonomous ground reviewed", "Second autonomous ground"),
      );
    });
    const incomplete = await resolveOfficialSwissCase({
      case_reference: "9C_999/2026",
      retrieval_mode: "refresh",
    });
    expect(incomplete.legal_use.ratio_status).toBe("ratio_not_confirmed");
    expect(incomplete.legal_use.ratio_analysis?.warnings).toContain(
      "missing_independent_ground_review",
    );
    expect(incomplete.legal_use.strategy_eligibility).toBe("blocked");
    expect(incomplete.legal_use.drafting_eligibility).toBe("blocked");
    expect(incomplete.legal_use.comparability_eligibility).toBe("blocked");
  });

  it("extracts structured autonomous grounds from official-style German reasoning", async () => {
    const fetched = await fetchOfficialSwissCaseFullText({
      candidate: candidate({
        mime_type: "text/html;charset=utf-8",
        content: [
          "[header] 9C_999/2026 swiss_federal_supreme_court Bundesgericht 15. Januar 2026",
          "[facts] Sachverhalt mit Beschwerde und Vorinstanz.",
          "[procedural_history] Verfahren vor der Vorinstanz.",
          "[party_arguments] Rechtsbegehren der beschwerdefuehrenden Partei.",
          "[lower_authority_reasoning] Die Vorinstanz hielt mehrere Punkte fest.",
          "[reasoning] Die Vorinstanz hielt fest, der Anspruch scheitere am Nachweis. Ihren Entscheid stützte die Vorinstanz auf mehrere jeweils selbständig tragende Begründungen. Einerseits habe die Beschwerdeführerin den Bruttogewinn nicht hinreichend substanziiert behauptet und die Rechtsschriften enthielten nur pauschale Verweise auf Beilagen. Andererseits habe die Beschwerdeführerin die fraglichen Beweismittel nicht formgerecht angeboten, weil die umfangreichen Beweisofferten nicht eindeutig den Tatsachenbehauptungen zugeordnet worden seien. Insgesamt trägt jede Begründung den Ausgang selbständig.",
          "[final_reasoning] Die Beschwerde ist abzuweisen, soweit darauf einzutreten ist.",
          "[dispositive] Die Beschwerde wird abgewiesen.",
          "[costs] Die Gerichtskosten werden auferlegt.",
        ].join("\n"),
      }),
    });
    const completeness = verifyCompleteness(fetched);
    expect(completeness.independent_grounds_count).toBeGreaterThanOrEqual(2);
    expect(completeness.independent_grounds_read).toBe(completeness.independent_grounds_count);
    expect(completeness.extraction_errors).not.toContain("missing_independent_ground_review");
  });

  it("does not promote lower-instance detention grounds to autonomous grounds", async () => {
    const neutralFiller = Array.from(
      { length: 30 },
      (_, index) =>
        `Absatz ${index + 1}: Das Gericht prüft Akten, Vorbringen, Verfahrensstand, Zuständigkeit und die formellen Voraussetzungen der Beschwerde.`,
    ).join(" ");
    const content = [
      "[header] 1B_62/2021 swiss_federal_supreme_court Bundesgericht 10. Februar 2021",
      `[facts] Sachverhalt mit Haftbeschwerde und angefochtenem Entscheid. ${neutralFiller}`,
      "[procedural_history] Verfahren vor dem Appellationsgericht.",
      "[party_arguments] Der Beschwerdeführer ficht einen Haftgrund an.",
      "[lower_authority_reasoning] Die Vorinstanz würdigte die Haftvoraussetzungen.",
      "[reasoning] Das Appellationsgericht hat im angefochtenen Entscheid sowohl Flucht- als auch Kollusionsgefahr bejaht. Für eine erfolgreiche Beschwerdeführung müsste der Beschwerdeführer somit plausibel darlegen, dass weder Flucht- noch Kollusionsgefahr besteht. Er bestreitet das Vorliegen von Kollusionsgefahr nicht. Er ficht damit nur eine der beiden selbständigen Begründungen an, weshalb auf die Beschwerde nicht einzutreten ist.",
      "[final_reasoning] Da nur eine der beiden selbständigen Begründungen angefochten wurde, ist auf die Beschwerde nicht einzutreten.",
      "[dispositive] Auf die Beschwerde wird nicht eingetreten.",
      "[costs] Die Gerichtskosten werden auferlegt.",
    ].join("\n");
    setOfficialSwissCaseHttpTransportForTests(async (url) => {
      if (url.includes("type=search") || url.includes("type=simple_query")) {
        return liveResponse(url, bgerSearchHtml("1B_62/2021"));
      }
      return liveResponse(url, `<a name="page1"></a>${content}`, "text/html;charset=utf-8");
    });

    const resolved = await resolveOfficialSwissCase({
      case_reference: "1B_62/2021",
      require_official_source: true,
      require_full_text: true,
      retrieval_mode: "refresh",
    });
    const ratio = resolved.legal_use.ratio_analysis;
    const verifiedGrounds =
      ratio?.independent_ground_details.filter(
        (ground) => ground.autonomous && ground.autonomous_ground_status === "verified",
      ) ?? [];

    expect(resolved.legal_use.ratio_status).toBe("ratio_confirmed");
    expect(resolved.completeness?.independent_grounds_count).toBe(0);
    expect(ratio?.independent_grounds_count).toBe(0);
    expect(ratio?.independent_grounds_reviewed).toBe(0);
    expect(verifiedGrounds).toHaveLength(0);
    expect(ratio?.independent_ground_details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          applied_to_case: false,
          autonomous: false,
          independently_sufficient: false,
          autonomous_ground_status: "rejected_lower_instance_ground",
        }),
      ]),
    );
  });

  it("returns empty page numbers for HTML without physical pagination", async () => {
    const fetched = await fetchOfficialSwissCaseFullText({
      candidate: candidate({
        mime_type: "text/html;charset=utf-8",
        content: [
          "[header] 9C_999/2026 swiss_federal_supreme_court Bundesgericht 15. Januar 2026",
          "[facts] Sachverhalt.",
          "[procedural_history] Verfahren.",
          "[party_arguments] Parteivorbringen.",
          "[reasoning] The court reviews the record and reaches a decision.",
          "[final_reasoning] The court reaches the outcome.",
          "[dispositive] The disposition is rendered.",
          "[costs] Costs.",
        ].join("\n"),
      }),
    });
    const completeness = verifyCompleteness(fetched);
    const ratio = resolveOfficialSwissCase({
      case_reference: "9C_999/2026",
      retrieval_mode: "refresh",
    });
    await expect(ratio).resolves.toBeDefined();
    expect(completeness.physical_page_count).toBeNull();
    expect(fetched.physical_page_count).toBeNull();
    const ratioAnalysis = (await ratio).legal_use.ratio_analysis;
    expect(ratioAnalysis?.independent_ground_details[0]?.supporting_page_numbers).toEqual([]);
    // FALLO 2 regression: ratio_evidence must never fabricate page 1 for genuinely unpaginated
    // HTML (content_kind: html, physical_page_count: null, pagination_type: html_unpaginated).
    expect(ratioAnalysis?.ratio_evidence.length).toBeGreaterThan(0);
    for (const evidence of ratioAnalysis?.ratio_evidence ?? []) {
      expect(evidence.page_numbers).toEqual([]);
    }
    for (const ground of ratioAnalysis?.independent_ground_details ?? []) {
      expect(ground.supporting_page_numbers).toEqual([]);
    }
  });

  it("labels HTML pagination as not applicable and preserves real PDF pages", async () => {
    const htmlFetch = await fetchOfficialSwissCaseFullText({
      candidate: candidate({
        mime_type: "text/html;charset=utf-8",
        content: [
          "[header] 9C_999/2026 swiss_federal_supreme_court Bundesgericht 15. Januar 2026",
          "[facts] Sachverhalt.",
          "[procedural_history] Verfahren.",
          "[party_arguments] Parteivorbringen.",
          "[reasoning] The court reviews the record and reaches a decision.",
          "[final_reasoning] The court reaches the outcome.",
          "[dispositive] The disposition is rendered.",
          "[costs] Costs.",
        ].join("\n"),
      }),
    });
    expect(htmlFetch.physical_page_count).toBeNull();
    const htmlRatio = await resolveOfficialSwissCase({
      case_reference: "9C_999/2026",
      retrieval_mode: "refresh",
    });
    expect(
      htmlRatio.legal_use.ratio_analysis?.independent_ground_details[0]?.page_reference_status,
    ).toBe("not_applicable_html");
    const pdfFetch = await fetchOfficialSwissCaseFullText({
      candidate: candidate({
        mime_type: "application/pdf",
        content_kind: "pdf",
        content: "",
      }),
    });
    expect(pdfFetch.physical_page_count).toBeNull();
  });

  it("uses current-court reasoning metadata for 2A.348/2004 grounds", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) => {
      if (url.includes("type=search") || url.includes("type=simple_query")) {
        return liveResponse(url, bgerSearchHtml("2A.348/2004", "01-12-2004"));
      }
      return liveResponse(url, `<a name="page1"></a>${case2a348Content()}`);
    });

    const resolved = await resolveOfficialSwissCase({
      case_reference: "2A.348/2004",
      require_official_source: true,
      require_full_text: true,
      retrieval_mode: "refresh",
    });
    const grounds = resolved.legal_use.ratio_analysis?.independent_ground_details ?? [];
    expect(grounds[0]).toMatchObject({
      supporting_document_units: ["E.3.4.3"],
      passage_authority_level: "current_court",
      passage_origin: "current_court_original_reasoning",
    });
    expect(grounds[1]).toMatchObject({
      supporting_document_units: ["E.4.3"],
      passage_authority_level: "current_court",
      passage_origin: "current_court_adopted_reasoning",
    });
    expect(grounds.every((ground) => ground.passage_origin !== "lower_authority_reasoning")).toBe(
      true,
    );
  });

  it("never labels current-court reasoning as lower_authority_reasoning even when the heuristic section extractor aliases lower_authority_reasoning to the reasoning text", async () => {
    // This reproduces the real bger.ch heuristic-extraction path (continuous prose, no
    // [section] markers), where extractJudgmentSectionsHeuristically aliases
    // sections["lower_authority_reasoning"] to the full "reasoning" text whenever that text
    // mentions "Vorinstanz" anywhere (as real Federal Supreme Court reasoning almost always
    // does). A passage that is independently classified as the current court's own original or
    // adopted reasoning must never surface under that alias.
    const filler = Array.from(
      { length: 24 },
      (_, index) =>
        `Absatz ${index + 1}: Das Bundesgericht prüft Akten, Steuerpflicht, Vorsteuerabzug, Beschwerdebegründung und die angefochtene Verfügung.`,
    ).join(" ");
    const prose = [
      "Bundesgericht 2A.348/2004 Urteil vom 1. Dezember 2004",
      `Sachverhalt: Die Beschwerdeführerin verlangt weiteren Vorsteuerabzug gegen die Verfügung der Vorinstanz. ${filler}`,
      "Das Bundesgericht zieht in Erwägung:",
      "3.4.3 Erforderlich ist, dass die von der Stiftung bezogenen Eingangsumsätze tatsächlich, sei es unmittelbar oder mittelbar für Ausgangsumsätze, d.h. für steuerbare Lieferungen oder Dienstleistungen verwendet werden. Mit Ausnahme der fakturierten Forschungskosten konnte dieser Nachweis für weitere Ausgangsumsätze nicht erbracht werden. Eine Verletzung von Bundesrecht liegt nicht vor. Die Beschwerde ist schon aus diesem Grund abzuweisen. 4.2 Kein Vorsteuerabzug ist demnach für Leistungen möglich, die unentgeltlich erfolgen, weil es in solchen Fällen an der Steuerbarkeit des Umsatzes fehlt. 4.3 Mit Ausnahme der zuvor erwähnten fakturierten Forschungsleistungen erbringt die Beschwerdeführerin keinen Beweis dafür, dass sie in der geprüften Steuerperiode weitere Leistungen gegen Entgelt deklariert oder in Rechnung gestellt hat. Die Vorinstanz stellt demnach in ihrem Entscheid zu Recht fest, dass mit Ausnahme der fakturierten Forschungsleistungen keine entgeltlichen Ausgangsumsätze vorliegen und die Beschwerde auch mangels Entgeltlichkeit abzuweisen sei.",
      "Demnach erkennt das Bundesgericht: Die Verwaltungsgerichtsbeschwerde wird abgewiesen. Die Gerichtskosten werden der Beschwerdeführerin auferlegt.",
    ].join("\n\n");
    setOfficialSwissCaseHttpTransportForTests(async (url) => {
      if (url.includes("type=search") || url.includes("type=simple_query")) {
        return liveResponse(url, bgerSearchHtml("2A.348/2004", "01-12-2004"));
      }
      return liveResponse(
        url,
        `<a name="page1"></a><html><body>${prose}</body></html>`,
        "text/html;charset=utf-8",
      );
    });

    const resolved = await resolveOfficialSwissCase({
      case_reference: "2A.348/2004",
      require_official_source: true,
      require_full_text: true,
      retrieval_mode: "refresh",
    });

    // Confirms the fixture genuinely reproduces the aliasing condition: the heuristic extractor
    // copied the reasoning text into sections["lower_authority_reasoning"] verbatim.
    expect(resolved.fetch?.sections["lower_authority_reasoning"]).toBe(
      resolved.fetch?.sections["reasoning"],
    );

    const grounds = resolved.legal_use.ratio_analysis?.independent_ground_details ?? [];
    expect(grounds).toHaveLength(2);
    expect(grounds[0]).toMatchObject({
      supporting_sections: ["reasoning"],
      supporting_document_units: ["E.3.4.3"],
      passage_authority_level: "current_court",
      passage_origin: "current_court_original_reasoning",
    });
    expect(grounds[1]).toMatchObject({
      supporting_sections: ["reasoning"],
      supporting_document_units: ["E.4.3"],
      passage_authority_level: "current_court",
      passage_origin: "current_court_adopted_reasoning",
    });
    for (const ground of grounds) {
      expect(ground.supporting_sections).not.toContain("lower_authority_reasoning");
    }
  });

  it("validates a current-court positive autonomous grounds case and blocks omitted grounds offline", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) => {
      if (url.includes("type=search") || url.includes("type=simple_query")) {
        return liveResponse(url, bgerSearchHtml("2A.348/2004", "01-12-2004"));
      }
      return liveResponse(url, `<a name="page1"></a>${case2a348Content()}`);
    });

    const resolved = await resolveOfficialSwissCase({
      case_reference: "2A.348/2004",
      require_official_source: true,
      require_full_text: true,
      retrieval_mode: "refresh",
    });
    const ratio = resolved.legal_use.ratio_analysis;
    const verifiedGrounds =
      ratio?.independent_ground_details.filter(
        (ground) =>
          ground.autonomous &&
          ground.autonomous_ground_status === "verified" &&
          ground.independently_sufficient,
      ) ?? [];

    expect(resolved.legal_use.ratio_status).toBe("ratio_confirmed");
    expect(verifiedGrounds).toHaveLength(2);
    expect(verifiedGrounds[0]).toMatchObject({
      source_decision_level: "current_court",
      belongs_to_current_decision: true,
      applied_by_current_court: true,
      linked_to_current_dispositive: true,
      independently_sufficient_for_current_dispositive: true,
      supporting_document_units: ["E.3.4.3"],
    });
    expect(verifiedGrounds.map((ground) => ground.summary).join(" ")).toContain(
      "schon aus diesem Grund abzuweisen",
    );
    expect(verifiedGrounds.map((ground) => ground.summary).join(" ")).toContain(
      "auch mangels Entgeltlichkeit abzuweisen",
    );

    const completeCoverage = validateSwissCaseGroundCoverage({
      document_id: resolved.document_id!,
      included_ground_ids: verifiedGrounds.map((ground) => ground.ground_id),
      excluded_ground_ids: [],
      validation_mode: "coverage",
    });
    expect(completeCoverage).toMatchObject({
      validation_status: "complete",
      total_verified_ground_count: 2,
      reviewed_ground_count: 2,
      ratio_status: "ratio_confirmed",
      comparability_eligibility: "eligible",
      drafting_eligibility: "eligible",
      strategy_eligibility: "eligible",
      citation_eligibility: "eligible",
      no_network_request: true,
      persistence_verified: true,
    });
    expect(completeCoverage.source_analysis_hash).toMatch(/^[a-f0-9]{64}$/);

    const omittedCoverage = validateSwissCaseGroundCoverage({
      document_id: resolved.document_id!,
      included_ground_ids: [verifiedGrounds[1]!.ground_id],
      excluded_ground_ids: [verifiedGrounds[0]!.ground_id],
      validation_mode: "coverage",
    });
    expect(omittedCoverage).toMatchObject({
      validation_status: "blocked",
      total_verified_ground_count: 2,
      reviewed_ground_count: 1,
      ratio_status: "ratio_not_confirmed",
      blockers: ["autonomous_ground_not_reviewed"],
      comparability_eligibility: "blocked",
      drafting_eligibility: "blocked",
      strategy_eligibility: "blocked",
      citation_eligibility: "blocked",
      no_network_request: true,
    });
    expect(omittedCoverage.omitted_ground_ids).toEqual([verifiedGrounds[0]!.ground_id]);
  });

  it("does not block coverage for excluded lower-instance grounds that were rejected", async () => {
    const neutralFiller = Array.from(
      { length: 30 },
      (_, index) =>
        `Absatz ${index + 1}: Das Gericht prüft Akten, Vorbringen, Verfahrensstand, Zuständigkeit und die formellen Voraussetzungen der Beschwerde.`,
    ).join(" ");
    setOfficialSwissCaseHttpTransportForTests(async (url) => {
      if (url.includes("type=search") || url.includes("type=simple_query")) {
        return liveResponse(url, bgerSearchHtml("1B_62/2021", "10-02-2021"));
      }
      return liveResponse(
        url,
        `<a name="page1"></a>${[
          "[header] 1B_62/2021 swiss_federal_supreme_court Bundesgericht 10. Februar 2021",
          `[facts] Sachverhalt mit Haftbeschwerde und Vorinstanz. ${neutralFiller}`,
          "[procedural_history] Verfahren vor dem Appellationsgericht.",
          "[party_arguments] Der Beschwerdeführer ficht einen Haftgrund an.",
          "[lower_authority_reasoning] Die Vorinstanz würdigte die Haftvoraussetzungen.",
          "[reasoning] Das Appellationsgericht hat im angefochtenen Entscheid sowohl Flucht- als auch Kollusionsgefahr bejaht. Er ficht damit nur eine der beiden selbständigen Begründungen an, weshalb auf die Beschwerde nicht einzutreten ist.",
          "[final_reasoning] Da nur eine der beiden selbständigen Begründungen angefochten wurde, ist auf die Beschwerde nicht einzutreten.",
          "[dispositive] Auf die Beschwerde wird nicht eingetreten.",
          "[costs] Die Gerichtskosten werden auferlegt.",
        ].join("\n")}`,
      );
    });

    const resolved = await resolveOfficialSwissCase({
      case_reference: "1B_62/2021",
      retrieval_mode: "refresh",
    });
    expect(
      resolved.legal_use.ratio_analysis?.independent_ground_details.some(
        (ground) => ground.autonomous_ground_status === "verified",
      ),
    ).toBe(false);
    const coverage = validateSwissCaseGroundCoverage({
      document_id: resolved.document_id!,
      included_ground_ids: [],
      excluded_ground_ids: ["lower_instance_ground_not_verified"],
    });
    expect(coverage).toMatchObject({
      validation_status: "complete",
      total_verified_ground_count: 0,
      reviewed_ground_count: 0,
      ratio_status: "ratio_confirmed",
      no_network_request: true,
    });
    expect(coverage.blockers).toEqual([]);
  });

  it("rejects 4A_664/2024-style procedural doctrine as autonomous grounds", async () => {
    const content = [
      "[header] 4A_664/2024 swiss_federal_supreme_court Bundesgericht 30. Juni 2025",
      "[facts] Sachverhalt mit Beschwerde und Vorinstanz.",
      "[procedural_history] Verfahren vor der Vorinstanz.",
      "[party_arguments] Rechtsbegehren der beschwerdefuehrenden Partei.",
      "[lower_authority_reasoning] Die Vorinstanz hielt mehrere Punkte fest.",
      "[reasoning] Soweit ein Entscheid auf mehreren selbständigen Begründungen beruht, muss die beschwerdeführende Partei darlegen, dass jede von ihnen Recht verletzt. Diese allgemeine Anforderung betrifft die Begründung der Beschwerde und wendet noch keinen eigenständigen materiellen Grund auf den konkreten Ausgang an.",
      "[final_reasoning] Die Beschwerde genügt den Begründungsanforderungen nicht.",
      "[dispositive] Auf die Beschwerde wird nicht eingetreten.",
      "[costs] Die Gerichtskosten werden auferlegt.",
    ].join("\n");
    setOfficialSwissCaseHttpTransportForTests(async (url) => {
      if (url.includes("type=search") || url.includes("type=simple_query")) {
        return liveResponse(url, bgerSearchHtml("4A_664/2024"));
      }
      return liveResponse(url, content, "text/html;charset=utf-8");
    });
    const result = await resolveOfficialSwissCase({
      case_reference: "4A_664/2024",
      require_official_source: true,
      require_full_text: true,
      retrieval_mode: "refresh",
    });
    expect(result.completeness?.independent_grounds_count).toBe(0);
    expect(result.completeness?.independent_grounds_read).toBe(0);
    expect(result.legal_use.ratio_analysis?.independent_grounds_count).toBe(0);
    expect(result.legal_use.ratio_analysis?.independent_ground_details).toContainEqual(
      expect.objectContaining({
        doctrine_only: true,
        applied_to_case: false,
        independently_sufficient: false,
        autonomous: false,
        autonomous_ground_status: "rejected_doctrine_only",
      }),
    );
  });

  it("does not expose candidate_selected for AR references when the exact document is not found", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(
        url,
        JSON.stringify({ totalNumberOfDocuments: 0, documents: [] }),
        "application/json",
      ),
    );

    const result = await resolveOfficialSwissCase({
      case_reference: "O4V 23 10",
      court_hint: "ar",
      canton_hint: "AR",
      require_official_source: true,
      require_full_text: true,
      strict_identity_match: true,
      retrieval_mode: "refresh",
    });

    expect(result.discovery_status).toBe("no_candidate");
    expect(result.document_availability_status).toBe("document_not_found");
    expect(result.fetchability_status).toBe("not_fetchable");
    expect(result.selected_candidate_status).toBe("no_candidate_selected");
    expect(result.selected_candidate_id).toBeNull();
    expect(result.identity.status).toBe("identity_not_verifiable");
    expect(result.fetch?.warnings).toContain("candidate_not_found");
  });

  it("returns candidate_ambiguous with preserved rejected candidates for incomplete references", async () => {
    const result = await resolveOfficialSwissCase({
      case_reference: "6B_1034",
      require_official_source: true,
      require_full_text: true,
      retrieval_mode: "refresh",
    });

    expect(result.discovery_status).toBe("candidate_ambiguous");
    expect(result.ambiguity_status).toBe("ambiguous");
    expect(result.selection_blockers).toContain("required_user_disambiguation");
    expect(result.candidate_count).toBeGreaterThan(1);
    expect(result.selected_candidate_id).toBeNull();
    expect(result.fetch).toBeNull();
    expect(result.rejected_candidates.length).toBe(result.candidates.length);
    expect(result.identity).toMatchObject({
      status: "identity_ambiguous",
      circular_verification_detected: false,
    });
  });

  it("selects a canonical candidate for exact binary duplicates", async () => {
    const result = await resolveOfficialSwissCase({
      case_reference: "9C_999/2026",
      court_hint: "duplicate_binary_test",
      require_official_source: true,
      retrieval_mode: "metadata_only",
    });

    expect(result.discovery_status).toBe("candidate_selected");
    expect(result.selection_blockers).toContain("technical_duplicate_canonical_selected");
    expect(result.candidates.filter((item) => item.duplicate_group_id !== null)).toHaveLength(2);
    expect(result.candidates[0]?.duplicate_classification).toBe("exact_binary_duplicate");
    expect(
      result.rejected_candidates.some((item) =>
        item.rejection_reasons.includes("technical_duplicate"),
      ),
    ).toBe(true);
  });

  it("selects a canonical candidate for the same text in a different wrapper", async () => {
    const result = await resolveOfficialSwissCase({
      case_reference: "9C_999/2026",
      court_hint: "duplicate_wrapper_test",
      require_official_source: true,
      retrieval_mode: "metadata_only",
    });

    expect(result.discovery_status).toBe("candidate_selected");
    expect(result.candidates[0]?.duplicate_classification).toBe("same_text_different_wrapper");
    expect(result.candidates[0]?.canonical_candidate_id).toBe(result.selected_candidate_id);
    expect(
      result.rejected_candidates.some((item) =>
        item.duplicate_reason?.includes("technical_duplicate_of"),
      ),
    ).toBe(true);
  });

  it("persists ambiguous candidates and rejected candidates for audit after restart", async () => {
    const result = await resolveOfficialSwissCase({
      case_reference: "6B_1034",
      require_official_source: true,
      require_full_text: true,
      retrieval_mode: "refresh",
    });
    const storeFile = resolveOfficialCaseStorePath().file;
    const store = JSON.parse(fs.readFileSync(storeFile, "utf8")) as OfficialCaseStoreFixture;
    const stored = store.resolutions[result.resolution_id];

    expect(stored.candidates).toHaveLength(result.candidates.length);
    expect(stored.rejected_candidates).toHaveLength(result.rejected_candidates.length);
    expect(stored.selected_candidate_id).toBeNull();
    expect(stored.ambiguity_status).toBe("ambiguous");
    expect(stored.selection_blockers).toContain("required_user_disambiguation");
    expect(Object.keys(store.candidates)).toEqual(
      expect.arrayContaining(result.candidates.map((candidate) => candidate.candidate_id)),
    );
  });

  it("recovers ambiguous resolutions by resolution_id without HTTP and keeps fetch blocked", async () => {
    const resolved = await resolveOfficialSwissCase({
      case_reference: "6B_1034",
      require_official_source: true,
      require_full_text: true,
      retrieval_mode: "refresh",
    });
    const fingerprints = resolved.candidate_fingerprints;
    let httpCalls = 0;
    setOfficialSwissCaseHttpTransportForTests(async (url) => {
      httpCalls += 1;
      return liveResponse(url, "unexpected");
    });

    const recovered = await resolveOfficialSwissCase({
      resolution_id: resolved.resolution_id,
      retrieval_mode: "refresh",
    });
    const fetch = await fetchOfficialSwissCaseFullTextByIdentifier({
      resolution_id: resolved.resolution_id,
    });

    expect(httpCalls).toBe(0);
    expect(recovered.discovery_status).toBe("candidate_ambiguous");
    expect(recovered.selected_candidate_id).toBeNull();
    expect(recovered.fetch).toBeNull();
    expect(recovered.candidate_count).toBe(resolved.candidate_count);
    expect(recovered.candidate_fingerprints).toEqual(fingerprints);
    expect(recovered.selection_blockers).toEqual(resolved.selection_blockers);
    expect(recovered.required_user_disambiguation).toBe(true);
    expect(recovered.created_at).toBeTruthy();
    expect(recovered.updated_at).toBeTruthy();
    expect(fetch.fetch_status).toBe("fetch_failed");
    expect(fetch.warnings).toContain("resolution_has_no_selected_candidate");
  });
});

describe("official Swiss case source comparison, cache and legal use", () => {
  it("keeps complete aggregator text unofficial", async () => {
    const fetch = await fetchOfficialSwissCaseFullText({
      candidate: candidate({
        official: false,
        source_url: "https://entscheidsuche.ch/case/9C",
        canonical_url: "https://entscheidsuche.ch/case/9C",
      }),
    });
    expect(verifyCompleteness(fetch).completeness_status).toBe("complete");
  });

  it("detects headnote only material", async () => {
    const fetch = await fetchOfficialSwissCaseFullText({
      candidate: candidate({
        official: false,
        source_url: "https://entscheidsuche.ch/case/9C",
        content: "[header] 9C_999/2026\n[headnote] Editorial summary.",
        content_kind: "headnote",
      }),
    });
    expect(verifyCompleteness(fetch).missing_sections).toContain("dispositive");
  });

  it("detects aggregator without dispositive", () => {
    const comparison = compareSwissCaseSources({
      official: candidate(),
      secondary: [
        candidate({
          official: false,
          source_url: "https://entscheidsuche.ch/case/9C",
          content: completeContent().replace(/\[dispositive\][^[]+/, ""),
        }),
      ],
    });
    expect(comparison.source_mismatch).toEqual(
      expect.arrayContaining(["secondary_source_incomplete", "full_text_source_mismatch"]),
    );
  });

  it("uses null comparison metrics when no secondary source exists", () => {
    const comparison = compareSwissCaseSources({
      official: candidate(),
      secondary: [],
    });

    expect(comparison.comparison_status).toBe("insufficient_sources");
    expect(comparison.source_mismatch).toEqual(["secondary_source_missing"]);
    expect(comparison.identity_match).toBeNull();
    expect(comparison.text_match_score).toBeNull();
    expect(comparison.structural_match_score).toBeNull();
    expect(comparison.comparison_confidence).toBeNull();
  });

  it("compares matching sources", () => {
    const comparison = compareSwissCaseSources({
      official: candidate(),
      secondary: [
        candidate({
          official: false,
          source_url: "https://entscheidsuche.ch/case/9C",
          content: completeContent(),
        }),
      ],
    });
    expect(comparison.identity_match).toBe(true);
    expect(comparison.structural_match_score).toBe(1);
  });

  it("detects editorial additions", () => {
    const comparison = compareSwissCaseSources({
      official: candidate(),
      secondary: [
        candidate({
          official: false,
          source_url: "https://entscheidsuche.ch/case/9C",
          content: `${completeContent()}\n[editorial] Redaktionelle Notiz.`,
        }),
      ],
    });
    expect(comparison.additional_in_secondary).toContain("editorial");
    expect(comparison.editorial_additions).toContain("https://entscheidsuche.ch/case/9C");
  });

  it("invalidates cache on explicit refresh", async () => {
    clearOfficialSwissCaseResolverCache();
    expect((await resolveOfficialSwissCase({ case_reference: "9C_999/2026" })).cache_status).toBe(
      "cache_miss",
    );
    expect(
      (
        await resolveOfficialSwissCase({
          case_reference: "9C_999/2026",
          retrieval_mode: "refresh",
        })
      ).cache_status,
    ).toBe("cache_invalidated");
  });

  it("returns valid cache hits", async () => {
    clearOfficialSwissCaseResolverCache();
    await resolveOfficialSwissCase({ case_reference: "9C_999/2026" });
    expect((await resolveOfficialSwissCase({ case_reference: "9C_999/2026" })).cache_status).toBe(
      "cache_hit_valid",
    );
  });

  it("reports official source not found", async () => {
    const result = await resolveOfficialSwissCase({
      case_reference: "not-a-case",
      require_official_source: true,
    });
    expect(result.discovery_status).toBe("no_candidate");
    expect(result.warnings).toContain("official_source_not_found");
  });

  it("allows unofficial fallback without official promotion", async () => {
    const result = await resolveOfficialSwissCase({
      case_reference: "not-a-case",
      allow_unofficial_fallback: true,
      require_official_source: false,
    });
    expect(result.selected_candidate?.official).toBe(false);
    expect(result.legal_use.source_status).toBe("unofficial");
  });

  it("prohibits fallback when official source is required", async () => {
    const result = await resolveOfficialSwissCase({
      case_reference: "not-a-case",
      allow_unofficial_fallback: true,
      require_official_source: true,
    });
    expect(result.selected_candidate).toBeNull();
    expect(result.legal_use.official_verification_status).toBe("official_source_not_found");
  });

  it("blocks ratio for unofficial fallback", async () => {
    const result = await resolveOfficialSwissCase({
      case_reference: "not-a-case",
      allow_unofficial_fallback: true,
      require_official_source: false,
    });
    expect(result.legal_use.ratio_status).toBe("ratio_not_confirmed");
  });

  it("blocks comparability for incomplete or unofficial text", async () => {
    const result = await resolveOfficialSwissCase({
      case_reference: "not-a-case",
      allow_unofficial_fallback: true,
      require_official_source: false,
    });
    expect(result.legal_use.comparability_eligibility).toBe("blocked");
  });

  it("unblocks drafting and strategy after official complete reading", async () => {
    const result = await resolveOfficialSwissCase({ case_reference: "9C_999/2026" });
    expect(result.legal_use.reading_status).toBe("full_text_verified_official");
    expect(result.legal_use.drafting_eligibility).toBe("eligible");
    expect(result.legal_use.strategy_eligibility).toBe("eligible");
    expect(result.legal_use.ratio_analysis?.ratio_summary).toBeTruthy();
    expect(result.legal_use.ratio_analysis?.main_ground).toBeTruthy();
    expect(result.legal_use.ratio_analysis?.ratio_evidence.length).toBeGreaterThan(0);
    expect(result.legal_use.ratio_analysis?.no_independent_alternative_grounds_detected).toBe(
      false,
    );
  });

  it("requires all independent grounds before ratio confirmation", async () => {
    const { completeness } = await fetchAndCompleteness(
      candidate({
        content: completeContent().replace("autonomous ground reviewed", "autonomous ground"),
      }),
    );
    expect(completeness.extraction_errors).toContain("missing_independent_ground_review");
  });

  it("tracks separate opinions", async () => {
    const { completeness } = await fetchAndCompleteness(
      candidate({ content: `${completeContent()}\n[separate_opinion] Separate opinion read.` }),
    );
    expect(completeness.separate_opinions_present).toBe(true);
    expect(completeness.separate_opinions_read).toBe(true);
  });

  it("runs the official-vs-aggregator end-to-end success scenario", async () => {
    const result = await resolveOfficialSwissCase({
      case_reference: "9C_999/2026",
      allow_unofficial_fallback: true,
      require_official_source: true,
      require_full_text: true,
    });
    expect(result.discovery_status).toBe("candidate_selected");
    expect(result.identity.status).toBe("identity_verified");
    expect(result.legal_use).toMatchObject({
      source_status: "official",
      fetch_status: "fetch_success",
      completeness_status: "complete",
      reading_status: "full_text_verified_official",
      official_verification_status: "full_text_verified_official",
      ratio_status: "ratio_confirmed",
      comparability_eligibility: "eligible",
      drafting_eligibility: "eligible",
      strategy_eligibility: "eligible",
    });
    expect(result.comparison?.authoritative_source_selected).toBe(
      result.selected_candidate?.source_url,
    );
  });

  it("persists reusable identifiers across standalone resolve, fetch and verify calls", async () => {
    const resolved = await resolveOfficialSwissCase({ case_reference: "9C_999/2026" });
    expect(resolved.resolution_id).toBeTruthy();
    expect(resolved.selected_candidate?.candidate_id).toBeTruthy();
    expect(resolved.selected_candidate?.decision_date).toBe("2026-01-15");
    expect(resolved.selected_candidate?.decision_date_status).toBe("verified_from_live_document");
    expect(resolved.document_id).toBeTruthy();
    expect(resolved.normalized_reference).toBe("9C_999/2026");
    expect(resolved.document_hash).toBeTruthy();
    expect(resolved.metadata_hash).toBeTruthy();

    const byResolution = await fetchOfficialSwissCaseFullTextByIdentifier({
      resolution_id: resolved.resolution_id,
    });
    expect(byResolution.cache_status).toBe("cache_hit_valid");
    expect(byResolution.document_id).toBe(resolved.document_id);
    expect(byResolution.live_metadata?.decision_date).toBe("2026-01-15");

    const byCandidate = await fetchOfficialSwissCaseFullTextByIdentifier({
      candidate_id: resolved.selected_candidate!.candidate_id,
    });
    expect(byCandidate.document_hash).toBe(resolved.document_hash);

    const byDocument = await fetchOfficialSwissCaseFullTextByIdentifier({
      document_id: resolved.document_id!,
    });
    expect(byDocument.cache_status).toBe("cache_hit_valid");
    expect(byDocument.reading_status).toBe("full_text_verified_official");

    const byCanonicalUrl = await fetchOfficialSwissCaseFullTextByIdentifier({
      canonical_url: resolved.canonical_url!,
    });
    expect(byCanonicalUrl.document_hash).toBe(resolved.document_hash);

    const byReference = await fetchOfficialSwissCaseFullTextByIdentifier({
      normalized_reference: "9C_999/2026",
    });
    expect(byReference.document_id).toBe(resolved.document_id);

    const identity = await verifySwissCaseIdentityByIdentifier({
      document_id: resolved.document_id!,
      requested_reference: "9C_999/2026",
    });
    expect(identity.circular_verification_detected).toBe(false);
    expect(identity.independent_evidence_count).toBeGreaterThanOrEqual(2);
    expect(identity.status).toBe("identity_verified");
  });

  it("keeps anti-circularity when identity verification only has a reference", async () => {
    const identity = await verifySwissCaseIdentityByIdentifier({
      requested_reference: "9C_999/2026",
    });
    expect(identity.circular_verification_detected).toBe(true);
    expect(identity.status).toBe("identity_mismatch");
  });

  it("compares persisted official and secondary documents by document IDs", async () => {
    const resolved = await resolveOfficialSwissCase({ case_reference: "9C_999/2026" });
    const secondary = await fetchOfficialSwissCaseFullText({
      candidate: {
        ...candidate({ content: completeContent() }),
        candidate_id: "secondary-candidate",
        source: "entscheidsuche",
        source_url: "https://entscheidsuche.ch/case/9C_999%2F2026",
        canonical_url: "https://entscheidsuche.ch/case/9C_999%2F2026",
        official: false,
        source_adapter: "entscheidsuche_fallback",
      },
      requireOfficial: false,
    });

    const compared = await compareSwissCaseSourcesByIdentifier({
      official_document_id: resolved.document_id!,
      secondary_document_id: secondary.document_id!,
      case_reference: "9C_999/2026",
    });
    expect(compared.comparison_status).toBe("compared");
    expect(compared.official_document_id).toBe(resolved.document_id);
    expect(compared.secondary_document_ids).toContain(secondary.document_id);
    expect(compared.sources_compared).toBe(2);
  });

  it("distinguishes missing secondary source from missing official source", async () => {
    const resolved = await resolveOfficialSwissCase({ case_reference: "9C_999/2026" });
    const compared = await compareSwissCaseSourcesByIdentifier({
      official_document_id: resolved.document_id!,
      case_reference: "9C_999/2026",
    });
    expect(compared.comparison_status).toBe("insufficient_sources");
    expect(compared.source_mismatch).toContain("secondary_source_missing");
    expect(compared.source_mismatch).not.toContain("official_source_not_found");
  });

  it("reports invalid and stale identifiers precisely", async () => {
    const missingFetch = await fetchOfficialSwissCaseFullTextByIdentifier({
      document_id: "doc_missing",
    });
    expect(missingFetch.warnings).toContain("stale_identifier");

    const compared = await compareSwissCaseSourcesByIdentifier({
      official_document_id: "doc_missing",
      case_reference: "9C_999/2026",
    });
    expect(compared.source_mismatch).toContain("official_source_not_found");
    expect(compared.source_mismatch).not.toContain("secondary_source_missing");
  });

  it("requires all autonomous grounds before ratio confirmation", async () => {
    const unresolved = await fetchOfficialSwissCaseFullText({
      candidate: candidate({
        content: completeContent().replace("autonomous ground reviewed", "autonomous ground"),
      }),
    });
    expect(unresolved.warnings).toContain("missing_independent_ground_review");
    expect(verifyCompleteness(unresolved).completeness_status).not.toBe("complete");

    const resolved = await resolveOfficialSwissCase({ case_reference: "9C_999/2026" });
    expect(resolved.legal_use.ratio_analysis?.independent_grounds_count).toBeGreaterThanOrEqual(2);
    expect(resolved.legal_use.ratio_analysis?.independent_grounds_reviewed).toBeGreaterThanOrEqual(
      2,
    );
    expect(resolved.legal_use.ratio_status).toBe("ratio_confirmed");
  });

  it("runs the end-to-end blocked missing-dispositive variant", async () => {
    const fetch = await fetchOfficialSwissCaseFullText({
      candidate: candidate({ content: completeContent().replace(/\[dispositive\][^[]+/, "") }),
    });
    const completeness = verifyCompleteness(fetch);
    expect(completeness.completeness_status).toBe("missing_dispositive");
    expect(completeness.dispositive_present).toBe(false);
  });
});

describe("official Swiss case MCP tools", () => {
  it("registers the official Swiss case MCP tools", async () => {
    const client = await buildClient();
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "resolve_official_swiss_case",
        "fetch_official_swiss_case_full_text",
        "verify_swiss_case_identity",
        "compare_swiss_case_sources",
        "validate_swiss_case_ground_coverage",
      ]),
    );
  });

  it("integrates with verify_legal_citation through citation eligibility", async () => {
    const client = await buildClient();
    const result = await client.callTool({
      name: "resolve_official_swiss_case",
      arguments: { case_reference: "9C_999/2026" },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent?.legal_use).toMatchObject({
      citation_eligibility: "eligible",
    });
  });

  it("integrates with procedural strategy by blocking incomplete readings", async () => {
    const result = await resolveOfficialSwissCase({
      case_reference: "not-a-case",
      allow_unofficial_fallback: true,
      require_official_source: false,
    });
    expect(result.legal_use.strategy_eligibility).toBe("blocked");
  });

  it("integrates with drafting eligibility", async () => {
    expect(
      (await resolveOfficialSwissCase({ case_reference: "9C_999/2026" })).legal_use,
    ).toMatchObject({
      drafting_eligibility: "eligible",
    });
  });

  it("integrates with multirole analysis through shared legal-use states", async () => {
    const result = await resolveOfficialSwissCase({
      case_reference: "not-a-case",
      allow_unofficial_fallback: true,
      require_official_source: false,
    });
    expect(result.legal_use.comparability_eligibility).toBe("blocked");
    expect(result.legal_use.drafting_eligibility).toBe("blocked");
  });

  it("returns clean presentation while retaining audit fields", async () => {
    const result = await resolveOfficialSwissCase({
      case_reference: "9C_999/2026",
      presentation_mode: "clean",
    });
    expect(result.presentation.summary).toBe("La sentencia oficial fue localizada y verificada.");
    expect(result.presentation.technical_visible).toBe(false);
    expect(result.attempts.length).toBeGreaterThan(0);
  });

  it("uses persisted identifiers across MCP tool calls", async () => {
    const client = await buildClient();
    const resolved = await client.callTool({
      name: "resolve_official_swiss_case",
      arguments: { case_reference: "9C_999/2026" },
    });
    const structured = resolved.structuredContent as {
      resolution_id: string;
      document_id: string;
    };

    const fetched = await client.callTool({
      name: "fetch_official_swiss_case_full_text",
      arguments: { resolution_id: structured.resolution_id },
    });
    expect(fetched.structuredContent).toMatchObject({
      cache_status: "cache_hit_valid",
      document_id: structured.document_id,
    });

    const verified = await client.callTool({
      name: "verify_swiss_case_identity",
      arguments: { document_id: structured.document_id, requested_reference: "9C_999/2026" },
    });
    expect(verified.structuredContent).toMatchObject({
      status: "identity_verified",
      circular_verification_detected: false,
    });

    const compared = await client.callTool({
      name: "compare_swiss_case_sources",
      arguments: { case_reference: "9C_999/2026", official_document_id: structured.document_id },
    });
    expect(compared.structuredContent).toMatchObject({
      comparison_status: "insufficient_sources",
    });
  });
});

// ---------------------------------------------------------------------------
// Fase 4 (2026-08-07): fixtures y aserciones para los escenarios A-G del plan
// de correccion del cuello de botella "completeness/multilingual". Cada
// fixture usa contenido plano (no bracket-tagged) para ejercer de verdad el
// extractor heuristico multilingue (`extractJudgmentSectionsHeuristically`),
// no el atajo `[section]` que usan la mayoria de fixtures existentes.
// ---------------------------------------------------------------------------

function bgerItalianDocumentHtml(reference = "6B_555/2023") {
  const longReasoning = Array.from(
    { length: 30 },
    (_, index) =>
      `Considerando ${index + 1}: il Tribunale federale esamina gli atti, la decisione impugnata dall'autorità inferiore e le conclusioni delle parti; the independent ground reviewed and the autonomous ground reviewed for the outcome.`,
  ).join(" ");
  return [
    "<html><body>",
    "Tribunale federale",
    `Sentenza del 12 marzo 2023 Causa n. ${reference}`,
    "Istanze: Il ricorrente chiede l'annullamento della decisione impugnata; il Ministero pubblico chiede il rigetto del ricorso.",
    "Fatti: Il ricorrente propone ricorso contro la decisione dell'autorità inferiore; il Ministero pubblico deposita le sue conclusioni davanti alla Corte cantonale.",
    "Considerando in diritto:",
    `${longReasoning} ${longReasoning}`,
    "Per questi motivi, il Tribunale federale pronuncia:",
    "1. Il ricorso è respinto. Le spese giudiziarie sono poste a carico del ricorrente.",
    "</body></html>",
  ].join("\n");
}

/** Documento aleman real (misma estructura que un caso corriente) sin NINGUN
 * vocabulario de dispositivo en ningun idioma -- construido para el escenario
 * F (seccion GENUINAMENTE ausente, no solo no detectada). */
function germanDocumentMissingDispositiveHtml(reference = "9C_777/2024") {
  const longReasoning = Array.from(
    { length: 30 },
    (_, index) =>
      `Absatz ${index + 1}: Das Bundesgericht prüft die Akten, die angefochtene Verfügung und die Vorbringen der Parteien; an independent ground reviewed and an autonomous ground reviewed are addressed.`,
  ).join(" ");
  return [
    "<html><body>",
    `Bundesgericht ${reference}`,
    "Urteil vom 3. April 2024",
    "Rechtsbegehren: Der Beschwerdeführer beantragt die Aufhebung der Verfügung.",
    "Sachverhalt: Der Beschwerdeführer ficht die Verfügung der Vorinstanz an und rügt eine Rechtsverletzung.",
    "Erwägungen:",
    `${longReasoning} ${longReasoning}`,
    // Deliberadamente SIN ninguna formula de dispositivo (ni "Demnach erkennt",
    // ni "Dispositiv", ni Kosten/Gerichtskosten) en ningun idioma: el texto
    // se corta tras los considerandos, como si el documento estuviera
    // genuinamente incompleto (p.ej. descarga truncada por el proveedor).
    "</body></html>",
  ].join("\n");
}

describe("Fase 4: multilingual extraction and completeness gate (scenarios A-G)", () => {
  it("[A] complete DE judgment: all required sections genuinely detected, completeness=complete", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(url, arDocumentHtml(), "text/html;charset=utf-8"),
    );
    const { fetch, completeness } = await fetchAndCompleteness(
      candidate({
        source_url:
          "https://rechtsprechung.ar.ch/download/OG-20200519-O2V-19-21-20200721.pdf?lang=de",
        canonical_url:
          "https://rechtsprechung.ar.ch/download/OG-20200519-O2V-19-21-20200721.pdf?lang=de",
        court_family: "cantonal_court",
        language: "de",
        content: undefined,
      }),
    );
    expect(completeness.completeness_status).toBe("complete");
    expect(completeness.missing_sections).toEqual([]);
    expect(fetch.language_mismatch).not.toBe(true);
    const methods = fetch.section_evidence?.map((entry) => entry.detection_method) ?? [];
    expect(methods.length).toBeGreaterThan(0);
    expect(methods).not.toContain("dom");
  });

  it("[B] complete FR judgment: all required sections genuinely detected, completeness=complete", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(url, bstgerDocumentHtml(), "text/html;charset=utf-8"),
    );
    const { fetch, completeness } = await fetchAndCompleteness(
      candidate({
        source_url: "https://bstger.weblaw.ch/pdf/SK_2023_1.pdf?lang=fr",
        canonical_url: "https://bstger.weblaw.ch/pdf/SK_2023_1.pdf?lang=fr",
        court_family: "federal_criminal_court",
        language: "fr",
        content: undefined,
      }),
    );
    expect(completeness.completeness_status).toBe("complete");
    expect(completeness.missing_sections).toEqual([]);
    expect(fetch.language_mismatch).not.toBe(true);
  });

  it("[C] complete IT judgment: all required sections genuinely detected, completeness=complete", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(url, bgerItalianDocumentHtml(), "text/html;charset=utf-8"),
    );
    const { fetch, completeness } = await fetchAndCompleteness(
      candidate({
        source_url:
          "https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=it&type=show_document&highlight_docid=aza://12-03-2023-6B_555-2023",
        canonical_url:
          "https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=it&type=show_document&highlight_docid=aza://12-03-2023-6B_555-2023",
        language: "it",
        content: undefined,
      }),
    );
    expect(completeness.completeness_status).toBe("complete");
    expect(completeness.missing_sections).toEqual([]);
    expect(fetch.document_language_detected).toBe("it");
  });

  it("[D] requested=de but actual document is French: mismatch flagged but does NOT by itself block completeness", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(`${url}&locale=de`, bstgerDocumentHtml(), "text/html;charset=utf-8"),
    );
    const fetch = await fetchOfficialSwissCaseFullText({
      candidate: candidate({
        source_url: "https://bstger.weblaw.ch/pdf/SK_2023_1.pdf?locale=de",
        canonical_url: "https://bstger.weblaw.ch/pdf/SK_2023_1.pdf?locale=de",
        court_family: "federal_criminal_court",
        language: "de",
        content: undefined,
      }),
    });
    const completeness = verifyCompleteness(fetch);

    expect(fetch.requested_locale).toBe("de");
    expect(fetch.document_language_detected).toBe("fr");
    expect(fetch.language_mismatch).toBe(true);
    // El warning se conserva integramente (nunca se silencia); vive en
    // `extraction_errors` (senal de calidad de metadatos evaluada junto al
    // resto de errores de extraccion), no en `fetch.warnings`:
    expect(completeness.extraction_errors).toContain("document_language_mismatch_unresolved");
    // Pero, dado que las 9 secciones obligatorias SI se detectaron de verdad,
    // el mismatch por si solo NO degrada completeness a algo distinto de
    // "complete" (fix Fase 2/3, ver comentario en verifyCompleteness).
    expect(completeness.missing_sections).toEqual([]);
    expect(completeness.completeness_status).toBe("complete");
  });

  it("[E] requested=de but actual document is Italian: mismatch flagged but does NOT by itself block completeness", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(`${url}&locale=de`, bgerItalianDocumentHtml(), "text/html;charset=utf-8"),
    );
    const fetch = await fetchOfficialSwissCaseFullText({
      candidate: candidate({
        source_url:
          "https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&type=show_document&highlight_docid=aza://12-03-2023-6B_555-2023&locale=de",
        canonical_url:
          "https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&type=show_document&highlight_docid=aza://12-03-2023-6B_555-2023&locale=de",
        language: "de",
        content: undefined,
      }),
    });
    const completeness = verifyCompleteness(fetch);

    expect(fetch.requested_locale).toBe("de");
    expect(fetch.document_language_detected).toBe("it");
    expect(fetch.language_mismatch).toBe(true);
    expect(completeness.extraction_errors).toContain("document_language_mismatch_unresolved");
    expect(completeness.missing_sections).toEqual([]);
    expect(completeness.completeness_status).toBe("complete");
  });

  it("[F] genuinely absent dispositive section degrades completeness (never fabricated, never falsely complete)", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(url, germanDocumentMissingDispositiveHtml(), "text/html;charset=utf-8"),
    );
    const { fetch, completeness } = await fetchAndCompleteness(
      candidate({
        source_url: "https://search.bger.ch/9C_777-2024?lang=de",
        canonical_url: "https://search.bger.ch/9C_777-2024?lang=de",
        language: "de",
        content: undefined,
      }),
    );
    expect(completeness.completeness_status).not.toBe("complete");
    expect(completeness.missing_sections).toContain("dispositive");
    expect(completeness.missing_sections).toContain("costs");
    // No hay ningun vocabulario de dispositivo/costas en el documento: no debe
    // marcarse como sospecha de fallo de extraccion (eso seria fabricar una
    // senal de "seccion probablemente presente" que no existe realmente).
    expect(completeness.extraction_errors).not.toContain(
      "dispositive_marker_present_but_not_extracted",
    );
    expect(completeness.extraction_errors).not.toContain("costs_marker_present_but_not_extracted");
    expect(completeness.extraction_errors).toContain("missing_dispositive");
    expect(fetch.sections["dispositive"]).toBeUndefined();
  });

  it("[G] sections integrated within another section (no independent heading) still count as genuinely detected", async () => {
    // bstgerDocumentHtml() nunca usa un encabezado independiente para
    // party_arguments/procedural_history/lower_authority_reasoning: esas tres
    // secciones se derivan por vocabulario tematico (`text_pattern`) dentro de
    // "facts"/"reasoning" ya localizados -- exactamente la estructura real
    // descrita en el escenario G (alegaciones/procedimiento integrados en
    // Faits/Erwägungen sin encabezado propio).
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(url, bstgerDocumentHtml(), "text/html;charset=utf-8"),
    );
    const { fetch, completeness } = await fetchAndCompleteness(
      candidate({
        source_url: "https://bstger.weblaw.ch/pdf/SK_2023_1.pdf?lang=fr",
        canonical_url: "https://bstger.weblaw.ch/pdf/SK_2023_1.pdf?lang=fr",
        court_family: "federal_criminal_court",
        language: "fr",
        content: undefined,
      }),
    );
    expect(completeness.missing_sections).not.toContain("party_arguments");
    expect(completeness.missing_sections).not.toContain("procedural_history");
    expect(completeness.missing_sections).not.toContain("lower_authority_reasoning");
    expect(completeness.completeness_status).toBe("complete");
    const partyArgsEvidence = fetch.section_evidence?.find(
      (entry) => entry.section_id === "party_arguments",
    );
    const proceduralEvidence = fetch.section_evidence?.find(
      (entry) => entry.section_id === "procedural_history",
    );
    // Detectadas sin encabezado independiente propio: metodo distinto de
    // "heading" (deben ser "text_pattern", nunca "dom" -- no implementado).
    expect(partyArgsEvidence?.detection_method).toBe("text_pattern");
    expect(proceduralEvidence?.detection_method).toBe("text_pattern");
  });
});

// ---------------------------------------------------------------------------
// Hardening sprint regression tests (2026-08-16): D2a / D2b / D2c
//
// D2a: dispositive section detected via heading patterns in the BGE structural
//      branch ("Demnach erkennt das Bundesgericht:") — previously only caught
//      by outcome-formula regex which missed the heading-first format.
// D2b: absent optional archive fields (case_reference, official_docid for both
//      candidate and live document) must NOT penalise identity confidence.
//      Genuine contradictory values must still produce identity_mismatch.
// D2c: BGE citation text in document body activates 5-section completeness
//      path even when publication_mapping_status is not "mapping_verified".
// ---------------------------------------------------------------------------

/** HTML with BGE citation + explicit heading-style dispositive (no outcome formula). */
function bgeHeadingDispositiveHtml(
  heading = "Demnach erkennt das Bundesgericht:",
  language: "de" | "fr" = "de",
) {
  const reasoning = Array.from(
    { length: 20 },
    (_, index) =>
      `Erwägung ${index + 1}: Das Bundesgericht prüft die angefochtene Verfügung; an independent ground reviewed and an autonomous ground reviewed for the outcome.`,
  ).join(" ");
  if (language === "fr") {
    return [
      "<html><body>",
      "ATF 142 I 99",
      "Arrêt du 10 mars 2023 Cause n. 4D_100/2023",
      "Faits: Le recourant dépose un recours contre la décision de l'autorité inférieure.",
      "Extrait des considérants:",
      reasoning,
      heading,
      "1. Le recours est rejeté.",
      "2. Les frais judiciaires sont mis à la charge du recourant.",
      "</body></html>",
    ].join("\n");
  }
  return [
    "<html><body>",
    "BGE 142 I 99",
    "Urteil vom 10. März 2023 Causa n. 4D_100/2023",
    "Sachverhalt: Der Beschwerdeführer erhebt Beschwerde gegen die Verfügung der Vorinstanz.",
    "Aus den Erwägungen:",
    reasoning,
    heading,
    "1. Die Beschwerde wird abgewiesen.",
    "2. Die Gerichtskosten werden dem Beschwerdeführer auferlegt.",
    "</body></html>",
  ].join("\n");
}

/** HTML with BGE citation but NO dispositive heading or outcome formula — genuinely absent. */
function bgeWithoutDispositiveHtml() {
  const reasoning = Array.from(
    { length: 20 },
    (_, index) =>
      `Erwägung ${index + 1}: Das Bundesgericht prüft Akten und Vorbringen; an independent ground reviewed and an autonomous ground reviewed for the outcome.`,
  ).join(" ");
  return [
    "<html><body>",
    "BGE 142 I 77",
    "Urteil vom 3. April 2024 4B_200/2024",
    "Sachverhalt: Die Beschwerdeführerin ficht die Verfügung der Vorinstanz an.",
    "Aus den Erwägungen:",
    reasoning,
    // Deliberately no "Demnach erkennt" / "heisst gut" / "prononce" etc.
    "</body></html>",
  ].join("\n");
}

describe("D2a/D2b/D2c regression tests (hardening sprint)", () => {
  // ---- D2a: heading-style dispositive detection in BGE structural branch ----

  it("[D2a-1] BGE document with 'Demnach erkennt das Bundesgericht:' heading: dispositive detected, completeness=complete", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(
        url,
        bgeHeadingDispositiveHtml("Demnach erkennt das Bundesgericht:"),
        "text/html;charset=utf-8",
      ),
    );
    const { fetch, completeness } = await fetchAndCompleteness(
      candidate({
        source_url:
          "https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&type=show_document&highlight_docid=aza://10-03-2023-4D_100-2023",
        canonical_url:
          "https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&type=show_document&highlight_docid=aza://10-03-2023-4D_100-2023",
        content: undefined,
      }),
    );
    expect(completeness.dispositive_present).toBe(true);
    expect(completeness.completeness_status).toBe("complete");
    const dispEvidence = fetch.section_evidence?.find((e) => e.section_id === "dispositive");
    expect(dispEvidence).toBeDefined();
    // Content is captured by the non-BGE dispositiveMarker heuristic which
    // overwrites and excludes the heading text — the section IS detected.
    expect(fetch.sections["dispositive"]).toBeDefined();
  });

  it("[D2a-2] BGE document with 'Das Bundesgericht erkennt:' heading variant: dispositive detected", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(
        url,
        bgeHeadingDispositiveHtml("Das Bundesgericht erkennt:"),
        "text/html;charset=utf-8",
      ),
    );
    const { completeness } = await fetchAndCompleteness(
      candidate({
        source_url:
          "https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&type=show_document&highlight_docid=aza://10-03-2023-4D_100-2023",
        canonical_url:
          "https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&type=show_document&highlight_docid=aza://10-03-2023-4D_100-2023",
        content: undefined,
      }),
    );
    expect(completeness.dispositive_present).toBe(true);
    expect(completeness.completeness_status).toBe("complete");
  });

  it("[D2a-3] BGE document with French 'Le Tribunal fédéral prononce:' heading: dispositive detected", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(
        url,
        bgeHeadingDispositiveHtml("Le Tribunal fédéral prononce:", "fr"),
        "text/html;charset=utf-8",
      ),
    );
    const { completeness } = await fetchAndCompleteness(
      candidate({
        source_url:
          "https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=fr&type=show_document&highlight_docid=aza://10-03-2023-4D_100-2023",
        canonical_url:
          "https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=fr&type=show_document&highlight_docid=aza://10-03-2023-4D_100-2023",
        language: "fr",
        content: undefined,
      }),
    );
    expect(completeness.dispositive_present).toBe(true);
    expect(completeness.completeness_status).toBe("complete");
  });

  it("[D2a-neg] BGE document genuinely missing dispositive: missing_dispositive, never falsely complete", async () => {
    setOfficialSwissCaseHttpTransportForTests(async (url) =>
      liveResponse(url, bgeWithoutDispositiveHtml(), "text/html;charset=utf-8"),
    );
    const { fetch, completeness } = await fetchAndCompleteness(
      candidate({
        source_url:
          "https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&type=show_document&highlight_docid=aza://03-04-2024-4B_200-2024",
        canonical_url:
          "https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&type=show_document&highlight_docid=aza://03-04-2024-4B_200-2024",
        content: undefined,
      }),
    );
    expect(completeness.dispositive_present).toBe(false);
    expect(completeness.completeness_status).toBe("missing_dispositive");
    expect(fetch.sections["dispositive"]).toBeUndefined();
  });

  // ---- D2b: optional archive fields must not penalise identity confidence ----

  it("[D2b-1] BGE citation with absent case_reference and official_docid: identity_verified (absent != contradictory)", () => {
    // D2b root cause: old code pushed absent optional archive fields to
    // `missing[]`, reducing confidence below 0.82 for published BGE
    // references — incorrectly blocking legitimate identity verifications.
    const normalized = normalizeSwissCaseReference("BGE 142 III 91");
    expect(normalized.citation_family).toBe("published_federal_report");

    const result = verifySwissCaseIdentity({
      normalized,
      candidate: candidate({
        // No case_reference, no official_docid — archives not yet populated
        reference: "4A_327/2015",
        chamber: "III",
        court_family: "swiss_federal_supreme_court",
        decision_date: "2016-02-09",
        published_citation: "BGE 142 III 91",
      }),
      liveDocumentMetadata: {
        // Live document also lacks archive metadata — both absent, neither contradictory
        published_citation: "BGE 142 III 91",
        court_family: "swiss_federal_supreme_court",
        decision_date: "2016-02-09",
      },
    });
    expect(result.status).toBe("identity_verified");
    expect(result.missing_fields).not.toContain("official_case_reference");
    expect(result.missing_fields).not.toContain("official_docid");
    expect(result.missing_fields).not.toContain("live_official_case_reference");
    expect(result.missing_fields).not.toContain("live_official_docid");
  });

  it("[D2b-2] present case_reference adds positive evidence when it matches", () => {
    const normalized = normalizeSwissCaseReference("BGE 142 III 91");
    const result = verifySwissCaseIdentity({
      normalized,
      candidate: candidate({
        reference: "4A_327/2015",
        chamber: "III",
        court_family: "swiss_federal_supreme_court",
        decision_date: "2016-02-09",
        published_citation: "BGE 142 III 91",
        case_reference: "4A_327/2015",
        official_docid: "atf://142-III-91:de",
      }),
      liveDocumentMetadata: {
        published_citation: "BGE 142 III 91",
        court_family: "swiss_federal_supreme_court",
        case_reference: "4A_327/2015",
        official_docid: "atf://142-III-91:de",
      },
    });
    expect(result.status).toBe("identity_verified");
    expect(result.matched_fields).toContain("official_case_reference");
    expect(result.matched_fields).toContain("official_docid");
    expect(result.matched_fields).toContain("live_official_case_reference");
    expect(result.matched_fields).toContain("live_official_docid");
  });

  it("[D2b-3] contradictory case_reference still causes identity_mismatch (missing != contradictory)", () => {
    const normalized = normalizeSwissCaseReference("9C_999/2026");
    const result = verifySwissCaseIdentity({
      normalized,
      candidate: candidate({ reference: "9C_998/2026" }),
      liveDocumentMetadata: {
        reference: "9C_998/2026",
        court_family: "swiss_federal_supreme_court",
      },
    });
    // The reference CONTRADICTS the requested reference: mismatch must be reported.
    expect(result.status).toBe("identity_mismatch");
    expect(result.mismatched_fields).toContain("reference");
  });

  // ---- D2c: BGE citation text activates 5-section completeness path ----

  function minimalFetch(overrides: Partial<FullTextFetchResult> = {}): FullTextFetchResult {
    return {
      fetch_status: "fetch_success",
      source_url: "https://search.bger.ch/test",
      final_url: "https://search.bger.ch/test",
      redirects: [],
      mime_type: "text/html",
      content_length: 1000,
      document_hash: null,
      retrieved_at: "2026-08-16T00:00:00.000Z",
      extractor_version: "test",
      source_version: null,
      text: null,
      sections: {},
      warnings: [],
      mock_or_fixture: true,
      ...overrides,
    };
  }

  it("[D2c-1] document text containing 'BGE 142 I 99' with mapping_unverified: 5-section path, complete with 5 sections", () => {
    // D2c root cause: old code required mapping_verified AND atf:// docid
    // simultaneously. If mapping was unverified but text contained BGE citation
    // (common for bger.ch/aza fetches), publishedBge was false → wrong section
    // requirements applied → spurious "missing_procedural_history" etc.
    const fetch = minimalFetch({
      text: "BGE 142 I 99 Urteil vom 10. März 2023 Sachverhalt: Beschwerdeführer. Aus den Erwägungen: Erwägung. Demnach erkennt das Bundesgericht: Die Beschwerde wird abgewiesen.",
      publication_mapping_status: "mapping_unverified",
      sections: {
        header: "BGE 142 I 99",
        facts: "Sachverhalt: Beschwerdeführer.",
        reasoning: "Aus den Erwägungen: Erwägung.",
        final_reasoning: "Zusammenfassend: abzuweisen.",
        dispositive: "Demnach erkennt das Bundesgericht: Die Beschwerde wird abgewiesen.",
      },
    });
    const completeness = verifyCompleteness(fetch);
    // 5 sections present → complete because publishedBge secondary path fires
    expect(completeness.completeness_status).toBe("complete");
    expect(completeness.missing_sections).toEqual([]);
  });

  it("[D2c-2] same 5-section document WITHOUT BGE citation: not complete (missing procedural_history etc.)", () => {
    // Negative control: a regular non-BGE judgment with only 5 sections
    // must NOT be classified complete — it needs procedural_history, costs etc.
    const fetch = minimalFetch({
      // Text contains 'erkennt' but NOT in BGE citation format — no secondary path
      text: "Urteil vom 10. März 2023 Sachverhalt: Beschwerdeführer. Erwägungen. Demnach erkennt das Verwaltungsgericht: Die Beschwerde wird abgewiesen.",
      publication_mapping_status: "mapping_unverified",
      sections: {
        header: "Urteil vom 10. März 2023",
        facts: "Sachverhalt: Beschwerdeführer.",
        reasoning: "Erwägungen.",
        final_reasoning: "Zusammenfassend: abzuweisen.",
        dispositive: "Demnach erkennt das Verwaltungsgericht: abgewiesen.",
      },
    });
    const completeness = verifyCompleteness(fetch);
    // Not a published BGE → full 9-section check → missing sections
    expect(completeness.completeness_status).not.toBe("complete");
    expect(completeness.missing_sections.length).toBeGreaterThan(0);
  });

  it("[D2c-3] document with mapping_not_found and BGE-looking text: secondary path suppressed", () => {
    // When mapping_status is explicitly 'mapping_not_found', the secondary
    // path must NOT fire (the document was confirmed to NOT be a published BGE).
    const fetch = minimalFetch({
      text: "BGE 142 I 99 confirmed not a published BGE.",
      publication_mapping_status: "mapping_not_found",
      sections: {
        header: "BGE 142 I 99",
        facts: "Sachverhalt: Beschwerdeführer.",
        reasoning: "Erwägungen.",
        final_reasoning: "Zusammenfassend.",
        dispositive: "Die Beschwerde wird abgewiesen.",
      },
    });
    const completeness = verifyCompleteness(fetch);
    // mapping_not_found suppresses secondary path → regular check → not complete
    expect(completeness.completeness_status).not.toBe("complete");
    expect(completeness.missing_sections.length).toBeGreaterThan(0);
  });
});

// ---- D4: Wrong-subject-matter regression ----
// Verifies that when the resolver fetches a URL whose live metadata reveals a
// DIFFERENT case (wrong subject matter), identity_mismatch is returned and no
// content is served. Previously blocked during hardening sprint investigation.

describe("D4: Wrong-subject-matter regression (hardening sprint)", () => {
  it("[D4-1] live document reference contradicts requested reference: identity_mismatch, no content served", () => {
    // Simulates: user requests "9C_100/2024"; the resolved URL points to a page
    // whose live metadata shows reference "5A_999/2023" — an unrelated case.
    const normalized = normalizeSwissCaseReference("9C_100/2024");
    const result = verifySwissCaseIdentity({
      normalized,
      candidate: candidate({
        reference: "9C_100/2024",
        chamber: "9C",
        court_family: "swiss_federal_supreme_court",
        decision_date: "2024-03-15",
      }),
      liveDocumentMetadata: {
        // Live page reveals a completely different case — wrong subject matter.
        reference: "5A_999/2023",
        court_family: "swiss_federal_supreme_court",
        decision_date: "2023-11-10",
      },
    });
    expect(result.status).toBe("identity_mismatch");
    // Live-document mismatches are reported as "live_document_<field>".
    expect(result.mismatched_fields).toContain("live_document_reference");
  });

  it("[D4-2] live document court contradicts requested court: identity_mismatch", () => {
    // Simulates: resolver hits a URL that belongs to the Federal Administrative
    // Court, but user requested a Federal Supreme Court case.
    const normalized = normalizeSwissCaseReference("9C_100/2024");
    const result = verifySwissCaseIdentity({
      normalized,
      candidate: candidate({
        reference: "9C_100/2024",
        chamber: "9C",
        court_family: "swiss_federal_supreme_court",
        decision_date: "2024-03-15",
      }),
      liveDocumentMetadata: {
        reference: "9C_100/2024",
        court_family: "federal_administrative_court",
        decision_date: "2024-03-15",
      },
    });
    expect(result.status).toBe("identity_mismatch");
    expect(result.mismatched_fields).toContain("live_document_court_family");
  });
});
