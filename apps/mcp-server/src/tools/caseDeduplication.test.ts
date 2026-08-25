import { describe, expect, it } from "vitest";
import { canonicalizeUrlForDedup, deduplicateStable } from "./caseDeduplication.js";

interface Fixture {
  readonly id: string;
  readonly official_identifier?: string | null;
  readonly case_number?: string | null;
  readonly decision_date?: string | null;
  readonly official_url?: string | null;
  readonly metadata_hash?: string | null;
  readonly title?: string;
}

function toInput(item: Fixture) {
  return {
    official_identifier: item.official_identifier ?? null,
    case_number: item.case_number ?? null,
    decision_date: item.decision_date ?? null,
    official_url: item.official_url ?? null,
    metadata_hash: item.metadata_hash ?? null,
  };
}

describe("deduplicateStable", () => {
  it("deduplicates by official_identifier (level 1) before any other key", () => {
    const items: Fixture[] = [
      { id: "a", official_identifier: "aza://15-01-2026-9C_999-2026", case_number: "9C_999/2026" },
      { id: "b", official_identifier: "aza://15-01-2026-9C_999-2026", case_number: "9C_999/2026" },
    ];
    const result = deduplicateStable(items, toInput);
    expect(result.deduplicated.map((item) => item.id)).toEqual(["a"]);
    expect(result.summary.duplicates_removed).toBe(1);
    expect(result.summary.candidates_before_dedup).toBe(2);
    expect(result.summary.candidates_after_dedup).toBe(1);
    expect(result.summary.dedup_levels_applied).toEqual(["official_identifier"]);
  });

  it("deduplicates by case_number + decision_date (level 2) when no official identifier exists", () => {
    const items: Fixture[] = [
      { id: "a", case_number: "4A_100/2020", decision_date: "2020-05-01" },
      { id: "b", case_number: "4A_100/2020", decision_date: "2020-05-01" },
      { id: "c", case_number: "4A_100/2020", decision_date: "2020-05-02" },
    ];
    const result = deduplicateStable(items, toInput);
    expect(result.deduplicated.map((item) => item.id)).toEqual(["a", "c"]);
    expect(result.summary.duplicates_removed).toBe(1);
    expect(result.summary.dedup_levels_applied).toEqual(["case_number_and_date"]);
  });

  it("deduplicates by canonical official URL (level 3) when no identifier or case+date exists", () => {
    const items: Fixture[] = [
      { id: "a", official_url: "https://search.bger.ch/doc?b=2&a=1" },
      { id: "b", official_url: "https://search.bger.ch/doc?a=1&b=2" },
    ];
    const result = deduplicateStable(items, toInput);
    expect(result.deduplicated.map((item) => item.id)).toEqual(["a"]);
    expect(result.summary.dedup_levels_applied).toEqual(["canonical_url"]);
  });

  it("deduplicates by stable metadata hash (level 4) only as a last resort", () => {
    const items: Fixture[] = [
      { id: "a", metadata_hash: "hash-1" },
      { id: "b", metadata_hash: "hash-1" },
      { id: "c", metadata_hash: "hash-2" },
    ];
    const result = deduplicateStable(items, toInput);
    expect(result.deduplicated.map((item) => item.id)).toEqual(["a", "c"]);
    expect(result.summary.dedup_levels_applied).toEqual(["metadata_hash"]);
  });

  it("never deduplicates two distinct decisions that merely share a title", () => {
    const items: Fixture[] = [
      {
        id: "a",
        official_identifier: "aza://15-01-2026-9C_999-2026",
        title: "Beschwerde in öffentlich-rechtlichen Angelegenheiten",
      },
      {
        id: "b",
        official_identifier: "aza://20-02-2026-9C_888-2026",
        title: "Beschwerde in öffentlich-rechtlichen Angelegenheiten",
      },
    ];
    const result = deduplicateStable(items, toInput);
    expect(result.deduplicated.map((item) => item.id)).toEqual(["a", "b"]);
    expect(result.summary.duplicates_removed).toBe(0);
  });

  it("keeps items without any dedup key and counts them explicitly", () => {
    const items: Fixture[] = [{ id: "a" }, { id: "b" }];
    const result = deduplicateStable(items, toInput);
    expect(result.deduplicated.map((item) => item.id)).toEqual(["a", "b"]);
    expect(result.summary.items_without_dedup_key).toBe(2);
    expect(result.summary.duplicates_removed).toBe(0);
  });

  it("prioritizes official_identifier over case_number+date even when both are present and conflict", () => {
    const items: Fixture[] = [
      {
        id: "a",
        official_identifier: "aza://15-01-2026-9C_999-2026",
        case_number: "9C_999/2026",
        decision_date: "2026-01-15",
      },
      {
        id: "b",
        official_identifier: "aza://15-01-2026-9C_999-2026",
        case_number: "DIFFERENT_REF",
        decision_date: "1999-01-01",
      },
    ];
    const result = deduplicateStable(items, toInput);
    expect(result.deduplicated.map((item) => item.id)).toEqual(["a"]);
  });
});

describe("canonicalizeUrlForDedup", () => {
  it("normalizes query parameter order and case", () => {
    const a = canonicalizeUrlForDedup("https://search.bger.ch/doc?b=2&a=1");
    const b = canonicalizeUrlForDedup("HTTPS://SEARCH.BGER.CH/doc?a=1&b=2");
    expect(a).toBe(b);
  });

  it("falls back to a trimmed lowercase string for unparseable input rather than throwing", () => {
    expect(() => canonicalizeUrlForDedup("not a url")).not.toThrow();
  });
});
