import { describe, expect, it } from "vitest";
import { findArticleByNumber, parseAkomaNtosoXml } from "./akomaNtosoParser.js";

const xml = `<akomaNtoso><act><body>
<article eId="art_336_c"><num>Art. 336c</num><paragraph eId="art_336_c/para_1"><content><p>Der Arbeitgeber darf nicht kuendigen:</p>
<p>c<sup>bis</sup>. bis zum Ende des Urlaubs nach <ref href="x">Artikel 329 Absatz 2</ref>; ferner <authorialNote><p>Fassung gemäss Ziff. I</p></authorialNote>mehr als elf Tage.</p></content></paragraph></article>
</body></act></akomaNtoso>`;

describe("texto de articulo en orden documental", () => {
  it("mantiene la posicion de <sup> y <ref> y omite notas editoriales", () => {
    const a = findArticleByNumber(parseAkomaNtosoXml(xml), "336c");
    expect(a?.fullText).toContain(
      "cbis. bis zum Ende des Urlaubs nach Artikel 329 Absatz 2; ferner",
    );
    expect(a?.fullText).not.toContain("Fassung gemäss");
    expect(a?.fullText).toContain("mehr als elf Tage");
  });
});
