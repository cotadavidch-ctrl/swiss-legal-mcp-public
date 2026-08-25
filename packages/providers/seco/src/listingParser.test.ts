import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSecoListing } from "./listingParser.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/seco",
);

function loadFixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), "utf8");
}

describe("parseSecoListing", () => {
  it("parsea el listado real aleman (publikationen_weisungen_section_de.html)", () => {
    const html = loadFixture("publikationen_weisungen_section_de.html");
    const items = parseSecoListing(
      html,
      "https://www.arbeit.swiss/de/informationszentrum/publikationen",
    );

    expect(items.length).toBeGreaterThan(5);

    const kae = items.find((item) => item.title.includes("AVIG-Praxis KAE"));
    expect(kae).toBeDefined();
    expect(kae?.downloadUrl).toBe(
      "https://www.arbeit.swiss/api/media/fileservice/sdweb-docs-prod-arbeitswiss-files/files/2026/06/24/f134ea35-f4ff-4127-88de-1dca50b0267d.pdf",
    );
    expect(kae?.publicationDate).toBe("2026-06-25");
  });

  it("parsea el listado real frances (publications_directives_section_fr.html) con href ya absoluto", () => {
    const html = loadFixture("publications_directives_section_fr.html");
    const items = parseSecoListing(
      html,
      "https://www.arbeit.swiss/fr/centre-dinformation/publications-fr",
    );

    const rht = items.find((item) => item.title.includes("Bulletin LACI RHT"));
    expect(rht).toBeDefined();
    expect(rht?.downloadUrl).toMatch(/^https:\/\/backend\.arbeit\.swiss\//);
  });

  it("devuelve un array vacio si no hay anclas de descarga", () => {
    const items = parseSecoListing("<html><body>vacio</body></html>", "https://www.arbeit.swiss/");
    expect(items).toEqual([]);
  });

  it("no lanza excepcion ante HTML malformado (etiquetas sin cerrar) y omite anclas incompletas", () => {
    const malformed =
      '<div><a class="u-base-download-item" href="/api/media/x.pdf"><h5 class="u-base-download-item__title">Titulo real' +
      '<div class="u-base-download-item__meta-info"><span class="u-base-download-item__type">PDF' +
      '<a class="u-base-download-item"><h5 class="u-base-download-item__title"></h5></a>';
    expect(() => parseSecoListing(malformed, "https://www.arbeit.swiss/")).not.toThrow();
    const items = parseSecoListing(malformed, "https://www.arbeit.swiss/");
    // La segunda ancla no tiene href real y su h5 esta vacio: se omite, no se
    // inventa un downloadUrl ni un titulo para completarla.
    expect(items.every((item) => item.downloadUrl.length > 0 && item.title.length > 0)).toBe(true);
  });
});
