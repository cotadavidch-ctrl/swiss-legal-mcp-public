import { describe, expect, it } from "vitest";
import { extractSanitizedText, parseHtml } from "./htmlParser.js";

const SAMPLE_HTML = `
<html><body>
  <script>alert('deberia desaparecer')</script>
  <style>.x { color: red; }</style>
  <a class="u-base-download-item" href="/api/media/x.pdf">
    <h5 class="u-base-download-item__title">Weisung AVIG KAE gultig ab 1.7.2026</h5>
  </a>
  <p>Texto real   con   espacios</p>
</body></html>
`;

describe("parseHtml / extractSanitizedText", () => {
  it("elimina script y style antes de exponer el arbol", () => {
    const $ = parseHtml(SAMPLE_HTML);
    expect($("script")).toHaveLength(0);
    expect($("style")).toHaveLength(0);
  });

  it("permite extraer atributos y texto de anclas reales (patron SECO/ESTV)", () => {
    const $ = parseHtml(SAMPLE_HTML);
    const anchor = $("a.u-base-download-item");
    expect(anchor.attr("href")).toBe("/api/media/x.pdf");
    expect(anchor.find("h5").text()).toContain("gultig ab 1.7.2026");
  });

  it("extractSanitizedText normaliza espacios y omite script/style", () => {
    const text = extractSanitizedText(SAMPLE_HTML);
    expect(text).not.toContain("deberia desaparecer");
    expect(text).not.toContain("color: red");
    expect(text).toContain("Texto real con espacios");
  });
});
