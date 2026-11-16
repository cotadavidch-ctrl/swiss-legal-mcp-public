import { describe, expect, it } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createLogger, loadEnv } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { buildRegistries } from "../src/registry.js";
import {
  analyzeSubmissions,
  composeBriefSkeleton,
  extractNumbers,
  actDatesIn,
  findImpossibleDateRanges,
  officialExcerpt,
  segmentDocument,
  type AnalyzerInput,
} from "../src/tools/opposingSubmissionAnalyzer.js";

// Escrito sintetico de la parte contraria (no corresponde a ningun caso real).
const OPPOSING = `Klageantwort der Beklagten

1. Der Kläger war vom 1. März 2023 bis zum 30. Juni 2024 bei der Beklagten angestellt. Das Arbeitsverhältnis wurde ordentlich gekündigt.

2. Der monatliche Bruttolohn des Klägers betrug CHF 5'200. Die Beklagte hat den Lohn pünktlich bezahlt (Beilage 3).

3. Die Beklagte räumt ein, dass der Kläger im Mai 2024 während drei Wochen krankgeschrieben war. Die Kündigung erfolgte dennoch nicht während einer Sperrfrist.

4. Die Beklagte hat dem Kläger sämtliche Überstunden vollständig mit 120 Stunden Freizeit kompensiert.

5. Der monatliche Bruttolohn des Klägers betrug CHF 4'800. Die Beklagte hat den Lohn nie verspätet überwiesen.

6. Eventualiter räumt die Beklagte ein, dass der Kläger Anspruch auf Überstundenentschädigung hätte.

7. Der Kläger macht geltend, die Kündigung sei unbestritten missbräuchlich gewesen.`;

const SECOND = `Duplik der Beklagten

1. Der Kläger war nicht krankgeschrieben im Mai 2024 während drei Wochen.

2. Die Kündigung vom 15. Juni 2024 erfolgte ordentlich.`;

const OWN = `Replik des Klägers

1. Der monatliche Bruttolohn betrug CHF 5'200 pro Monat im Jahr 2023.

2. Der monatliche Bruttolohn betrug CHF 6'000 pro Monat im Jahr 2023.

3. Der Kläger räumt ein, dass er die Frist verpasst hat.`;

const base: Omit<AnalyzerInput, "documents"> = {
  procedureFamily: "zpo",
  outputLanguage: "de",
  maxFindings: 50,
};

function run(extra: Partial<AnalyzerInput> = {}) {
  return analyzeSubmissions({
    ...base,
    documents: [
      { id: "ka", label: "Klageantwort", author: "opposing_party", text: OPPOSING },
      { id: "dup", label: "Duplik", author: "opposing_party", text: SECOND },
    ],
    ...extra,
  });
}

describe("segmentacion", () => {
  it("cada frase es una subcadena EXACTA del original en su posicion", () => {
    const st = segmentDocument(
      { id: "ka", label: "Klageantwort", author: "opposing_party", text: OPPOSING },
      0,
    );
    expect(st.length).toBeGreaterThan(8);
    for (const s of st) expect(OPPOSING.slice(s.offset, s.offset + s.text.length)).toBe(s.text);
  });

  it("no corta en abreviaturas ni en fechas con mes escrito", () => {
    const text =
      "1. Gemäss Art. 336c Abs. 1 lit. b OR gilt die Sperrfrist ab dem 1. März 2023 vollumfänglich.";
    const st = segmentDocument({ id: "x", label: "X", author: "opposing_party", text }, 0);
    expect(st).toHaveLength(1);
    expect(st[0]!.marker).toBe("1");
    expect(st[0]!.location).toBe("X, Rz. 1");
  });
});

describe("extractNumbers", () => {
  it("normaliza importes, fechas y plazos", () => {
    const n = extractNumbers("Lohn CHF 5'200.50 seit dem 1. März 2023, Frist von 30 Tagen, 10 %.");
    expect([...(n.get("amount") ?? [])]).toEqual(["5200.50"]);
    expect([...(n.get("date") ?? [])]).toEqual(["2023-03-01"]);
    expect([...(n.get("days") ?? [])]).toEqual(["30"]);
    expect([...(n.get("percent") ?? [])]).toEqual(["10.00"]);
  });
});

describe("hallazgos contra la contraparte", () => {
  it("detecta la admision firme y NO trata como firmes la eventual ni la atribuida", () => {
    const { findings } = run();
    const adm = findings.filter((f) => f.type === "admission");
    const firm = adm.find((f) => f.passages[0]!.text.includes("krankgeschrieben"));
    expect(firm?.strength).toBe("high");
    const eventual = adm.find((f) => f.passages[0]!.text.includes("Überstundenentschädigung"));
    expect(eventual?.strength).toBe("low");
    expect(eventual?.caveats.join(" ")).toContain("eventual");
    const reported = adm.find((f) => f.passages[0]!.text.includes("macht geltend"));
    expect(reported?.strength).toBe("low");
    expect(reported?.caveats.join(" ")).toContain("atribuye");
  });

  it("detecta importes distintos para el mismo concepto dentro del escrito", () => {
    const { findings } = run();
    const c = findings.find(
      (f) =>
        f.type === "contradiction_within_document" &&
        f.passages.some((p) => p.text.includes("5'200")) &&
        f.passages.some((p) => p.text.includes("4'800")),
    );
    expect(c).toBeDefined();
    expect(c!.why).toContain("amount");
    expect(c!.draftRebuttal).toContain("5'200");
    expect(c!.draftRebuttal).toContain("4'800");
    expect(c!.draftRebuttal).toContain("Art. 2 Abs. 1 ZGB");
    expect(c!.draftRebuttal).toContain("Art. 52 ZPO");
    expect(c!.draftRebuttal).toContain("[PRÜFEN");
  });

  it("detecta que la duplica niega lo que la contestacion admitio", () => {
    const { findings } = run();
    const c = findings.find(
      (f) =>
        f.type === "contradiction_between_documents" &&
        f.passages.some((p) => p.docId === "dup") &&
        f.passages.some((p) => p.docId === "ka" && p.text.includes("krankgeschrieben")),
    );
    expect(c).toBeDefined();
  });

  it("detecta contradiccion con el expediente y cita la fuente", () => {
    const { findings } = run({
      recordFacts: [
        {
          id: "Beilage 1",
          statement:
            "Der monatliche Bruttolohn des Klägers betrug CHF 6'000 gemäss Arbeitsvertrag.",
          source: "Arbeitsvertrag vom 1. März 2023",
        },
      ],
    });
    const r = findings.find((f) => f.type === "contradicted_by_record");
    expect(r?.record?.id).toBe("Beilage 1");
    expect(r?.draftRebuttal).toContain("Arbeitsvertrag");
    expect(r?.draftRebuttal).toContain("bestritten");
  });

  it("marca afirmaciones absolutas y sin medio de prueba", () => {
    const { findings } = run();
    expect(findings.some((f) => f.type === "absolute_assertion")).toBe(true);
    expect(
      findings.some(
        (f) =>
          f.type === "unsubstantiated_assertion" && f.passages[0]!.text.includes("120 Stunden"),
      ),
    ).toBe(true);
    // el parrafo 2 cita la Beilage 3: no debe marcarse como sin prueba
    expect(
      findings.some(
        (f) => f.type === "unsubstantiated_assertion" && f.passages[0]!.text.includes("pünktlich"),
      ),
    ).toBe(false);
  });

  it("toda cita de un hallazgo es literal y esta en su posicion", () => {
    const { findings } = run();
    const texts: Record<string, string> = { ka: OPPOSING, dup: SECOND };
    for (const f of findings) {
      for (const p of f.passages) {
        expect(texts[p.docId]!.slice(p.offset, p.offset + p.text.length)).toBe(p.text);
        expect(f.draftRebuttal.replace(/\s+/g, " ")).toContain(
          p.text.replace(/\s+/g, " ").slice(0, 60),
        );
      }
    }
  });

  it("ordena por fuerza y respeta maxFindings", () => {
    const all = run().findings;
    const rank = { high: 0, medium: 1, low: 2 } as const;
    for (let i = 1; i < all.length; i += 1) {
      expect(rank[all[i - 1]!.strength]).toBeLessThanOrEqual(rank[all[i]!.strength]);
    }
    const limited = run({ maxFindings: 2 });
    expect(limited.findings).toHaveLength(2);
    expect(limited.warnings.join(" ")).toContain("maxFindings");
  });
});

describe("marco procesal e idioma", () => {
  it("fuera de la ZPO no cita normas de la ZPO y recuerda el Untersuchungsgrundsatz", () => {
    const { findings } = run({ procedureFamily: "administrative" });
    const adm = findings.find((f) => f.type === "admission")!;
    expect(adm.draftRebuttal).not.toContain("ZPO");
    expect(adm.draftRebuttal).toContain("Art. 12 VwVG");
  });

  it("redacta en frances con la numeracion del CPC", () => {
    const { findings } = run({ outputLanguage: "fr" });
    const adm = findings.find((f) => f.type === "admission")!;
    expect(adm.draftRebuttal).toContain("La partie adverse admet elle-même");
    expect(adm.draftRebuttal).toContain("art. 150 al. 1 CPC");
  });

  it("el idioma italiano cae a alemán con aviso", () => {
    const out = run({ outputLanguage: "it" });
    expect(out.warnings.join(" ")).toContain("alemán");
  });
});

describe("escrito propio", () => {
  it("avisa de contradicciones y admisiones propias antes de presentar", () => {
    const out = analyzeSubmissions({
      ...base,
      documents: [
        { id: "ka", label: "Klageantwort", author: "opposing_party", text: OPPOSING },
        { id: "own", label: "Replik", author: "own_party", text: OWN },
      ],
    });
    expect(out.exposure.some((e) => e.type === "own_contradiction")).toBe(true);
    expect(out.exposure.some((e) => e.type === "own_admission")).toBe(true);
    expect(
      out.findings
        .filter((f) => f.type !== "unanswered_allegation")
        .every((f) => f.passages.every((p) => p.docId !== "own")),
    ).toBe(true);
  });
});

describe("analyze_opposing_submission via MCP", () => {
  it("esta registrada, valida la entrada y devuelve el analisis", async () => {
    const { providers, legislationProviders, tools } = buildRegistries(
      loadEnv({ NODE_ENV: "test" }),
    );
    const server = createMcpServer({
      name: "t",
      version: "0.0.0",
      tools,
      providers,
      legislationProviders,
      logger: createLogger({ level: "silent" }),
    });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "c", version: "0.0.0" });
    await Promise.all([client.connect(ct), server.connect(st)]);
    expect((await client.listTools()).tools.map((t) => t.name)).toContain(
      "analyze_opposing_submission",
    );

    const ok = await client.callTool({
      name: "analyze_opposing_submission",
      arguments: {
        documents: [{ id: "ka", label: "Klageantwort", author: "opposing_party", text: OPPOSING }],
        verifyAuthorities: false,
      },
    });
    const out = ok.structuredContent as {
      status: string;
      summary: { admissions: number };
      requiresHumanReview: boolean;
    };
    expect(out.status).toBe("analyzed");
    expect(out.summary.admissions).toBeGreaterThanOrEqual(1);
    expect(out.requiresHumanReview).toBe(true);

    const bad = await client.callTool({
      name: "analyze_opposing_submission",
      arguments: { documents: [{ id: "own", author: "own_party", text: OWN }] },
    });
    const own = bad.structuredContent as {
      status: string;
      mode: string;
      briefSkeleton: string | null;
      warnings: string[];
    };
    expect(own.status).toBe("analyzed");
    expect(own.mode).toBe("own_submission_review");
    expect(own.briefSkeleton).toBeNull();
    expect(own.warnings.join(" ")).toContain("Sin escrito contrario");
    const dup = await client.callTool({
      name: "analyze_opposing_submission",
      arguments: {
        documents: [
          { id: "x", author: "own_party", text: OWN },
          { id: "x", author: "opposing_party", text: OPPOSING },
        ],
      },
    });
    expect((dup.structuredContent as { status: string }).status).toBe("invalid_input");
  });
});

describe("calidad de los borradores (hallazgos de la auditoria externa)", () => {
  it("una admision eventual NO se redacta como hecho no controvertido", () => {
    const { findings } = run();
    const ev = findings.find(
      (f) => f.type === "admission" && f.passages[0]!.text.includes("Überstundenentschädigung"),
    )!;
    expect(ev.draftRebuttal).toContain("eventualiter");
    expect(ev.draftRebuttal).toContain("kein Zugeständnis");
    expect(ev.draftRebuttal).not.toContain("nicht streitig");
    expect(ev.draftRebuttal).not.toContain("Art. 150");
  });

  it("una frase atribuida a otra persona no genera borrador de admision", () => {
    const { findings } = run();
    const rep = findings.find(
      (f) => f.type === "admission" && f.passages[0]!.text.includes("macht geltend"),
    )!;
    expect(rep.draftRebuttal).toContain("NICHT ALS ZUGESTÄNDNIS VERWENDEN");
    expect(rep.draftRebuttal).not.toContain("räumt");
  });

  it("los borradores no contienen español (solo el idioma de salida)", () => {
    for (const lang of ["de", "fr"] as const) {
      const { findings } = run({
        outputLanguage: lang,
        recordFacts: [
          {
            id: "Beilage 1",
            statement:
              "Der monatliche Bruttolohn des Klägers betrug CHF 6'000 gemäss Arbeitsvertrag.",
          },
        ],
      });
      for (const f of findings) {
        expect(f.draftRebuttal).not.toMatch(/ frente a |una frase|mismas palabras/);
      }
    }
    const de = run().findings.find((f) => f.type === "contradiction_within_document")!;
    expect(de.draftRebuttal).toContain("Betrag: 5200.00 gegenüber 4800.00");
    const fr = run({ outputLanguage: "fr" }).findings.find(
      (f) => f.type === "contradiction_within_document",
    )!;
    expect(fr.draftRebuttal).toContain("montant : 5200.00 contre 4800.00");
  });

  it("la admision contradicha en otro escrito lleva el aviso de posible retirada", () => {
    const { findings } = run();
    const adm = findings.find(
      (f) => f.type === "admission" && f.passages[0]!.text.includes("krankgeschrieben"),
    )!;
    expect(adm.strength).toBe("high");
    expect(adm.caveats.join(" ")).toContain("retirado");
  });

  it("officialExcerpt recorta al apartado correspondiente y no deja palabras partidas", () => {
    const closest =
      "Art. 41 1 Wer einem andern widerrechtlich Schaden zufügt, sei es mit Absicht, sei es aus Fahrlässigkeit, wird ihm zum Ersatze verpflichtet. 2 Ebenso ist zum Ersatze verpflichtet, wer einem andern in einer gegen die guten Sitten verstossenden W…";
    const quote =
      "Wer einem andern widerrechtlich Schaden zufügt, sei es mit Absicht, sei es aus Fahrlässigkeit, wird ihm zum Schadenersatz verpflichtet";
    expect(officialExcerpt(closest, quote)).toBe(
      "Wer einem andern widerrechtlich Schaden zufügt, sei es mit Absicht, sei es aus Fahrlässigkeit, wird ihm zum Ersatze verpflichtet.",
    );
    expect(officialExcerpt(null, quote)).toBeNull();
    const unclosed = officialExcerpt(
      "Wer einem andern widerrechtlich Schaden zufügt und noch viel mehr Text ohne Ende",
      quote,
    );
    expect(unclosed).not.toMatch(/\w…$/);
  });
});

describe("hechos propios sin contestar (Art. 222 Abs. 2 / 150 Abs. 1 ZPO)", () => {
  const ANSWER = `Klageantwort der Beklagten

1. Der Kläger war vom 1. März 2023 bis 30. Juni 2024 angestellt. Das Arbeitsverhältnis wurde ordentlich gekündigt.

2. Die Beklagte hat den Lohn pünktlich bezahlt (Beilage 3).`;
  const OWN_CLAIM = `Klage des Klägers

1. Der Kläger hat im Jahr 2023 insgesamt 240 Überstunden geleistet, die ihm nie vergütet wurden.

2. Der Kläger war vom 1. März 2023 bis 30. Juni 2024 angestellt.`;

  const go = (family: AnalyzerInput["procedureFamily"], answer = ANSWER) =>
    analyzeSubmissions({
      ...base,
      procedureFamily: family,
      documents: [
        { id: "ka", label: "Klageantwort", author: "opposing_party", text: answer },
        { id: "kl", label: "Klage", author: "own_party", text: OWN_CLAIM },
      ],
    });

  it("marca el hecho que la contraparte no contesta y no el que si contesta", () => {
    const una = go("zpo").findings.filter((f) => f.type === "unanswered_allegation");
    expect(una).toHaveLength(1);
    expect(una[0]!.passages[0]!.text).toContain("240 Überstunden");
    expect(una[0]!.strength).toBe("medium");
    expect(una[0]!.draftRebuttal).toContain("Art. 222 Abs. 2 ZPO");
    expect(una[0]!.draftRebuttal).toContain("Art. 150 Abs. 1 ZPO");
    expect(una[0]!.draftRebuttal).toContain("[PRÜFEN");
  });

  it("con una bestreiten general baja la fuerza y pide verificar si basta", () => {
    const una = go(
      "zpo",
      `${ANSWER}\n\n3. Sämtliche Behauptungen des Klägers, die nicht ausdrücklich anerkannt werden, werden bestritten.`,
    ).findings.filter((f) => f.type === "unanswered_allegation");
    expect(una[0]!.strength).toBe("low");
    expect(una[0]!.reviewQuestions.join(" ")).toContain("cláusula general");
  });

  it("fuera de la ZPO no se aplica", () => {
    expect(go("administrative").findings.some((f) => f.type === "unanswered_allegation")).toBe(
      false,
    );
  });
});

describe("resumen de admisiones", () => {
  it("separa las admisiones aprovechables de las candidatas de baja confianza", async () => {
    const { providers, legislationProviders, tools } = buildRegistries(
      loadEnv({ NODE_ENV: "test" }),
    );
    const server = createMcpServer({
      name: "t",
      version: "0.0.0",
      tools,
      providers,
      legislationProviders,
      logger: createLogger({ level: "silent" }),
    });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "c", version: "0.0.0" });
    await Promise.all([client.connect(ct), server.connect(st)]);
    const r = await client.callTool({
      name: "analyze_opposing_submission",
      arguments: {
        documents: [{ id: "ka", label: "Klageantwort", author: "opposing_party", text: OPPOSING }],
        verifyAuthorities: false,
      },
    });
    const sum = (r.structuredContent as { summary: Record<string, number> }).summary;
    expect(sum.admissions).toBe(1);
    expect(sum.admissionCandidatesLowConfidence).toBe(2);
  });
});

describe("supuestos distintos no son contradiccion", () => {
  it("plazos de años de servicio distintos no se marcan como contradiccion", () => {
    const out = analyzeSubmissions({
      ...base,
      documents: [
        {
          id: "ka",
          label: "Klageantwort",
          author: "opposing_party",
          text: `Klageantwort

1. Gemäss Art. 336c Abs. 1 lit. b OR beträgt die Sperrfrist im zweiten Dienstjahr 90 Tage.

2. Gemäss Art. 336c Abs. 1 lit. b OR beträgt die Sperrfrist im ersten Dienstjahr 30 Tage.`,
        },
      ],
    });
    expect(out.findings.some((f) => f.type.startsWith("contradiction"))).toBe(false);
  });

  it("el mismo supuesto con cifras distintas sigue marcandose", () => {
    const out = analyzeSubmissions({
      ...base,
      documents: [
        {
          id: "ka",
          label: "Klageantwort",
          author: "opposing_party",
          text: `Klageantwort

1. Gemäss Art. 336c Abs. 1 lit. b OR beträgt die Sperrfrist im ersten Dienstjahr 60 Tage.

2. Gemäss Art. 336c Abs. 1 lit. b OR beträgt die Sperrfrist im ersten Dienstjahr 30 Tage.`,
        },
      ],
    });
    expect(out.findings.some((f) => f.type === "contradiction_within_document")).toBe(true);
  });
});

describe("esqueleto del escrito de replica", () => {
  it("ordena por secciones, numera los parrafos y excluye lo no utilizable o de fuerza baja", () => {
    const { findings } = run({
      recordFacts: [
        {
          id: "Beilage 1",
          statement:
            "Der monatliche Bruttolohn des Klägers betrug CHF 6'000 gemäss Arbeitsvertrag.",
        },
      ],
    });
    const brief = composeBriefSkeleton(findings, "de", false);
    expect(brief.text.startsWith("ENTWURF: nicht einreichungsreif")).toBe(true);
    expect(brief.text).toContain("I. Zu den Zugeständnissen der Gegenpartei");
    expect(brief.text).toContain("II. Zu den Widersprüchen in den Vorbringen der Gegenpartei");
    expect(brief.text).toMatch(/\n\n1\. Die Gegenpartei räumt/);
    // la frase atribuida a otra persona nunca entra, ni siquiera con includeLow
    expect(brief.text).not.toContain("NICHT ALS ZUGESTÄNDNIS");
    const withLow = composeBriefSkeleton(findings, "de", true);
    expect(withLow.included.length).toBeGreaterThan(brief.included.length);
    expect(withLow.text).not.toContain("NICHT ALS ZUGESTÄNDNIS");
    expect(withLow.excluded.some((e) => e.reason.includes("no utilizable"))).toBe(true);
    // los hallazgos de fuerza baja excluidos lo dicen
    expect(brief.excluded.some((e) => e.reason.includes("fuerza baja"))).toBe(true);
  });

  it("en frances usa los titulos y el aviso franceses", () => {
    const { findings } = run({ outputLanguage: "fr" });
    const brief = composeBriefSkeleton(findings, "fr", false);
    expect(brief.text.startsWith("PROJET : non prêt à être déposé")).toBe(true);
    expect(brief.text).toContain("Sur les aveux de la partie adverse");
  });

  it("sin hallazgos suficientes lo dice en lugar de inventar contenido", () => {
    const brief = composeBriefSkeleton([], "de", false);
    expect(brief.included).toHaveLength(0);
    expect(brief.text).toContain("Keine Feststellung");
  });

  it("la herramienta MCP devuelve el esqueleto y respeta composeBrief=false", async () => {
    const { providers, legislationProviders, tools } = buildRegistries(
      loadEnv({ NODE_ENV: "test" }),
    );
    const server = createMcpServer({
      name: "t",
      version: "0.0.0",
      tools,
      providers,
      legislationProviders,
      logger: createLogger({ level: "silent" }),
    });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "c", version: "0.0.0" });
    await Promise.all([client.connect(ct), server.connect(st)]);
    const args = {
      documents: [{ id: "ka", label: "Klageantwort", author: "opposing_party", text: OPPOSING }],
      verifyAuthorities: false,
    };
    const on = (await client.callTool({ name: "analyze_opposing_submission", arguments: args }))
      .structuredContent as { briefSkeleton: string | null; briefIncludedFindingIds: string[] };
    expect(on.briefSkeleton).toContain("ENTWURF");
    expect(on.briefIncludedFindingIds.length).toBeGreaterThan(0);
    const off = (
      await client.callTool({
        name: "analyze_opposing_submission",
        arguments: { ...args, composeBrief: false },
      })
    ).structuredContent as { briefSkeleton: string | null };
    expect(off.briefSkeleton).toBeNull();
  });
});

describe("admision retirada en un escrito posterior", () => {
  it("la contradiccion entre escritos que afecta a una admision pasa a fuerza media y entra en el esqueleto", () => {
    const { findings } = run();
    const c = findings.find(
      (f) =>
        f.type === "contradiction_between_documents" && f.passages.some((p) => p.docId === "dup"),
    )!;
    expect(c.strength).toBe("medium");
    expect(c.why).toContain("retirado");
    const brief = composeBriefSkeleton(findings, "de", false);
    expect(brief.included).toContain(c.id);
    expect(brief.text).toContain("Duplik, Rz. 1");
  });
});

describe("hechos sin contestar: una mencion tangencial no cuenta como respuesta", () => {
  it("una frase eventual sobre el derecho no contesta el numero de horas ni el impago", () => {
    const out = analyzeSubmissions({
      ...base,
      documents: [
        {
          id: "kl",
          label: "Klage",
          author: "own_party",
          text: `Klage des Klägers

1. Der Kläger hat im Jahr 2023 insgesamt 240 Überstunden geleistet, die ihm nie vergütet wurden.

2. Der Kläger war vom 1. März 2023 bis 30. Juni 2024 angestellt.`,
        },
        {
          id: "ka",
          label: "Klageantwort",
          author: "opposing_party",
          text: `Klageantwort der Beklagten

1. Der Kläger war vom 1. März 2023 bis 30. Juni 2024 angestellt. Das Arbeitsverhältnis wurde ordentlich gekündigt.

2. Eventualiter räumt die Beklagte ein, dass der Kläger Anspruch auf Überstundenentschädigung hätte.`,
        },
      ],
    });
    const una = out.findings.filter((f) => f.type === "unanswered_allegation");
    expect(una).toHaveLength(1);
    expect(una[0]!.passages[0]!.text).toContain("240 Überstunden");
    // muestra la frase mas parecida para que la persona juzgue
    expect(una[0]!.why).toContain("La frase más parecida es");
    expect(una[0]!.why).toContain("Überstundenentschädigung");
  });
});

describe("periodos con el final antes del principio", () => {
  it("detecta el rango imposible y respeta los validos", () => {
    expect(
      findImpossibleDateRanges("eine Notunterkunft vom 28.03.2024 bis 03.03.2024 finanziert"),
    ).toEqual([{ start: "2024-03-28", end: "2024-03-03" }]);
    expect(findImpossibleDateRanges("vom 1. März 2023 bis 30. Juni 2024 angestellt")).toEqual([]);
    expect(findImpossibleDateRanges("vom 28.03.2024 bis zum 28.03.2024")).toEqual([]);
    expect(findImpossibleDateRanges("du 28.03.2024 au 03.03.2024")).toEqual([
      { start: "2024-03-28", end: "2024-03-03" },
    ]);
    expect(findImpossibleDateRanges("vom 5. April 2024 bis 2. April 2024")).toEqual([
      { start: "2024-04-05", end: "2024-04-02" },
    ]);
  });

  it("genera un hallazgo contra la contraparte, con borrador y entra en el esqueleto", () => {
    const out = analyzeSubmissions({
      ...base,
      documents: [
        {
          id: "v",
          label: "Vernehmlassung",
          author: "opposing_party",
          text: "Vernehmlassung\n\n11. Die Behörde hat eine Notunterkunft vom 28.03.2024 bis 03.03.2024 finanziert.",
        },
      ],
    });
    const f = out.findings.find((x) => x.type === "impossible_date_range")!;
    expect(f).toBeDefined();
    expect(f.draftRebuttal).toContain(
      "Enddatum (2024-03-03) liegt vor dem Anfangsdatum (2024-03-28)",
    );
    expect(f.draftRebuttal).toContain("[PRÜFEN");
    const brief = composeBriefSkeleton(out.findings, "de", false);
    expect(brief.included).toContain(f.id);
    expect(brief.text).toContain("Zu den Widersprüchen");
  });

  it("en el escrito propio avisa de corregirlo antes de presentar", () => {
    const out = analyzeSubmissions({
      ...base,
      documents: [
        { id: "ka", label: "Gegenschrift", author: "opposing_party", text: OPPOSING },
        {
          id: "own",
          label: "Replik",
          author: "own_party",
          text: "Replik\n\n1. Der Kläger war vom 30. Juni 2024 bis 1. März 2023 bei der Beklagten angestellt.",
        },
      ],
    });
    expect(out.exposure.some((e) => e.type === "impossible_date_range")).toBe(true);
    expect(out.findings.some((f) => f.type === "impossible_date_range")).toBe(false);
  });
});

describe("la misma resolucion con dos fechas", () => {
  const analyze = (author: "own_party" | "opposing_party", a: string, b: string) =>
    analyzeSubmissions({
      ...base,
      documents: [
        ...(author === "own_party"
          ? [{ id: "ka", label: "Gegenschrift", author: "opposing_party" as const, text: OPPOSING }]
          : []),
        { id: "x", label: "Eingabe", author, text: `Eingabe\n\n1. ${a}\n\n2. ${b}` },
      ],
    });

  it("extrae la resolucion con su autoridad y fecha", () => {
    expect(
      actDatesIn(
        "Die Verfügung des Kantonsgerichts Musterkanton vom 9. April 2024 wird angefochten",
      ),
    ).toEqual([{ key: "verfügung|kantonsgerichts musterkanton", iso: "2024-04-09" }]);
  });

  it("en el escrito propio avisa del conflicto de fechas", () => {
    const out = analyze(
      "own_party",
      "Angefochten wird die Verfügung des Kantonsgerichts Musterkanton vom 9. April 2024.",
      "Die Verfügung des Kantonsgerichts Musterkanton vom 8. April 2024 sei aufzuheben.",
    );
    expect(
      out.exposure.some((e) => e.type === "own_contradiction" && e.why.includes("2024-04-09")),
    ).toBe(true);
  });

  it("en el escrito contrario genera un hallazgo de fuerza baja con el aviso de resoluciones distintas", () => {
    const out = analyze(
      "opposing_party",
      "Die Verfügung des Bezirksgerichts Bern vom 9. April 2024 ist rechtskräftig geworden.",
      "Die Verfügung des Bezirksgerichts Bern vom 8. April 2024 wurde der Beklagten zugestellt.",
    );
    const f = out.findings.find((x) => x.why.includes("dos fechas distintas"))!;
    expect(f.strength).toBe("low");
    expect(f.caveats.join(" ")).toContain("resoluciones distintas");
    expect(f.draftRebuttal).toContain("Datum: 2024-04-09 gegenüber 2024-04-08");
  });

  it("autoridades distintas o la misma fecha no se marcan", () => {
    const differentAuthority = analyze(
      "opposing_party",
      "Die Verfügung des Kantonsgerichts Beispielstadt vom 12. Februar 2024 forderte weitere Unterlagen.",
      "Die Verfügung des Bezirksgerichts Bern vom 9. April 2024 wies das Gesuch ab.",
    );
    expect(differentAuthority.findings.some((x) => x.why.includes("dos fechas distintas"))).toBe(
      false,
    );
    const sameDate = analyze(
      "opposing_party",
      "Die Verfügung des Bezirksgerichts Bern vom 9. April 2024 ist rechtskräftig geworden.",
      "Gegen die Verfügung des Bezirksgerichts Bern vom 9. April 2024 wurde kein Rechtsmittel ergriffen.",
    );
    expect(sameDate.findings.some((x) => x.why.includes("dos fechas distintas"))).toBe(false);
  });
});

describe("ubicaciones por seccion en escritos sin numerar", () => {
  const TEXT = `Replik

I. VORBEMERKUNGEN

Die Rechtsbegehren werden aufrechterhalten und die Vernehmlassung wird bestritten.

II. ZUM GEGENSTAND DES VERFAHRENS

Die Beklagte hat am 27. Februar 2024 ein Gesuch um Nothilfe erhalten.

Die Beklagte hat am 2. März 2024 darauf nicht geantwortet.

# **III.  ZUR BEWEISFRAGE**

Die Rechnungen belegen nur die Kosten und nicht das Verwaltungshandeln der Behörde.`;

  it("indica la seccion y el parrafo dentro de ella", () => {
    const st = segmentDocument({ id: "r", label: "Replik", author: "own_party", text: TEXT }, 0);
    expect(st.map((s) => s.location)).toEqual([
      "Replik, Abschnitt I, Abs. 1",
      "Replik, Abschnitt II, Abs. 1",
      "Replik, Abschnitt II, Abs. 2",
      "Replik, Abschnitt III, Abs. 1",
    ]);
  });

  it("los encabezados no se analizan como frases y las frases siguen siendo literales", () => {
    const st = segmentDocument({ id: "r", label: "Replik", author: "own_party", text: TEXT }, 0);
    expect(st.some((s) => /VORBEMERKUNGEN|ZUM GEGENSTAND/.test(s.text))).toBe(false);
    for (const s of st) expect(TEXT.slice(s.offset, s.offset + s.text.length)).toBe(s.text);
  });

  it("una frase normal que empieza por mayuscula no se confunde con un encabezado", () => {
    const st = segmentDocument(
      {
        id: "r",
        label: "X",
        author: "own_party",
        text: "X\n\nDer Beschwerdeführer bestreitet den Grundsatz nicht, wonach auf den Zeitpunkt der Gesuchseinreichung abzustellen ist.",
      },
      0,
    );
    expect(st).toHaveLength(1);
    expect(st[0]!.location).toBe("X, Abs. 1");
  });
});

describe("calibracion con escritos reales: estructura que no es contradiccion", () => {
  const own = (text: string, family: AnalyzerInput["procedureFamily"] = "administrative") =>
    analyzeSubmissions({
      ...base,
      procedureFamily: family,
      documents: [{ id: "o", label: "Replik", author: "own_party", text }],
    });
  const types = (o: ReturnType<typeof own>) => o.exposure.map((e) => e.type);

  it("las filas de una tabla con importes distintos no se comparan", () => {
    const o = own(`Replik

Rechnung Nr. 1 | Sozialdienst Musterkreis | Aufenthalt 28.2.24 | CHF 110.00 | Notschlafstelle

Rechnung Nr. 2 | Sozialdienst Musterkreis | Aufenthalt 2.-3.3.24 | CHF 220.00 | Notschlafstelle`);
    expect(types(o)).not.toContain("own_contradiction");
  });

  it("las entradas de la lista de anexos con importes distintos no se comparan", () => {
    const o = own(
      `Beschwerde

Beilage 2: Buchungsdetail Privatkonto Migros Bank Überweisung von CHF 2'650 an das Sparkonto, 05.02.2024.

Beilage 3: Buchungsdetail Sparkonto Migros Bank Zahlung von CHF 2'640 an Alpian, 05.02.2024.`,
      "zpo",
    );
    expect(types(o)).not.toContain("own_contradiction");
  });

  it("las peticiones y los apartados de lista no se toman por afirmaciones contradictorias", () => {
    const o = own(`Rekurs

Es sei festzustellen, dass der Rekurrent am 27. Februar 2024 ein Gesuch um Nothilfe gestellt hat und diese Verfügung ausdrücklich verlangt wurde.

Es sei festzustellen, dass die Vorinstanz die beantragte Nothilfe nicht in einer formellen Verfügung beantwortet hat und diese Verfügung ausdrücklich verlangt wurde.

d. der formelle Akt, welcher der Stellenleitung die Verfügungskompetenz für diese Verfügung übertragen hat.

Im Dossier wurde kein formeller Akt gefunden, welcher der Stellenleitung die Verfügungskompetenz für diese Verfügung übertragen hat.`);
    expect(types(o)).not.toContain("own_contradiction");
  });

  it("citar el error de la contraparte no se marca como error propio", () => {
    const o = own(`Replik

Die Vernehmlassung behauptet, die Behörde habe eine Notunterkunft «vom 28.03.2024 bis 03.03.2024» finanziert, ein chronologisch unmöglicher Zeitraum.`);
    expect(types(o)).not.toContain("impossible_date_range");
    // pero el mismo error en el escrito contrario si es un hallazgo
    const opp = analyzeSubmissions({
      ...base,
      documents: [
        {
          id: "v",
          label: "Vernehmlassung",
          author: "opposing_party",
          text: "Vernehmlassung\n\n11. Die Behörde hat eine Notunterkunft vom 28.03.2024 bis 03.03.2024 finanziert.",
        },
      ],
    });
    expect(opp.findings.some((f) => f.type === "impossible_date_range")).toBe(true);
  });

  it("en el escrito propio, 'la Vorinstanz anerkennt' no es una admision nuestra pero 'der Rekurrent anerkennt' si", () => {
    const o = own(`Replik

Die Vorinstanz anerkennt in ihrer Vernehmlassung selbst, dass gegebenenfalls ein Anspruch auf Hilfe in Notlagen besteht.

Mit ihr hat die Behörde zeitgleich anerkannt, dass ein spezifischer Antrag auf Erlass einer Verfügung gestellt worden war.

Der Rekurrent anerkennt, dass Nothilfe ihrem Wesen nach Hilfe in einer aktuellen Notlage ist.`);
    const adm = o.exposure.filter((e) => e.type === "own_admission");
    expect(adm).toHaveLength(1);
    expect(adm[0]!.passages[0]!.text).toContain("Der Rekurrent anerkennt");
  });

  it("la contradiccion real entre afirmaciones sigue detectandose tras la calibracion", () => {
    const o = own(`Replik

Der monatliche Bruttolohn des Rekurrenten betrug CHF 5'200 gemäss Arbeitsvertrag.

Der monatliche Bruttolohn des Rekurrenten betrug CHF 4'800 gemäss Arbeitsvertrag.`);
    expect(types(o)).toContain("own_contradiction");
  });
});

describe("un par de frases se registra una sola vez", () => {
  const TEXT = `Replik

I. VORBEMERKUNGEN

Die Verfügung des Kantonsgerichts Musterkanton vom 9. April 2024 wird angefochten.

II. ANTRÄGE

Die Verfügung des Kantonsgerichts Musterkanton vom 8. April 2024 sei aufzuheben.`;

  it("en el escrito propio no duplica la discrepancia de fechas de la misma resolucion", () => {
    const o = analyzeSubmissions({
      ...base,
      procedureFamily: "administrative",
      documents: [{ id: "o", label: "Replik", author: "own_party", text: TEXT }],
    });
    expect(o.exposure.filter((e) => e.type === "own_contradiction")).toHaveLength(1);
  });

  it("en el escrito contrario tampoco", () => {
    const o = analyzeSubmissions({
      ...base,
      documents: [{ id: "v", label: "Vernehmlassung", author: "opposing_party", text: TEXT }],
    });
    expect(o.findings.filter((f) => f.type.startsWith("contradiction"))).toHaveLength(1);
  });
});
