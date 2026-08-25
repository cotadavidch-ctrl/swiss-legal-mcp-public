import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseBsvFolderListing } from "./folderListingParser.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/bsv",
);

describe("parseBsvFolderListing", () => {
  it("parsea la tabla real de la carpeta IV (folder 5661)", () => {
    const html = readFileSync(
      path.join(fixturesDir, "folder_5661_iv_kreisschreiben_listing_de.html"),
      "utf8",
    );
    const items = parseBsvFolderListing(html);

    expect(items.length).toBeGreaterThan(0);
    const ksir = items.find((item) => item.docId === "18452");
    expect(ksir).toBeDefined();
    expect(ksir?.abbreviation).toBe("KSIR");
    expect(ksir?.description).toContain("Kreisschreiben");
    expect(ksir?.description).toContain("gültig ab 1.1.2022");
    expect(ksir?.changedDate).toBe("2026-07-14");
    expect(ksir?.versionCount).toBe(6);
    expect(ksir?.languages).toEqual(["de", "fr", "it"]);
  });

  it("omite la fila oculta de historial en linea (bsv-inline-versions-container)", () => {
    const html = readFileSync(
      path.join(fixturesDir, "folder_5661_iv_kreisschreiben_listing_de.html"),
      "utf8",
    );
    const items = parseBsvFolderListing(html);
    // Cada docId real debe aparecer una unica vez en el listado principal.
    const ids = items.map((item) => item.docId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
