import { describe, expect, it } from "vitest";
import { extractSectionsWithEvidence } from "../src/tools/officialSwissCaseResolver.js";

const HEADER = `Bundesgericht
Tribunal fédéral
Tribunale federale
Tribunal federal
4A_999/2024
Urteil vom 1. Februar 2025
I. zivilrechtliche Abteilung
Besetzung
Bundesrichter Hurni, Präsident,
Gerichtsschreiber Kistler.
Verfahrensbeteiligte
A.________, Beschwerdeführer,
gegen
B.________ AG, Beschwerdegegnerin.
Gegenstand
Kaufvertrag,
Beschwerde gegen das Urteil des Obergerichts vom 1. Dezember 2024.
`;

const FILLER =
  "dass der Beschwerdeführer eine Eingabe einreichte, mit der er das Urteil des Obergerichts anfechten wollte und dabei die gesetzlichen Begründungsanforderungen nicht beachtete; ";

describe("secciones de sentencias del Tribunal Federal: formulas de dispositivo", () => {
  it("mantiene el dispositivo de una sala colegiada ('Demnach erkennt das Bundesgericht')", () => {
    const text = `${HEADER}Sachverhalt:\nA. Der Beschwerdeführer kaufte eine Sache.\nErwägungen:\n1. Die Beschwerde ist unbegründet.\nDemnach erkennt das Bundesgericht:\n1. Die Beschwerde wird abgewiesen.\n2. Die Gerichtskosten werden dem Beschwerdeführer auferlegt.\nIm Namen der I. zivilrechtlichen Abteilung`;
    const { sections } = extractSectionsWithEvidence(text);
    expect(sections["dispositive"]).toContain("Die Beschwerde wird abgewiesen");
    expect(sections["facts"]).toContain("kaufte eine Sache");
  });

  it("reconoce 'Demnach verfügt der Präsident:' (decision del presidente)", () => {
    const text = `${HEADER}Sachverhalt:\nA. Der Beschwerdeführer kaufte eine Sache.\nErwägungen:\n1. Die Beschwerde wurde zurückgezogen.\nDemnach verfügt der Präsident:\n1. Das Verfahren wird als gegenstandslos abgeschrieben.\n2. Die Gerichtskosten werden dem Beschwerdeführer auferlegt.\nIm Namen der I. zivilrechtlichen Abteilung`;
    const { sections } = extractSectionsWithEvidence(text);
    expect(sections["dispositive"]).toContain("als gegenstandslos abgeschrieben");
  });

  it("reconoce 'erkennt das präsidierende Mitglied:' tras una lista de 'dass'", () => {
    const text = `${HEADER}Das präsidierende Mitglied zieht in Erwägung,\n${FILLER}\ndass die Gerichtskosten dem Beschwerdeführer aufzuerlegen sind;\nerkennt das präsidierende Mitglied:\n1. Auf die Beschwerde wird nicht eingetreten.\n2. Die Gerichtskosten werden dem Beschwerdeführer auferlegt.\nLausanne, 11. Juli 2008`;
    const { sections } = extractSectionsWithEvidence(text);
    expect(sections["dispositive"]).toContain("nicht eingetreten");
  });

  it("reconoce 'erkannt:' y toma la lista de 'dass' como hechos en el procedimiento simplificado", () => {
    const text = `${HEADER}Der Präsident hat in Erwägung,\n${FILLER}${FILLER}\ndass auf die Beschwerde mangels hinreichender Begründung nicht einzutreten ist;\nerkannt:\n1. Auf die Beschwerde wird nicht eingetreten.\n2. Die Gerichtsgebühr wird dem Beschwerdeführer auferlegt.\nLausanne, 16. Juli 2007`;
    const { sections } = extractSectionsWithEvidence(text);
    expect(sections["dispositive"]).toContain("nicht eingetreten");
    expect(sections["facts"]).toContain("Eingabe einreichte");
  });

  it("reconoce 'im Verfahren nach Art. 32 Abs. 2 BGG verfügt:' (retiro del recurso)", () => {
    const text = `${HEADER}Der Präsident hat in Erwägung,\n${FILLER}${FILLER}\ndass der Beschwerdeführer kostenpflichtig ist (Art. 66 Abs. 3 BGG);\nim Verfahren nach Art. 32 Abs. 2 BGG verfügt:\n1. Das Verfahren wird infolge Rückzugs der Beschwerde abgeschrieben.\nLausanne, 9. Januar 2008`;
    const { sections } = extractSectionsWithEvidence(text);
    expect(sections["dispositive"]).toContain("infolge Rückzugs");
  });

  it("no inventa un dispositivo donde no hay ninguna formula", () => {
    const text = `${HEADER}Sachverhalt:\nA. Der Beschwerdeführer kaufte eine Sache.\nErwägungen:\n1. Die Frage ist umstritten und bleibt offen.`;
    const { sections } = extractSectionsWithEvidence(text);
    expect(sections["dispositive"]).toBeUndefined();
  });
});
