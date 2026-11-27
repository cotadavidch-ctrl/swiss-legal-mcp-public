import { describe, expect, it } from "vitest";
import { articleExcerptForCitation } from "../src/tools/articleExcerpt.js";

const OR_210 =
  "Art. 210 1 Die Klagen auf Gewährleistung wegen Mängel der Sache verjähren mit Ablauf von zwei Jahren nach deren Ablieferung an den Käufer, selbst wenn dieser die Mängel erst später entdeckt, es sei denn, dass der Verkäufer eine Haftung auf längere Zeit übernommen hat. 2 Die Frist beträgt fünf Jahre, soweit Mängel einer Sache, die bestimmungsgemäss in ein unbewegliches Werk integriert worden ist, die Mangelhaftigkeit des Werkes verursacht haben. 3 Für Kulturgüter im Sinne von Artikel 2 Absatz 1 des Kulturgütertransfergesetzes vom 20. Juni 2003 verjährt die Klage ein Jahr, nachdem der Käufer den Mangel entdeckt hat, in jedem Fall jedoch 30 Jahre nach dem Vertragsabschluss. 4 Eine Vereinbarung über die Verkürzung der Verjährungsfrist ist ungültig, wenn: a. sie die Verjährungsfrist auf weniger als zwei Jahre verkürzt; b. die Sache für den persönlichen Gebrauch bestimmt ist; und c. der Verkäufer beruflich handelt. 5 Die Einreden des Käufers wegen vorhandener Mängel bleiben bestehen, wenn innerhalb der Verjährungsfrist die vorgeschriebene Anzeige an den Verkäufer gemacht worden ist. 6 Der Verkäufer kann die Verjährung nicht geltend machen, wenn ihm eine absichtliche Täuschung des Käufers nachgewiesen wird. Dies gilt nicht für die 30-jährige Frist gemäss Absatz 3.";

describe("articleExcerptForCitation", () => {
  it("devuelve el apartado citado aunque quede más allá de los primeros 600 caracteres", () => {
    const out = articleExcerptForCitation(OR_210, "Art. 210 Abs. 6 OR");
    expect(out.startsWith("6 Der Verkäufer kann die Verjährung nicht geltend machen")).toBe(true);
    expect(out).not.toContain("Die Einreden");
  });

  it("devuelve el apartado 1 y no sigue con el 2", () => {
    const out = articleExcerptForCitation(OR_210, "Art. 210 Abs. 1 OR");
    expect(out.startsWith("1 Die Klagen auf Gewährleistung")).toBe(true);
    expect(out).not.toContain("2 Die Frist");
  });

  it("sin apartado en la cita, o si no se localiza, devuelve el comienzo", () => {
    expect(articleExcerptForCitation(OR_210, "Art. 210 OR")).toBe(OR_210.slice(0, 600));
    expect(articleExcerptForCitation(OR_210, "Art. 210 Abs. 9 OR")).toBe(OR_210.slice(0, 600));
  });

  it("no confunde 'Abs. 2 SchKG' dentro del texto con el apartado 2", () => {
    const text =
      "Art. 198 Ausnahmen Das Verfahren entfällt: a. Aberkennungsklage (Art. 83 Abs. 2 SchKG), b. Feststellungsklage.";
    expect(articleExcerptForCitation(text, "Art. 198 Abs. 2 ZPO")).toBe(text.slice(0, 600));
  });
});
