import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NonTextualDocumentError, ParseError, SecurityError } from "@swiss-legal-mcp/core";
import { extractPdfText } from "./pdfTextExtractor.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../tests/fixtures",
);

/**
 * PDF minimo valido de 1 pagina con un stream de contenido vacio (sin
 * operadores de texto BT/ET) -- fixture sintetica para probar el rechazo de
 * documentos sin texto extraible, distinta de los PDF reales descargados en
 * la auditoria de Fase 4 (ver tests/fixtures/{seco,bsv,estv}).
 */
const BLANK_PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Resources<<>>/Contents 4 0 R>>endobj
4 0 obj<</Length 0>>
stream

endstream
endobj
trailer<</Size 5/Root 1 0 R>>
%%EOF`;

describe("extractPdfText", () => {
  it("extrae texto real de un PDF textual verificado en vivo (Kreisschreiben ESTV Nr. 50a)", async () => {
    const bytes = readFileSync(
      path.join(fixturesDir, "estv", "kreisschreiben_50a_bestechungsgelder_de.pdf"),
    );
    const result = await extractPdfText(bytes);
    expect(result.pageCount).toBeGreaterThan(0);
    expect(result.text.length).toBeGreaterThan(200);
  }, 15000);

  it("rechaza un PDF sin texto extraible real (posible documento escaneado)", async () => {
    const bytes = new TextEncoder().encode(BLANK_PDF);
    await expect(extractPdfText(bytes)).rejects.toThrow(NonTextualDocumentError);
  });

  it("rechaza bytes sin magic bytes PDF", async () => {
    await expect(extractPdfText(new TextEncoder().encode("no es pdf"))).rejects.toThrow(ParseError);
  });

  it("rechaza PDFs cifrados antes del parser de extraccion", async () => {
    const encrypted = new TextEncoder().encode(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Encrypt 2 0 R >>
endobj
%%EOF
`);
    await expect(extractPdfText(encrypted)).rejects.toThrow(SecurityError);
  });
});
