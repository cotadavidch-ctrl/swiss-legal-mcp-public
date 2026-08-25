import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseEstvListing } from "./listingParser.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/estv",
);

describe("parseEstvListing", () => {
  const html = readFileSync(
    path.join(fixturesDir, "kreisschreiben_direkte_bundessteuer_listing_de.html"),
    "utf8",
  );
  const items = parseEstvListing(html);

  it("parsea el listado real de Kreisschreiben de Direkte Bundessteuer", () => {
    expect(items.length).toBeGreaterThan(0);
  });

  it("extrae el Kreisschreiben Nr. 50a con todos sus campos reales", () => {
    const ks50a = items.find((item) => item.circularNumber === "50a");
    expect(ks50a).toBeDefined();
    expect(ks50a?.title).toContain("Unzulässigkeit des steuerlichen Abzugs von Bestechungsgeldern");
    expect(ks50a?.downloadUrl).toBe(
      "https://www.estv.admin.ch/dam/de/sd-web/ueIUB1Kh5VCK/dbst-ks-2020-1-050a-d-de.pdf",
    );
    expect(ks50a?.filename).toBe("dbst-ks-2020-1-050a-d-de.pdf");
    expect(ks50a?.issuedDate).toBe("2023-12-05");
    expect(ks50a?.publicationDate).toBe("2023-12-05");
  });

  it("extrae el Kreisschreiben Nr. 50 como entrada distinta", () => {
    const ks50 = items.find((item) => item.circularNumber === "50");
    expect(ks50).toBeDefined();
    expect(ks50?.issuedDate).toBe("2020-07-13");
  });
});
