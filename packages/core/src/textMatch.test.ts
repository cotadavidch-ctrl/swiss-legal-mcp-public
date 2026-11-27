import { describe, expect, it } from "vitest";
import { rankByQuery } from "./textMatch.js";

const titles = [
  "Kreisschreiben Nr. 19: Leasinggeschäfte mit Liegenschaften",
  "Kreisschreiben Nr. 17: Wohneigentumsförderung",
  "Kreisschreiben Nr. 50: Unzulässiger Abzug von Bestechungsgeldern",
];

describe("rankByQuery", () => {
  it("sin consulta devuelve todo", () => {
    expect(rankByQuery(titles, (t) => t, undefined).items).toHaveLength(3);
    expect(rankByQuery(titles, (t) => t, "  ").items).toHaveLength(3);
  });

  it("encuentra por varias palabras aunque no aparezcan seguidas", () => {
    const r = rankByQuery(titles, (t) => t, "Kreisschreiben Abzug Bestechungsgeldern");
    expect(r.mode).toBe("all");
    expect(r.items).toEqual([titles[2]]);
  });

  it("acepta la raiz de compuestos largos", () => {
    const r = rankByQuery(titles, (t) => t, "Liegenschaftsunterhalt");
    expect(r.items).toEqual([titles[0]]);
  });

  it("si ninguna entrada contiene todas las palabras, amplia a las que contienen alguna y lo indica", () => {
    const r = rankByQuery(titles, (t) => t, "Liegenschaften Bestechungsgeldern");
    expect(r.mode).toBe("any");
    expect(r.items).toHaveLength(2);
  });

  it("sin coincidencias devuelve vacio", () => {
    expect(rankByQuery(titles, (t) => t, "Mehrwertsteuer").items).toEqual([]);
  });

  it("ignora mayusculas", () => {
    expect(rankByQuery(titles, (t) => t, "WOHNEIGENTUMSFÖRDERUNG").items).toEqual([titles[1]]);
  });
});
