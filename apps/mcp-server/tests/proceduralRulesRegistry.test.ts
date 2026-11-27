import { describe, expect, it } from "vitest";
import { largestChfAmount, selectProceduralRoutes } from "../src/tools/proceduralRulesRegistry.js";

describe("largestChfAmount", () => {
  it.each([
    ["CHF 98 500", 98500],
    ["CHF 98'500", 98500],
    ["CHF 98.500", 98500],
    ["CHF 98500", 98500],
    ["98 500 Franken", 98500],
    ["CHF 98500 und CHF 4325", 98500],
    ["Fr. 12.50", 12.5],
    ["CHF 640 000 Kaufpreis, CHF 98 500 Sanierung", 640000],
  ])("liest %s", (text, expected) => {
    expect(largestChfAmount(text)).toBe(expected);
  });

  it("devuelve null sin importes", () => {
    expect(largestChfAmount("keine Zahl")).toBeNull();
  });
});

describe("selectProceduralRoutes", () => {
  it("no devuelve rutas para una materia sin reglas registradas", () => {
    expect(selectProceduralRoutes({ area: "other", text: "Verfügung" })).toEqual([]);
    expect(selectProceduralRoutes({ area: "constitutional", text: "Verfügung" })).toEqual([]);
  });

  describe("rutas por materia con extractos literales", () => {
    const route = (area: string, id: string, text = "Streit") =>
      selectProceduralRoutes({ area, text }).find((r) => r.id === id);
    const provisions = (area: string, id: string) =>
      route(area, id)!.rules.map((rule) => rule.provision);

    it("seguros sociales: Einsprache, Versicherungsgericht cantonal y plazos de 30 dias", () => {
      expect(provisions("social-insurance", "social-insurance")).toEqual(
        expect.arrayContaining([
          "Art. 52 Abs. 1 ATSG",
          "Art. 56 Abs. 1 ATSG",
          "Art. 57 ATSG",
          "Art. 60 Abs. 1 ATSG",
          "Art. 100 Abs. 1 BGG",
        ]),
      );
      const einsprache = route("social-insurance", "social-insurance")!.rules.find(
        (rule) => rule.id === "atsg-52-1",
      )!;
      expect(einsprache.excerpt).toContain("innerhalb von 30 Tagen");
      expect(route("social-insurance", "social-insurance")!.deadlines).toHaveLength(3);
    });

    it("alquiler: impugnacion en 30 dias desde la recepcion y umbral de CHF 15 000", () => {
      expect(provisions("tenancy", "tenancy-termination")).toEqual(
        expect.arrayContaining(["Art. 271 Abs. 1 OR", "Art. 273 Abs. 1 OR", "Art. 209 Abs. 4 ZPO"]),
      );
      expect(route("tenancy", "tenancy-termination")!.notes.join(" ")).toContain("CHF 15 000");
    });

    it("ejecucion por deudas: Rechtsvorschlag en 10 dias y Aberkennungsklage en 20", () => {
      const r = route("debt-enforcement", "debt-enforcement")!;
      expect(r.rules.map((x) => x.provision)).toEqual(
        expect.arrayContaining(["Art. 74 Abs. 1 SchKG", "Art. 83 Abs. 2 SchKG"]),
      );
      expect(r.rules.find((x) => x.id === "schkg-74-1")!.excerpt).toContain("zehn Tagen");
      expect(r.deadlines.map((d) => d.description)).toEqual([
        "Rechtsvorschlag gegen den Zahlungsbefehl",
        "Aberkennungsklage nach provisorischer Rechtsöffnung",
      ]);
    });

    it("penal: plazos de la StPO sin ferias y Beschwerde en Strafsachen", () => {
      const r = route("criminal", "criminal-procedure")!;
      expect(r.rules.map((x) => x.provision)).toEqual(
        expect.arrayContaining([
          "Art. 354 Abs. 1 StPO",
          "Art. 399 Abs. 1 StPO",
          "Art. 399 Abs. 3 StPO",
          "Art. 89 Abs. 1-2 StPO",
          "Art. 78 Abs. 1 BGG",
        ]),
      );
      expect(r.rules.find((x) => x.id === "stpo-89")!.excerpt).toContain("keine Gerichtsferien");
    });

    it("laboral: ademas de la ruta civil, oposicion escrita y caducidad de 180 dias", () => {
      const routes = selectProceduralRoutes({ area: "employment", text: "Kündigung" });
      expect(routes.map((x) => x.id)).toEqual(
        expect.arrayContaining(["civil-claim", "employment-termination"]),
      );
      const r = routes.find((x) => x.id === "employment-termination")!;
      expect(r.rules.find((x) => x.id === "or-336b-2")!.excerpt).toContain("180 Tagen");
    });

    it("administrativo: VwVG con 30 dias y aviso de que solo vale para autoridades federales", () => {
      const r = route("administrative", "federal-administrative")!;
      expect(r.rules.map((x) => x.provision)).toEqual(
        expect.arrayContaining(["Art. 44 VwVG", "Art. 46a VwVG", "Art. 50 Abs. 1 VwVG"]),
      );
      expect(r.notes.join(" ")).toContain("kantonale");
    });

    it("todas las reglas nuevas llevan version y fecha de verificacion", () => {
      for (const [area, id] of [
        ["social-insurance", "social-insurance"],
        ["tenancy", "tenancy-termination"],
        ["debt-enforcement", "debt-enforcement"],
        ["criminal", "criminal-procedure"],
        ["employment", "employment-termination"],
        ["administrative", "federal-administrative"],
      ] as const) {
        for (const rule of route(area, id)!.rules) {
          expect(rule.excerpt.length).toBeGreaterThan(20);
          expect(rule.consideredVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(rule.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    });
  });

  it("civil sin Kaufbezug no incluye Kaufrecht", () => {
    const routes = selectProceduralRoutes({ area: "civil", text: "Forderung CHF 5 000" });
    expect(routes.map((r) => r.id)).toEqual(["civil-claim"]);
  });

  it("toma el valor litigioso de las pretensiones y no del precio de compra", () => {
    const routes = selectProceduralRoutes({
      area: "civil",
      text: "Kaufpreis CHF 640 000, Sanierung CHF 98 500",
      claimsText: "Minderung CHF 98 500",
    });
    const provisions = routes.flatMap((r) => r.rules.map((rule) => rule.provision));
    expect(provisions).not.toContain("Art. 199 Abs. 1 ZPO");
    expect(routes[0]?.notes[0]).toContain("98500");
  });

  it("añade la ruta del recurso al Tribunal Federal con las normas del BGG cuando se menciona", () => {
    const routes = selectProceduralRoutes({
      area: "civil",
      text: "Beschwerde in Zivilsachen an das Bundesgericht gegen das Urteil des Obergerichts",
      claimsText: "Zahlung CHF 98 500",
    });
    const federal = routes.find((r) => r.id === "federal-appeal");
    expect(federal).toBeDefined();
    const provisions = federal!.rules.map((rule) => rule.provision);
    expect(provisions).toEqual(
      expect.arrayContaining([
        "Art. 72 Abs. 1 BGG",
        "Art. 74 Abs. 1 BGG",
        "Art. 75 Abs. 1 BGG",
        "Art. 90 BGG",
        "Art. 95 BGG",
        "Art. 97 Abs. 1 BGG",
        "Art. 105 Abs. 1 BGG",
        "Art. 106 Abs. 2 BGG",
        "Art. 100 Abs. 1 BGG",
      ]),
    );
    expect(federal!.notes[0]).toContain("erreicht die Streitwertgrenze von CHF 30 000");
    expect(federal!.rules.every((rule) => rule.excerpt.length > 20)).toBe(true);
  });

  it("indica que bajo CHF 30 000 solo cabe el recurso con cuestion de principio", () => {
    const routes = selectProceduralRoutes({
      area: "civil",
      text: "Beschwerde an das Bundesgericht",
      claimsText: "Zahlung CHF 12 000",
    });
    const federal = routes.find((r) => r.id === "federal-appeal");
    expect(federal!.notes[0]).toContain("Rechtsfrage von grundsätzlicher Bedeutung");
  });

  it("añade la ruta tributaria del DBG (Einsprache, Rekurskommission, Bundesgericht) con extractos literales", () => {
    const routes = selectProceduralRoutes({
      area: "tax",
      text: "Veranlagungsverfügung direkte Bundessteuer 2025, Abzug von Liegenschaftsunterhaltskosten",
    });
    const tax = routes.find((r) => r.id === "tax-assessment");
    expect(tax).toBeDefined();
    expect(tax!.rules.map((rule) => rule.provision)).toEqual(
      expect.arrayContaining([
        "Art. 132 Abs. 1 DBG",
        "Art. 132 Abs. 3 DBG",
        "Art. 133 Abs. 1 DBG",
        "Art. 140 Abs. 1 DBG",
        "Art. 146 DBG",
        "Art. 100 Abs. 1 BGG",
      ]),
    );
    expect(tax!.rules.find((r) => r.provision === "Art. 132 Abs. 1 DBG")!.excerpt).toContain(
      "innert 30 Tagen nach Zustellung",
    );
    expect(tax!.deadlines.map((d) => d.description)).toEqual([
      "Einsprache gegen die Veranlagungsverfügung",
      "Beschwerde an die kantonale Steuerrekurskommission",
      "Beschwerde an das Bundesgericht",
    ]);
    // un caso tributario no recibe las reglas de una reclamacion civil
    expect(routes.some((r) => r.id === "civil-claim")).toBe(false);
  });

  it("sin mencion del Tribunal Federal no añade la ruta federal", () => {
    const routes = selectProceduralRoutes({ area: "civil", text: "Forderung CHF 5 000" });
    expect(routes.some((r) => r.id === "federal-appeal")).toBe(false);
  });

  it("Kaufstreit über CHF 100 000 nennt den Verzicht auf die Schlichtung", () => {
    const routes = selectProceduralRoutes({ area: "civil", text: "Kauf, CHF 120 000" });
    const provisions = routes.flatMap((r) => r.rules.map((rule) => rule.provision));
    expect(provisions).toContain("Art. 199 Abs. 1 ZPO");
    expect(routes.map((r) => r.id)).toContain("sale-defects");
  });
});
