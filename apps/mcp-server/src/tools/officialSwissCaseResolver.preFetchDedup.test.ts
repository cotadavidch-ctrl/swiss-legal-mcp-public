import { describe, expect, it } from "vitest";
import {
  clearOfficialSwissCaseResolverCache,
  computePreFetchIdentityKey,
  mergePreFetchDuplicates,
  resolveOfficialSwissCase,
  sameLogicalPreFetchIdentity,
  setOfficialSwissCaseHttpTransportForTests,
  type OfficialCaseCandidate,
} from "./officialSwissCaseResolver.js";

/**
 * Tests for pre-fetch structural deduplication (day-01 fix task, corpus
 * export investigation). CONFIRMED root cause: `resolveOfficialSwissCase`
 * can receive both `case_reference` (which activates a search-URL-based
 * adapter) and `source_url_hint` (which activates the direct-URL adapter) --
 * exactly what `caseCorpusExport.ts` supplies for every discovered
 * candidate. Both adapters produce a candidate for the SAME decision before
 * any content has been fetched, and the pre-existing post-fetch duplicate
 * detector cannot recognize them as duplicates (it only compares content
 * hashes, which do not exist yet). `mergePreFetchDuplicates` closes this gap
 * using only information already present on the candidates themselves.
 */

function makeCandidate(overrides: Partial<OfficialCaseCandidate>): OfficialCaseCandidate {
  return {
    candidate_id: overrides.candidate_id ?? "candidate-id",
    source: overrides.source ?? "test_adapter",
    source_url: overrides.source_url ?? "https://search.bger.ch/test",
    canonical_url: overrides.canonical_url ?? overrides.source_url ?? "https://search.bger.ch/test",
    official: overrides.official ?? true,
    court: "Bundesgericht",
    court_family: "swiss_federal_supreme_court",
    canton: null,
    reference: overrides.reference ?? overrides.normalized_reference ?? "9C_1/2024",
    decision_date: null,
    chamber: null,
    language: "de",
    title: overrides.title ?? "Urteil",
    mime_type: "text/html",
    source_adapter: overrides.source_adapter ?? overrides.source ?? "test_adapter",
    normalized_reference: overrides.normalized_reference ?? "9C_1/2024",
    content_kind: "html",
    score: 0,
    matched_features: [],
    mismatched_features: [],
    missing_features: [],
    selection_reason: "",
    rejected_reason: null,
    ...overrides,
  };
}

function bgerDocUrl(docid: string, extraParams: Record<string, string> = {}): string {
  const url = new URL("https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php");
  url.searchParams.set("lang", "de");
  url.searchParams.set("type", "show_document");
  url.searchParams.set("highlight_docid", docid);
  for (const [key, value] of Object.entries(extraParams)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function bgerSearchUrl(query: string): string {
  const url = new URL("https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php");
  url.searchParams.set("lang", "de");
  url.searchParams.set("type", "simple_query");
  url.searchParams.set("query_words", query);
  return url.toString();
}

describe("mergePreFetchDuplicates", () => {
  it("merges a case_reference search candidate with a source_url_hint direct-URL candidate for the same decision", () => {
    const searchCandidate = makeCandidate({
      candidate_id: "search-1",
      source: "swiss_federal_supreme_court",
      source_url: bgerSearchUrl("9C_1/2024"),
      normalized_reference: "9C_1/2024",
    });
    const directCandidate = makeCandidate({
      candidate_id: "direct-1",
      source: "direct_official_url",
      source_url: bgerDocUrl("aza://15-01-2024-9C_1-2024"),
      normalized_reference: "9C_1/2024",
    });
    const result = mergePreFetchDuplicates([searchCandidate, directCandidate]);
    expect(result.candidates).toHaveLength(1);
    expect(result.notes).toContain("pre_fetch_candidates_merged:1");
    expect(result.notes).not.toContain("pre_fetch_identity_conflict");
  });

  it("merges the same decision even when the direct-URL candidate uses a different UI language", () => {
    const searchCandidate = makeCandidate({
      candidate_id: "search-1",
      source_url: bgerSearchUrl("9C_1/2024"),
      normalized_reference: "9C_1/2024",
    });
    const directCandidateFr = makeCandidate({
      candidate_id: "direct-fr",
      source: "direct_official_url",
      source_url: bgerDocUrl("aza://15-01-2024-9C_1-2024", { lang: "fr" }),
      normalized_reference: "9C_1/2024",
    });
    const result = mergePreFetchDuplicates([searchCandidate, directCandidateFr]);
    expect(result.candidates).toHaveLength(1);
    expect(result.notes).toContain("pre_fetch_candidates_merged:1");
  });

  it("merges the same decision even when the direct URL carries extra (tracking-like) query parameters", () => {
    const searchCandidate = makeCandidate({
      candidate_id: "search-1",
      source_url: bgerSearchUrl("9C_1/2024"),
      normalized_reference: "9C_1/2024",
    });
    const directCandidateWithExtraParams = makeCandidate({
      candidate_id: "direct-extra",
      source: "direct_official_url",
      source_url: bgerDocUrl("aza://15-01-2024-9C_1-2024", {
        utm_source: "newsletter",
        session: "abc123",
      }),
      normalized_reference: "9C_1/2024",
    });
    const result = mergePreFetchDuplicates([searchCandidate, directCandidateWithExtraParams]);
    expect(result.candidates).toHaveLength(1);
    expect(result.notes).toContain("pre_fetch_candidates_merged:1");
  });

  it("merges two candidates whose case reference was supplied in equivalent but differently formatted ways when neither carries a URL-embedded docid", () => {
    // Simulates two adapters that both normalized the caller's reference to
    // the exact same normalized_reference (as normalizeSwissCaseReference
    // guarantees upstream of candidate creation), but arrived there from
    // differently formatted raw input and never embedded a docid in their
    // URL -- the case_number tier (3) is what must catch this.
    const candidateA = makeCandidate({
      candidate_id: "fmt-a",
      source: "swiss_federal_supreme_court",
      source_url: bgerSearchUrl("9C_1/2024"),
      normalized_reference: "9C_1/2024",
    });
    const candidateB = makeCandidate({
      candidate_id: "fmt-b",
      source: "swiss_federal_supreme_court_similar",
      source_url: "https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?other=1",
      normalized_reference: "9C_1/2024",
    });
    const result = mergePreFetchDuplicates([candidateA, candidateB]);
    expect(result.candidates).toHaveLength(1);
    expect(result.notes).toContain("pre_fetch_candidates_merged:1");
  });

  it("never merges two distinct decisions that merely share a similar title", () => {
    const candidateA = makeCandidate({
      candidate_id: "distinct-a",
      source_url: bgerDocUrl("aza://15-01-2024-9C_1-2024"),
      normalized_reference: "9C_1/2024",
      title: "Beschwerde in öffentlich-rechtlichen Angelegenheiten",
    });
    const candidateB = makeCandidate({
      candidate_id: "distinct-b",
      source_url: bgerDocUrl("aza://20-02-2024-9C_2-2024"),
      normalized_reference: "9C_2/2024",
      title: "Beschwerde in öffentlich-rechtlichen Angelegenheiten",
    });
    const result = mergePreFetchDuplicates([candidateA, candidateB]);
    expect(result.candidates).toHaveLength(2);
    expect(result.notes).not.toContain("pre_fetch_candidates_merged:1");
    expect(
      sameLogicalPreFetchIdentity(
        computePreFetchIdentityKey(candidateA),
        computePreFetchIdentityKey(candidateB),
      ),
    ).toBe(false);
  });

  it("never merges a candidate whose own URL-embedded identifier contradicts its own case reference, and flags the conflict", () => {
    const searchCandidate = makeCandidate({
      candidate_id: "search-1",
      source_url: bgerSearchUrl("9C_1/2024"),
      normalized_reference: "9C_1/2024",
    });
    // This candidate claims to be 9C_1/2024 (case_reference-derived), but its
    // OWN source URL embeds a docid for a different case, 9C_2/2024 -- an
    // internal contradiction that must never be silently resolved by trusting
    // one signal over the other.
    const contradictoryCandidate = makeCandidate({
      candidate_id: "contradictory-1",
      source: "direct_official_url",
      source_url: bgerDocUrl("aza://15-01-2024-9C_2-2024"),
      normalized_reference: "9C_1/2024",
    });
    const result = mergePreFetchDuplicates([searchCandidate, contradictoryCandidate]);
    expect(result.candidates).toHaveLength(2);
    expect(result.notes).toContain("pre_fetch_identity_conflict");
    expect(result.notes).not.toContain("pre_fetch_candidates_merged:1");
  });

  it("preserves full provenance on a merged candidate: every adapter, source URL and canonical URL involved, plus case_reference/canonical_url", () => {
    const searchCandidate = makeCandidate({
      candidate_id: "search-1",
      source: "swiss_federal_supreme_court",
      source_url: bgerSearchUrl("9C_1/2024"),
      canonical_url: bgerSearchUrl("9C_1/2024"),
      normalized_reference: "9C_1/2024",
      case_reference: "9C_1/2024",
    });
    const directCandidate = makeCandidate({
      candidate_id: "direct-1",
      source: "direct_official_url",
      source_url: bgerDocUrl("aza://15-01-2024-9C_1-2024"),
      canonical_url: bgerDocUrl("aza://15-01-2024-9C_1-2024"),
      normalized_reference: "9C_1/2024",
    });
    const result = mergePreFetchDuplicates([searchCandidate, directCandidate]);
    expect(result.candidates).toHaveLength(1);
    const merged = result.candidates[0]!;
    expect(merged.merged_from_adapters).toEqual(
      expect.arrayContaining(["swiss_federal_supreme_court", "direct_official_url"]),
    );
    expect(merged.merged_source_urls).toHaveLength(2);
    expect(merged.merged_canonical_urls).toHaveLength(2);
    expect(merged.merged_candidate_ids).toEqual(expect.arrayContaining(["search-1", "direct-1"]));
    expect(merged.pre_fetch_merge_reason).toBeTruthy();
    // case_reference / canonical_url of the resulting candidate are not
    // dropped -- they come from whichever candidate was chosen as the base.
    expect(merged.canonical_url).toBeTruthy();
  });

  it("leaves single-candidate and empty inputs untouched", () => {
    const single = makeCandidate({ candidate_id: "only-one" });
    expect(mergePreFetchDuplicates([single]).candidates).toEqual([single]);
    expect(mergePreFetchDuplicates([]).candidates).toEqual([]);
  });
});

function completeContent(reference: string): string {
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

describe("resolveOfficialSwissCase with case_reference + source_url_hint (corpus-export shape)", () => {
  it("resolves unambiguously (never candidate_ambiguous) when both case_reference and a matching source_url_hint are supplied", async () => {
    clearOfficialSwissCaseResolverCache();
    let fetchCallCount = 0;
    setOfficialSwissCaseHttpTransportForTests(async (url: string) => {
      const parsed = new URL(url);
      const bytes = new TextEncoder().encode(completeContent("9C_1/2024"));
      if (parsed.searchParams.get("query_words")) fetchCallCount += 1;
      if (parsed.searchParams.get("highlight_docid")) fetchCallCount += 1;
      return {
        requested_url: url,
        final_url: url,
        status_code: 200,
        redirect_chain: [],
        response_headers: { "content-type": "text/html;charset=iso-8859-1" },
        mime_type: "text/html",
        content_length: bytes.byteLength,
        bytes_received: bytes.byteLength,
        retrieved_at: "2026-08-04T00:00:00.000Z",
        body: bytes,
        network_transport: "live_http" as const,
        mock_or_fixture: false,
      };
    });

    const resolution = await resolveOfficialSwissCase({
      case_reference: "9C_1/2024",
      source_url_hint: bgerDocUrl("aza://15-01-2024-9C_1-2024"),
      require_official_source: true,
      require_full_text: true,
    });

    expect(resolution.discovery_status).not.toBe("candidate_ambiguous");
    expect(resolution.identity.status).not.toBe("identity_ambiguous");
    expect(resolution.legal_use.source_status).not.toBe("not_found");
    expect(resolution.warnings).not.toContain("candidate_score_gap_below_threshold");
    // Exactly one candidate is fetched for content -- the merged one -- never
    // two separate fetches for what is really a single decision.
    expect(fetchCallCount).toBe(1);

    setOfficialSwissCaseHttpTransportForTests(null);
    clearOfficialSwissCaseResolverCache();
  });
});
