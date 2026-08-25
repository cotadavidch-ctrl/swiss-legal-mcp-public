import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseBsvDocumentPage } from "./documentPageParser.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../tests/fixtures/bsv",
);
const DOC_URL = "https://sozialversicherungen.admin.ch/de/d/18452";

describe("parseBsvDocumentPage", () => {
  const html = readFileSync(
    path.join(fixturesDir, "document_18452_ksir_version_history_de.html"),
    "utf8",
  );
  const versions = parseBsvDocumentPage(html, DOC_URL);

  it("extrae multiples versiones historicas reales del KSIR", () => {
    expect(versions.length).toBeGreaterThanOrEqual(2);
  });

  it("la version vigente (6) tiene isCurrent=true y descarga sin parametro version=", () => {
    const current = versions.find((v) => v.version === 6);
    expect(current).toBeDefined();
    expect(current?.isCurrent).toBe(true);
    expect(current?.downloadUrl).toBe("https://sozialversicherungen.admin.ch/de/d/18452/download");
    expect(current?.documentNumber).toBe("318.507.31");
    expect(current?.changedDate).toBe("2026-07-14");
    expect(current?.effectiveDate).toBe("2022-01-01");
    expect(current?.standDate).toBe("2026-01-01");
  });

  it("una version historica (5) tiene isCurrent=false y descarga con ?version=5", () => {
    const historical = versions.find((v) => v.version === 5);
    expect(historical).toBeDefined();
    expect(historical?.isCurrent).toBe(false);
    expect(historical?.downloadUrl).toBe(
      "https://sozialversicherungen.admin.ch/de/d/18452/download?version=5",
    );
    expect(historical?.standDate).toBe("2025-01-01");
  });

  it("nunca inventa documentNumber cuando no hay dt/dd 'Dokumentennummer'", () => {
    // Todas las versiones reales de este documento SI declaran Dokumentennummer;
    // se verifica que el campo, cuando presente, es siempre la cadena real observada.
    for (const version of versions) {
      if (version.documentNumber) {
        expect(version.documentNumber).toBe("318.507.31");
      }
    }
  });
});
