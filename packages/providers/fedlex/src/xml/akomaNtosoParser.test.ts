import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  articleNumberToEId,
  extractText,
  findArticleByNumber,
  findArticleInAnnex,
  findNodeByEId,
  listArticleEIds,
  parseAkomaNtosoXml,
  XmlSecurityError,
} from "./akomaNtosoParser.js";

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../tests/fixtures/fedlex/akoma_ntoso_constitution_de_20240303.xml",
);

const realXml = readFileSync(fixturePath, "utf8");

describe("parseAkomaNtosoXml (documento real de la Constitucion federal)", () => {
  it("parsea el documento real sin lanzar", () => {
    const tree = parseAkomaNtosoXml(realXml);
    expect(tree).toBeDefined();
  });

  it("rechaza un documento con DOCTYPE antes de invocar al parser (proteccion XXE)", () => {
    const externalTarget = ["http:", "", "internal.example", "secret-resource"].join("/");
    const malicious = `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "${externalTarget}">]><foo>&xxe;</foo>`;
    expect(() => parseAkomaNtosoXml(malicious)).toThrow(XmlSecurityError);
  });

  it("rechaza una bomba XML (billion laughs) porque cualquier DOCTYPE se bloquea antes de parsear", () => {
    const lolz = `<?xml version="1.0"?><!DOCTYPE lolz [
      <!ENTITY lol0 "lol">
      <!ENTITY lol1 "&lol0;&lol0;&lol0;&lol0;&lol0;&lol0;&lol0;&lol0;&lol0;&lol0;">
      <!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;">
    ]><lolz>&lol2;</lolz>`;
    expect(() => parseAkomaNtosoXml(lolz)).toThrow(XmlSecurityError);
  });

  it("rechaza XML malformado (etiqueta sin cerrar) con un error claro, sin colgarse", () => {
    const malformed = '<akomaNtoso><act><article eId="art_1">texto sin cerrar';
    expect(() => parseAkomaNtosoXml(malformed)).toThrow();
  });

  it("rechaza XML malformado (atributo sin comillas de cierre)", () => {
    const malformed = '<akomaNtoso><article eId="art_1>texto</article></akomaNtoso>';
    expect(() => parseAkomaNtosoXml(malformed)).toThrow();
  });

  it("rechaza un documento que supera el limite de tamano", () => {
    const huge = "<a>" + "x".repeat(1000) + "</a>";
    expect(() => parseAkomaNtosoXml(huge, 10)).toThrow(XmlSecurityError);
  });

  it("encuentra exactamente 232 elementos <article> reales (ver README de fixtures)", () => {
    const tree = parseAkomaNtosoXml(realXml);
    const eIds = listArticleEIds(tree);
    expect(eIds.length).toBe(232);
    expect(eIds).toContain("art_1");
    expect(eIds).toContain("art_104_a");
  });

  it("localiza el Art. 1 real y devuelve su texto literal", () => {
    const tree = parseAkomaNtosoXml(realXml);
    const article = findArticleByNumber(tree, "1");
    expect(article).toBeDefined();
    expect(article?.eId).toBe("art_1");
    expect(article?.fullText.length).toBeGreaterThan(0);
    expect(article?.fullText).toContain("Schweizerische Eidgenossenschaft");
  });

  it("localiza un articulo con sufijo de letra real (Art. 104a)", () => {
    const tree = parseAkomaNtosoXml(realXml);
    const article = findArticleByNumber(tree, "104a");
    expect(article).toBeDefined();
    expect(article?.eId).toBe("art_104_a");
  });

  it("devuelve undefined para un articulo inexistente", () => {
    const tree = parseAkomaNtosoXml(realXml);
    expect(findArticleByNumber(tree, "9999")).toBeUndefined();
  });

  it("extrae el texto de una letra real dentro de un articulo (Art. 104 lit. a)", () => {
    const tree = parseAkomaNtosoXml(realXml);
    const node = findNodeByEId(tree, "art_104/para_1/lbl_a");
    expect(node).toBeDefined();
    expect(extractText(node)).toContain("Versorgung der Bevölkerung");
  });
});

// Minimal synthetic XML with annex structure matching the FZA/Fedlex eId pattern.
// eIds observed in real FZA XML: annex_I/lvl_u1/lvl_II/art_9 (Gleichbehandlung).
// Uses `section` elements for annex grouping because `section` is in the
// parser's `isArray` list — avoids duplicate-key overwrite for non-listed tags.
const annexXml = `<akomaNtoso>
  <act>
    <body>
      <article eId="art_1"><num>1</num><content><p>Anwendungsbereich.</p></content></article>
      <article eId="art_9"><num>9</num><content><p>Haupttext Artikel 9.</p></content></article>
      <section eId="annex_I">
        <section eId="annex_I/lvl_u1">
          <section eId="annex_I/lvl_u1/lvl_II">
            <article eId="annex_I/lvl_u1/lvl_II/art_9">
              <heading>Gleichbehandlung</heading>
              <content><p>Anhang I Artikel 9 Gleichbehandlung Text.</p></content>
            </article>
            <article eId="annex_I/lvl_u1/lvl_II/art_10">
              <content><p>Anhang I Artikel 10 Text.</p></content>
            </article>
          </section>
        </section>
      </section>
      <section eId="annex_II">
        <article eId="annex_II/art_9">
          <content><p>Anhang II Artikel 9 Text.</p></content>
        </article>
      </section>
    </body>
  </act>
</akomaNtoso>`;

describe("findArticleInAnnex (regression: FZA annex-scoped article retrieval)", () => {
  it("finds Annex I Art. 9 by prefix 'annex_I' matching the actual FZA eId pattern", () => {
    const tree = parseAkomaNtosoXml(annexXml);
    const article = findArticleInAnnex(tree, "annex_I", "9");
    expect(article).toBeDefined();
    expect(article?.eId).toBe("annex_I/lvl_u1/lvl_II/art_9");
    expect(article?.articleNumber).toBe("9");
    expect(article?.heading).toBe("Gleichbehandlung");
    expect(article?.fullText).toContain("Gleichbehandlung");
    expect(article?.fullText).toContain("Anhang I Artikel 9");
  });

  it("distinguishes Annex I Art. 9 from main-body Art. 9 (no silent fallback)", () => {
    const tree = parseAkomaNtosoXml(annexXml);
    const mainBody = findArticleByNumber(tree, "9");
    const annexI = findArticleInAnnex(tree, "annex_I", "9");
    expect(mainBody?.eId).toBe("art_9");
    expect(mainBody?.fullText).toContain("Haupttext Artikel 9");
    expect(annexI?.eId).toBe("annex_I/lvl_u1/lvl_II/art_9");
    expect(annexI?.fullText).toContain("Anhang I Artikel 9");
    // They must differ — no silent fallback from annex to main body or vice versa.
    expect(mainBody?.fullText).not.toContain("Anhang I");
    expect(annexI?.fullText).not.toContain("Haupttext Artikel 9");
  });

  it("finds Annex II Art. 9 independently of Annex I", () => {
    const tree = parseAkomaNtosoXml(annexXml);
    const annexII = findArticleInAnnex(tree, "annex_II", "9");
    expect(annexII).toBeDefined();
    expect(annexII?.eId).toBe("annex_II/art_9");
    expect(annexII?.fullText).toContain("Anhang II Artikel 9");
  });

  it("returns undefined for a non-existent annex — no fallback to main body or other annex", () => {
    const tree = parseAkomaNtosoXml(annexXml);
    expect(findArticleInAnnex(tree, "annex_III", "9")).toBeUndefined();
    expect(findArticleInAnnex(tree, "annex_I", "99")).toBeUndefined();
  });

  it("does not interfere with main-body findArticleByNumber after annex lookup", () => {
    const tree = parseAkomaNtosoXml(annexXml);
    findArticleInAnnex(tree, "annex_I", "9"); // warm the path
    const mainBody = findArticleByNumber(tree, "1");
    expect(mainBody?.eId).toBe("art_1");
    expect(mainBody?.fullText).toContain("Anwendungsbereich");
  });
});

describe("articleNumberToEId", () => {
  it("convierte un numero simple", () => {
    expect(articleNumberToEId("41")).toBe("art_41");
  });

  it("convierte un numero con sufijo de letra", () => {
    expect(articleNumberToEId("104a")).toBe("art_104_a");
  });

  it("rechaza un formato no reconocido", () => {
    expect(() => articleNumberToEId("cuarenta y uno")).toThrow(XmlSecurityError);
  });
});
