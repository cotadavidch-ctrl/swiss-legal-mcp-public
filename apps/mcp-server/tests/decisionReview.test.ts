import { describe, expect, it } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createLogger, loadEnv } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { buildRegistries } from "../src/registry.js";

// Resolucion sintetica propia (no procede de ningun caso de evaluacion).
const DECISION = `Gemeinde Musterdorf, Bauamt

VERFÜGUNG

I. Sachverhalt

1. Die Gesuchstellerin reichte am 3. März 2026 ein Baugesuch ein. Die Gebühr beträgt CHF 1'200.

2. Die Behörde stellte am 20. Februar 2026 fest, dass die Unterlagen unvollständig seien. Die Frist von 10 Tagen lief am 1. März 2026 ab.

II. Erwägungen

1. Die Gesuchstellerin ist ausländische Staatsangehörige. Es ist davon auszugehen, dass sie die Auflagen nicht einhalten wird.

2. Eine Anhörung ist nicht erforderlich.

III. Verfügung

1. Das Baugesuch wird abgelehnt.

2. Die Gesuchstellerin wird verpflichtet, innert 5 Tagen eine Busse zu bezahlen.`;

async function connect() {
  const { providers, legislationProviders, tools } = buildRegistries(loadEnv({ NODE_ENV: "test" }));
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
  return client;
}

describe("prepare_decision_review", () => {
  it("esta registrada y segmenta la resolucion en frases literales numeradas", async () => {
    const client = await connect();
    expect((await client.listTools()).tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(["prepare_decision_review", "verify_review_findings"]),
    );
    const r = await client.callTool({
      name: "prepare_decision_review",
      arguments: { text: DECISION },
    });
    const out = r.structuredContent as {
      status: string;
      statements: { id: string; offset: number; text: string }[];
      keyFacts: { dates: { iso: string }[]; amounts: { value: string }[] };
      checklist: { id: string; category: string; cueStatementIds: string[]; noCueFound: boolean }[];
      verifiedNorms: { citation: string; literalExcerpt: string }[];
      requiresHumanReview: boolean;
    };
    expect(out.status).toBe("prepared");
    expect(out.requiresHumanReview).toBe(true);
    for (const s of out.statements) {
      expect(DECISION.slice(s.offset, s.offset + s.text.length)).toBe(s.text);
    }
    expect(out.statements[0]!.id).toBe("S1");
  });

  it("extrae fechas, importes y plazos para comprobar la coherencia", async () => {
    const client = await connect();
    const r = await client.callTool({
      name: "prepare_decision_review",
      arguments: { text: DECISION },
    });
    const out = r.structuredContent as {
      keyFacts: {
        dates: { iso: string }[];
        amounts: { value: string }[];
        durations: { unit: string; value: string }[];
      };
    };
    const iso = out.keyFacts.dates.map((d) => d.iso);
    expect(iso).toEqual(expect.arrayContaining(["2026-02-20", "2026-03-01", "2026-03-03"]));
    expect(out.keyFacts.amounts.map((a) => a.value)).toContain("1200.00");
    expect(out.keyFacts.durations.map((d) => `${d.value} ${d.unit}`)).toEqual(
      expect.arrayContaining(["10 days", "5 days"]),
    );
  });

  it("la lista es generica: mismas preguntas para cualquier texto y sin banderas inventadas", async () => {
    const client = await connect();
    const a = (
      await client.callTool({ name: "prepare_decision_review", arguments: { text: DECISION } })
    ).structuredContent as { checklist: { id: string; question: string }[] };
    const b = (
      await client.callTool({
        name: "prepare_decision_review",
        arguments: {
          text: "Autre texte sans rapport.\n\nLa commission a décidé de refuser la demande sans autre motif.",
        },
      })
    ).structuredContent as { checklist: { id: string; question: string }[] };
    expect(a.checklist.map((c) => c.id)).toEqual(b.checklist.map((c) => c.id));
    expect(a.checklist.map((c) => c.question)).toEqual(b.checklist.map((c) => c.question));
    expect(a.checklist.length).toBeGreaterThanOrEqual(15);
  });

  it("las pistas senalan donde mirar y avisan cuando no hay ninguna", async () => {
    const client = await connect();
    const out = (
      await client.callTool({ name: "prepare_decision_review", arguments: { text: DECISION } })
    ).structuredContent as {
      statements: { id: string; text: string }[];
      checklist: { id: string; cueStatementIds: string[]; noCueFound: boolean }[];
    };
    const byId = new Map(out.statements.map((s) => [s.id, s.text]));
    const r1 = out.checklist.find((c) => c.id === "R1")!;
    expect(r1.cueStatementIds.some((id) => /Anhörung/.test(byId.get(id)!))).toBe(true);
    const m3 = out.checklist.find((c) => c.id === "M3")!;
    expect(m3.cueStatementIds.some((id) => /Staatsangehörige/.test(byId.get(id)!))).toBe(true);
    const f1 = out.checklist.find((c) => c.id === "F1")!;
    expect(f1.noCueFound).toBe(true);
  });

  it("todas las normas de apoyo llevan un extracto literal y proceden de la lista verificada", async () => {
    const client = await connect();
    const out = (
      await client.callTool({ name: "prepare_decision_review", arguments: { text: DECISION } })
    ).structuredContent as { verifiedNorms: { citation: string; literalExcerpt: string }[] };
    const allowed =
      /^Art\. (5 Abs\. [123]|8 Abs\. [12]|9|12|29 Abs\. 2|29a|36) BV$|^Art\. 328 Abs\. 1 ZGB$|^Art\. (12|30 Abs\. 1|35 Abs\. 1 und 2|38) VwVG$|^Art\. (42|43 Abs\. 1|49 Abs\. 3|56 Abs\. 1) ATSG$/;
    for (const n of out.verifiedNorms) {
      expect(n.citation).toMatch(allowed);
      expect(n.literalExcerpt.length).toBeGreaterThan(20);
    }
  });
});

describe("verify_review_findings", () => {
  const call = async (findings: unknown[], verifyNorms = false) => {
    const client = await connect();
    const r = await client.callTool({
      name: "verify_review_findings",
      arguments: { text: DECISION, findings, verifyNorms },
    });
    return r.structuredContent as {
      summary: { total: number; supported: number; quoteOnly: number; rejected: number };
      results: {
        status: string;
        quote: { status: string; statementId: string | null; location: string | null };
        reasons: string[];
      }[];
    };
  };

  it("acepta una cita literal y dice en que frase esta", async () => {
    const out = await call([
      {
        checklistId: "R1",
        quote: "Eine Anhörung ist nicht erforderlich.",
        claim: "No se oyó a la persona.",
      },
    ]);
    expect(out.results[0]!.status).toBe("supported");
    expect(out.results[0]!.quote.status).toBe("verified_exact");
    expect(out.results[0]!.quote.statementId).toMatch(/^S\d+$/);
  });

  it("rechaza una cita inventada o alterada", async () => {
    const out = await call([
      { quote: "Die Behörde hat die Gesuchstellerin ausführlich angehört.", claim: "inventada" },
      { quote: "Das Baugesuch wird vollständig abgelehnt und archiviert.", claim: "alterada" },
    ]);
    expect(out.results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect(out.summary.rejected).toBe(2);
    expect(out.results[0]!.reasons.join(" ")).toContain("cita");
  });

  it("con las normas sin verificar la cita literal queda como quote_only", async () => {
    const out = await call(
      [
        {
          quote: "Eine Anhörung ist nicht erforderlich.",
          claim: "Falta audiencia.",
          norms: ["Art. 29 Abs. 2 BV"],
        },
      ],
      false,
    );
    expect(out.results[0]!.status).toBe("quote_only");
  });

  it("una norma cantonal se marca como no verificable, no como inexistente", async () => {
    const client = await connect();
    const r = await client.callTool({
      name: "verify_review_findings",
      arguments: {
        text: DECISION,
        findings: [
          {
            quote: "Eine Anhörung ist nicht erforderlich.",
            claim: "Falta la base legal cantonal.",
            norms: ["§ 14 SHG ZH"],
          },
        ],
      },
    });
    if (!r.structuredContent) throw new Error(JSON.stringify(r.content).slice(0, 400));
    const out = r.structuredContent as {
      results: { status: string; norms: { status: string }[] }[];
    };
    expect(out.results[0]!.norms[0]!.status).toBe("unverifiable");
    expect(out.results[0]!.status).toBe("quote_only");
  });
});

import { LEGAL_GROUNDS, activatedGrounds } from "../src/tools/legalGroundsRegistry.js";
import { termsNotInNorm } from "../src/tools/decisionReviewTools.js";

describe("base de conocimiento verificada", () => {
  it("cada entrada tiene fuentes con identificador, extracto y fecha, y marca lo no verificado", () => {
    expect(LEGAL_GROUNDS.length).toBeGreaterThanOrEqual(3);
    for (const g of LEGAL_GROUNDS) {
      expect(g.sources.length).toBeGreaterThan(0);
      expect(g.whatToCheck.length).toBeGreaterThan(0);
      expect(g.caveats.length).toBeGreaterThan(0);
      for (const s of g.sources) {
        expect(s.identifier.length).toBeGreaterThan(5);
        expect(s.excerpt.length).toBeGreaterThan(20);
        expect(s.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(s.verifiedFrom.length).toBeGreaterThan(5);
        if (s.kind === "cited_by_court") expect(s.verifiedFrom).toContain("no verificado");
      }
    }
  });

  it("la entrada de competencia cita la sentencia con su numero, fecha y hash del archivo", () => {
    const g = LEGAL_GROUNDS.find((x) => x.id === "competence-delegation")!;
    expect(
      g.sources.some(
        (s) => s.identifier.includes("O4V 21 28") && s.identifier.includes("28. April 2022"),
      ),
    ).toBe(true);
    expect(g.sources.some((s) => s.verifiedFrom.includes("sha256"))).toBe(true);
    expect(g.caveats.join(" ")).toContain("Appenzell Ausserrhoden");
  });

  it("se activan por las senales de la resolucion y no por otras", () => {
    const ids = (t: string) => activatedGrounds(t).map((g) => g.id);
    expect(ids("Soziale Dienste Musterland\n\nVerfügung\n\nDer Antrag wird abgelehnt.")).toContain(
      "competence-delegation",
    );
    expect(ids("Gemeinderat Musterdorf\n\nVerfügung\n\nDer Antrag wird abgelehnt.")).not.toContain(
      "competence-delegation",
    );
    expect(ids("Er lebt seit weniger als zwei Jahren in der Schweiz.")).toContain(
      "residence-duration-ground",
    );
    expect(ids("Sein Bruder kann ihn finanziell unterstützen.")).toContain("family-support-basis");
    expect(ids("Der Gesuchsteller wohnt in Bern und ist Rentner.")).toEqual([]);
  });
});

describe("prepare_decision_review: normas citadas y conocimiento", () => {
  const TEXT = `Soziale Dienste Musterland\nAbteilung Sozialhilfe\n\nVERFÜGUNG\n\nI. Sachverhalt\n\n1. Er lebt seit weniger als zwei Jahren in der Schweiz.\n\nII. Erwägungen\n\n1. Gestützt auf Art. 999a ZGB und Art. 4 ZUG besteht kein Anspruch.\n\n2. Der Bruder kann ihn unterstützen.\n\nIII. Verfügung\n\n1. Der Antrag wird abgelehnt.`;

  it("devuelve las entradas de conocimiento activadas con sus fuentes", async () => {
    const client = await connect();
    const out = (
      await client.callTool({
        name: "prepare_decision_review",
        arguments: { text: TEXT, verifyCitedNorms: false },
      })
    ).structuredContent as {
      knownIssues: { id: string; verifiedSources: { excerpt: string }[]; whatToCheck: string[] }[];
    };
    expect(out.knownIssues.map((k) => k.id).sort()).toEqual([
      "competence-delegation",
      "family-support-basis",
      "residence-duration-ground",
    ]);
    for (const k of out.knownIssues) {
      expect(k.verifiedSources.length).toBeGreaterThan(0);
      expect(k.whatToCheck.length).toBeGreaterThan(0);
    }
  });

  it("recoge las normas federales citadas y, sin conexion, NO inventa que no existen", async () => {
    const client = await connect();
    const out = (
      await client.callTool({ name: "prepare_decision_review", arguments: { text: TEXT } })
    ).structuredContent as {
      citedNormChecks: { citation: string; status: string }[];
      automaticFindings: unknown[];
    };
    expect(out.citedNormChecks.map((c) => c.citation).sort()).toEqual([
      "Art. 4 ZUG",
      "Art. 999a ZGB",
    ]);
    // en el entorno de pruebas no hay proveedor Fedlex: el estado es "fuente no disponible"
    expect(out.citedNormChecks.every((c) => c.status === "source_unavailable")).toBe(true);
    expect(out.automaticFindings).toHaveLength(0);
  });
});

describe("verificadores adicionales", () => {
  const ART328 =
    "Art. 328 1 Wer in günstigen Verhältnissen lebt, ist verpflichtet, Verwandte in auf- und absteigender Linie zu unterstützen, die ohne diesen Beistand in Not geraten würden.";

  it("senala los terminos de la cita que el articulo no contiene (sin ruido de partes)", () => {
    const missing = termsNotInNorm(
      ["Der Bruder des Gesuchstellers muss ihn gestützt auf Art. 328 ZGB unterstützen."],
      ART328,
    );
    expect(missing).toContain("Bruder");
    expect(missing).not.toContain("Gesuchstellers");
    expect(missing).not.toContain("Verwandte");
  });

  it("no senala nada cuando el articulo contiene los terminos", () => {
    expect(
      termsNotInNorm(["Die Verwandten in absteigender Linie müssen unterstützen."], ART328),
    ).toEqual([]);
  });

  it("derecho cantonal: sin proveedor es 'fuente no disponible', sin canton o sin ley registrada 'no verificable'", async () => {
    const client = await connect();
    const call = async (args: Record<string, unknown>) =>
      (
        await client.callTool({
          name: "verify_review_findings",
          arguments: {
            text: DECISION,
            findings: [
              {
                quote: "Eine Anhörung ist nicht erforderlich.",
                claim: "Falta la base legal cantonal.",
                norms: ["Art. 8 Abs. 4 SHG"],
              },
            ],
            ...args,
          },
        })
      ).structuredContent as { results: { norms: { status: string; note: string | null }[] }[] };
    expect((await call({ canton: "AR" })).results[0]!.norms[0]!.status).toBe("source_unavailable");
    expect((await call({})).results[0]!.norms[0]!.status).toBe("unverifiable");
    const other = await call({ canton: "ZH" });
    expect(other.results[0]!.norms[0]!.status).toBe("unverifiable");
    expect(other.results[0]!.norms[0]!.note).toContain("no se pudo resolver");
  });

  it("los parametros de canton y fecha de referencia se aceptan en ambas herramientas", async () => {
    const client = await connect();
    const prep = (
      await client.callTool({
        name: "prepare_decision_review",
        arguments: {
          text: DECISION,
          canton: "AR",
          asOfDate: "2026-03-01",
          verifyCitedNorms: false,
        },
      })
    ).structuredContent as { status: string };
    expect(prep.status).toBe("prepared");
    const ver = (
      await client.callTool({
        name: "verify_review_findings",
        arguments: {
          text: DECISION,
          asOfDate: "2026-03-01",
          findings: [{ quote: "Eine Anhörung ist nicht erforderlich.", claim: "Falta audiencia." }],
        },
      })
    ).structuredContent as { status: string };
    expect(ver.status).toBe("verified");
  });
});

import { cantonConflictWarning } from "../src/tools/decisionReviewTools.js";
import { ARTICLE_RE } from "../src/tools/quoteVerifier.js";

describe("correcciones tras la auditoria de ChatGPT (EVAL-D1)", () => {
  it("reconoce 'Art. 4 Abs. 1 und 2 ZUG' como articulo del ZUG, no como ley 'Abs'", () => {
    const m = new RegExp(ARTICLE_RE.source, "i").exec("Art. 4 Abs. 1 und 2 ZUG");
    expect(m?.[1]).toBe("4");
    expect(m?.[2]).toBe("ZUG");
  });

  it("no senala meses ni garantias generales como 'terminos ausentes'", () => {
    const out = termsNotInNorm(
      ["Das Gesuch für Oktober bis Dezember wird abgewiesen."],
      "Art. 9 Schutz vor Willkür",
    );
    expect(out).not.toContain("Oktober");
    expect(out).not.toContain("Dezember");
  });

  it("avisa cuando el canton indicado no coincide con las marcas del texto", () => {
    expect(cantonConflictWarning("nach § 14 SHG (LS 851.1)", "AR")).toMatch(/canton equivocado/i);
    expect(cantonConflictWarning("nach § 14 SHG (LS 851.1)", "ZH")).toBeNull();
    expect(cantonConflictWarning("nach Art. 9 BV", "AR")).toBeNull();
    expect(cantonConflictWarning("nach § 14 SHG (LS 851.1)", undefined)).toMatch(
      /indique 'canton'/,
    );
  });
});

import {
  expandListedCitations,
  findAppealIssues,
  findArithmeticMismatches,
  findLimitViolations,
} from "../src/tools/decisionConsistency.js";
import { reviewDecision } from "../src/tools/decisionDocumentAnalyzer.js";

const st = (...texts: string[]) => texts.map((text, i) => ({ id: `S${i + 1}`, text }));

describe("coherencia interna (texto propio, sin copiar casos de evaluacion)", () => {
  it("expande listas de articulos", () => {
    expect(expandListedCitations("nach den Art. 43, 49 und 52 ATSG")).toEqual([
      "Art. 43 ATSG",
      "Art. 49 ATSG",
      "Art. 52 ATSG",
    ]);
    expect(expandListedCitations("gemäss Art. 9 BV")).toEqual([]);
  });

  it("detecta un valor que supera el tope enunciado en la propia resolucion (dias)", () => {
    const out = findLimitViolations(
      st("Die Sperre beträgt höchstens 40 Tage.", "Im Fall wird eine Sperre von 55 Tagen verfügt."),
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.value).toBe(55);
    expect(out[0]!.limit.max).toBe(40);
  });

  it("detecta un importe fuera de la banda enunciada (frances)", () => {
    const out = findLimitViolations(
      st(
        "L'amende prévue se situe dans une fourchette de 100 à 50 000 francs.",
        "Une amende de CHF 60 000 est infligée.",
      ),
    );
    expect(out.map((x) => x.value)).toEqual([60000]);
  });

  it("no senala valores dentro del limite ni el propio enunciado del limite", () => {
    expect(
      findLimitViolations(st("Höchstens 40 Tage.", "Es werden 30 Tage verfügt.")),
    ).toHaveLength(0);
    expect(findLimitViolations(st("Die Frist beträgt höchstens 40 Tage."))).toHaveLength(0);
  });

  it("compara plazo y via del recurso con el ATSG solo si la resolucion cita ATSG o AVIG", () => {
    const stmts = st(
      "Einsprachen sind binnen zehn Tagen direkt beim Versicherungsgericht einzureichen.",
    );
    expect(findAppealIssues(stmts, "nach Art. 17 AVIG").map((x) => x.type)).toEqual([
      "appeal_period_mismatch",
      "appeal_authority_mismatch",
    ]);
    expect(findAppealIssues(stmts, "nach Art. 5 BV")).toEqual([]);
    expect(
      findAppealIssues(
        st("Einsprache ist innert 30 Tagen bei der verfügenden Stelle zu erheben."),
        "ATSG",
      ),
    ).toEqual([]);
  });

  it("no da por ausente una instruccion de recursos sin encabezado ni la cita en frances como 'sin base'", () => {
    const de = reviewDecision(
      "Verfügung. Einsprachen sind innert 30 Tagen bei der verfügenden Stelle einzureichen. Gestützt auf Art. 9 BV.",
    );
    expect(de.map((f) => f.type)).not.toContain("appeal_instruction_missing");
    const fr = reviewDecision(
      "Décision. L'article 12 de la loi sur les aides prévoit le montant. La présente décision n'est susceptible d'aucun recours.",
    );
    expect(fr.map((f) => f.type)).not.toContain("no_legal_basis_cited");
    expect(fr.map((f) => f.type)).toContain("appeal_excluded");
  });
});

describe("citas cantonales en frances (texto propio)", () => {
  it("registra 'article N ... (LAB; ...)' como cantonal no verificable y no como federal", async () => {
    const { client } = await (async () => ({ client: await connect() }))();
    const r = await client.callTool({
      name: "prepare_decision_review",
      arguments: {
        text: "Décision du service. L'article 12 de la loi sur les aides (LAB; RSG A 1 10) prévoit un montant. Selon l'article 7 LPA, la partie est entendue. La décision est prise.",
        verifyCitedNorms: false,
      },
    });
    const sc = r.structuredContent as {
      keyFacts: {
        citedCantonalNormsNotVerifiable: { citation: string }[];
        citedFederalNorms: unknown[];
      };
    };
    const cits = sc.keyFacts.citedCantonalNormsNotVerifiable.map((c) => c.citation);
    expect(cits).toContain("Art. 12 LAB");
    expect(cits).toContain("Art. 7 LPA");
    expect(sc.keyFacts.citedFederalNorms).toHaveLength(0);
  });
});

import { findDateTensions } from "../src/tools/decisionConsistency.js";

describe("fechas en tension y relevancia de la norma", () => {
  it("detecta dos fechas contrapuestas en la misma frase", () => {
    const out = findDateTensions(
      st(
        "Das Ende wird einerseits mit 3. Mai 2026 bezeichnet, während die Übersicht den 9. Juni 2026 nennt.",
      ),
    );
    expect(out.map((x) => x.type)).toContain("dates_in_tension");
  });

  it("detecta una consecuencia fechada antes de su causa", () => {
    const out = findDateTensions(
      st("Le retrait du 2 mars 2026 faisait suite au constat du 10 mars 2026."),
    );
    expect(out.map((x) => x.type)).toContain("effect_before_cause");
    expect(
      findDateTensions(st("Le retrait du 12 mars 2026 faisait suite au constat du 10 mars 2026.")),
    ).toEqual([]);
  });

  it("detecta el fin de la relacion laboral con dos fechas distintas en frases separadas", () => {
    const out = findDateTensions(
      st(
        "Das Arbeitsverhältnis endete am 31. Mai 2026.",
        "In der Fallübersicht erscheint als Ende des Arbeitsverhältnisses der 30. Juni 2026.",
      ),
    );
    expect(out.map((x) => x.type)).toContain("same_event_two_dates");
  });

  it("verify marca 'supported' sin norma especifica cuando solo hay garantias generales", async () => {
    const client = await connect();
    const text =
      "Verfügung. Die Gesuchstellerin muss beweisen, dass ihr unter keinen Umständen Hilfe zufliessen könnte. Das Gesuch wird abgewiesen, Rechtsmittel keine.";
    const r = await client.callTool({
      name: "verify_review_findings",
      arguments: {
        text,
        findings: [
          {
            quote:
              "Die Gesuchstellerin muss beweisen, dass ihr unter keinen Umständen Hilfe zufliessen könnte.",
            claim: "Prueba negativa imposible",
            norms: ["Art. 9 BV"],
          },
        ],
        verifyNorms: true,
      },
    });
    const sc = r.structuredContent as { results: { normFit: string }[] };
    // Sin red (NODE_ENV=test) la norma no se verifica: no puede ser 'specific'.
    expect(["unverified", "general_clause_only"]).toContain(sc.results[0]!.normFit);
  });
});

describe("fechas: remisión al mismo hecho", () => {
  it("marca una orden fechada antes del hecho al que dice hacer seguimiento", () => {
    const out = findDateTensions(
      st(
        "La infraction a été constatée le 4 août 2026; l'ordre notifié le 29 juillet 2026 faisait suite au même constat.",
      ),
    );
    expect(out.map((x) => x.type)).toContain("effect_before_cause");
    const ok = findDateTensions(
      st(
        "La infraction a été constatée le 4 août 2026; l'ordre notifié le 9 août 2026 faisait suite au même constat.",
      ),
    );
    expect(ok).toEqual([]);
  });
});

describe("entrada de notificacion", () => {
  it("se activa con 'solo se entrega a un tercero' y con 'ejecutada antes de la notificacion'", () => {
    expect(
      activatedGrounds(
        "Die Verfügung wird nur der Kasse zugestellt; eine Eröffnung an Herrn X ist nicht vorgesehen.",
      ).map((g) => g.id),
    ).toContain("decision-notification");
    expect(
      activatedGrounds("La décision sera exécutée avant toute notification à la société.").map(
        (g) => g.id,
      ),
    ).toContain("decision-notification");
    expect(
      activatedGrounds("Die Verfügung wird dem Gesuchsteller zugestellt.").map((g) => g.id),
    ).not.toContain("decision-notification");
  });
});

describe("senal lexical en frances y clasificacion de la norma", () => {
  const ART43 =
    "Art. 43 Amendes 1 Est passible d’une amende administrative de 200 francs à 400 000 francs tout contrevenant : a) à la présente loi; b) aux règlements et arrêtés édictés en vertu de la présente loi.";

  it("en frances señala sustantivos largos que la norma no contiene", () => {
    const out = termsNotInNorm(
      [
        "Le seul fait que le logo commercial soit utilisé par une autre personne suffit à établir, de manière irréfragable, la responsabilité de la société.",
      ],
      ART43,
    );
    expect(out.join(" ")).toMatch(/irréfragable|responsabilité|commercial/);
  });

  it("no senala terminos que la norma si contiene", () => {
    expect(
      termsNotInNorm(
        ["Est passible d'une amende administrative tout contrevenant à la présente loi."],
        ART43,
      ),
    ).toEqual([]);
  });

  it("Art. 8 Abs. 2 BV (discriminacion) no se trata como clausula general; Art. 9 BV sola si", async () => {
    const client = await connect();
    const text =
      "Décision. Le service considère comme aggravante la nationalité étrangère de l'associé gérant. Une amende est infligée à la société pour dépôt de déchets sans autorisation.";
    const r = await client.callTool({
      name: "verify_review_findings",
      arguments: {
        text,
        findings: [
          {
            checklistId: "M3",
            quote:
              "Le service considère comme aggravante la nationalité étrangère de l'associé gérant.",
            claim: "Discriminacion por nacionalidad",
            norms: ["Art. 8 Abs. 2 BV"],
          },
          {
            checklistId: "I1",
            quote: "Une amende est infligée à la société pour dépôt de déchets sans autorisation.",
            claim: "Contradiccion interna",
            norms: ["Art. 9 BV"],
          },
        ],
        verifyNorms: false,
      },
    });
    const sc = r.structuredContent as {
      results: { normFit: string }[];
      summary: { supportedOnlyByGeneralClauses: number };
    };
    expect(sc.results[1]!.normFit).toBe("not_applicable");
    expect(sc.results[0]!.normFit).not.toBe("general_clause_only");
    expect(sc.summary.supportedOnlyByGeneralClauses).toBe(0);
  });
});

describe("entradas de seguro de desempleo y de extranjeria", () => {
  it("se activan por la ley citada y no por otras", () => {
    expect(
      activatedGrounds(
        "Die Einstellung in der Anspruchsberechtigung wird für 20 Tage verfügt (Art. 30 AVIG).",
      ).map((g) => g.id),
    ).toContain("alv-suspension");
    expect(
      activatedGrounds("Révocation de l'autorisation de séjour selon l'art. 62 LEI.").map(
        (g) => g.id,
      ),
    ).toContain("foreigners-measures");
    const none = activatedGrounds(
      "Die Baubewilligung wird gestützt auf Art. 2 BauG verweigert.",
    ).map((g) => g.id);
    expect(none).not.toContain("alv-suspension");
    expect(none).not.toContain("foreigners-measures");
  });
});

import { findSameReferenceConflicts } from "../src/tools/decisionConsistency.js";

describe("dos valores para la misma referencia (frases propias)", () => {
  it("detecta dos importes distintos para el mismo concepto", () => {
    const out = findSameReferenceConflicts(
      st("Als Einkommen des Monats Mai werden gleichzeitig CHF 900 und CHF 1'500 berücksichtigt."),
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.values).toEqual([900, 1500]);
  });

  it("detecta dos cantidades de dias y un importe nulo contra otro", () => {
    expect(
      findSameReferenceConflicts(
        st("Pour le même mois, on retient trois et neuf jours de suspension."),
      ).map((x) => x.kind),
    ).toEqual([]); // 'neuf' no esta en la tabla: no se inventa
    expect(
      findSameReferenceConflicts(st("Für denselben Monat werden vier und elf Tage angesetzt.")).map(
        (x) => x.kind,
      ),
    ).toEqual(["days"]);
    expect(
      findSameReferenceConflicts(
        st("La fiche indique 3'200 francs, puis retient pour la même période un revenu nul."),
      ).map((x) => x.values),
    ).toEqual([[0, 3200]]);
  });

  it("no senala una frase con un solo valor ni una sin referencia comun", () => {
    expect(findSameReferenceConflicts(st("Für denselben Monat werden CHF 900 angesetzt."))).toEqual(
      [],
    );
    expect(findSameReferenceConflicts(st("Es werden CHF 900 und CHF 1'500 angesetzt."))).toEqual(
      [],
    );
  });

  it("dos fechas con 'sans qu' en la misma frase son una tension de fechas", () => {
    expect(
      findDateTensions(
        st(
          "L'inspection est datée du 2 mars 2026 dans l'exposé et du 9 mai 2026 dans le dispositif sans qu'une seconde inspection soit mentionnée.",
        ),
      ).map((x) => x.type),
    ).toContain("dates_in_tension");
  });
});

describe("fechas sin año y palabras intercaladas", () => {
  it("dos fechas sin año contrapuestas en una frase", () => {
    expect(
      findDateTensions(
        st(
          "La visite est datée du 7 juillet dans l'exposé et du 19 septembre dans le dispositif sans qu'une seconde visite soit citée.",
        ),
      ).map((x) => x.type),
    ).toContain("dates_in_tension");
    expect(findDateTensions(st("La visite a eu lieu le 7 juillet."))).toEqual([]);
  });

  it("'vier und elf entschädigungsberechtigte Tage' cuenta como dos valores", () => {
    expect(
      findSameReferenceConflicts(
        st("Für denselben Zeitraum werden vier und elf anrechenbare Tage angesetzt."),
      ).map((x) => x.kind),
    ).toEqual(["days"]);
  });
});

describe("entradas ATSG: devolucion, deberes y tribunal de seguros", () => {
  it("se activan por su contenido", () => {
    expect(
      activatedGrounds("Die Rückerstattung der bezogenen Leistungen wird verfügt.").map(
        (g) => g.id,
      ),
    ).toContain("social-insurance-recovery");
    expect(activatedGrounds("Die Mitwirkungspflicht wurde verletzt.").map((g) => g.id)).toContain(
      "social-insurance-duties",
    );
    expect(
      activatedGrounds("Beschwerde ans Versicherungsgericht des Kantons Bern.").map((g) => g.id),
    ).toContain("insurance-court-procedure");
    expect(activatedGrounds("Die Baubewilligung wird verweigert.").map((g) => g.id)).toEqual([]);
  });
});

import { cleanCantonalHtml } from "../src/tools/decisionReviewTools.js";

describe("limpieza del texto cantonal", () => {
  it("quita etiquetas, entidades y asteriscos de nota", () => {
    expect(
      cleanCantonalHtml(
        "3 Allgemeine Voraussetzungen&nbsp;<strong>*</strong> 1 Bauvorhaben sind zu bewilligen &amp; geprüft",
      ),
    ).toBe("3 Allgemeine Voraussetzungen 1 Bauvorhaben sind zu bewilligen & geprüft");
  });
});

describe("citas federales en frances e italiano", () => {
  it("reconoce 'art. 29 al. 2 Cst.', 'article 9 Cst.', listas y Cost.", async () => {
    const client = await connect();
    const r = await client.callTool({
      name: "prepare_decision_review",
      arguments: {
        text: "Décision du service. Selon l'art. 29 al. 2 Cst., les parties sont entendues. Vu l'article 9 Cst. et les art. 43, 49 et 52 LPGA. Secondo l'art. 29 cpv. 2 Cost. e l'art. 12 cpv. 1 LAS, la decisione è presa.",
        verifyCitedNorms: false,
      },
    });
    const sc = r.structuredContent as { keyFacts: { citedFederalNorms: { citation: string }[] } };
    const cits = sc.keyFacts.citedFederalNorms.map((c) => c.citation);
    expect(cits).toEqual(
      expect.arrayContaining([
        "Art. 29 al. 2 Cst",
        "Art. 9 Cst",
        "Art. 43 LPGA",
        "Art. 49 LPGA",
        "Art. 52 LPGA",
        "Art. 29 cpv. 2 Cost",
        "Art. 12 cpv. 1 LAS",
      ]),
    );
  });
});

describe("limites en italiano", () => {
  it("importe fuera de una banda y dias sobre un maximo", () => {
    expect(
      findLimitViolations(
        st(
          "La multa prevista va da 100 a 20 000 franchi.",
          "Viene inflitta una multa di 25 000 franchi.",
        ),
      ).map((x) => x.value),
    ).toEqual([25000]);
    expect(
      findLimitViolations(
        st("La sospensione dura al massimo 60 giorni.", "Si fissano 75 giorni di sospensione."),
      ).map((x) => x.value),
    ).toEqual([75]);
  });
});

describe("plazo ATSG en italiano y frances", () => {
  it("opposizione entro 10 giorni frente a 30 dias (LPGA)", () => {
    expect(
      findAppealIssues(st("L'opposizione va presentata entro 10 giorni."), "secondo la LPGA").map(
        (x) => x.type,
      ),
    ).toEqual(["appeal_period_mismatch"]);
    expect(
      findAppealIssues(st("L'opposizione va presentata entro 30 giorni."), "secondo la LPGA"),
    ).toEqual([]);
  });
});

describe("pistas del checklist en italiano", () => {
  it("R1, P2 y F1 tienen pista en una resolucion italiana", async () => {
    const client = await connect();
    const r = await client.callTool({
      name: "prepare_decision_review",
      arguments: {
        text: "Decisione del servizio.\n\nIl richiedente ha chiesto la consultazione degli atti ma non è stato sentito.\n\nSpetta al richiedente dimostrare di non avere altre risorse; l'onere della prova è suo.\n\nContro la presente decisione non è dato alcun ricorso.",
        verifyCitedNorms: false,
      },
    });
    const sc = r.structuredContent as { checklist: { id: string; noCueFound: boolean }[] };
    for (const id of ["R1", "P2", "F1"]) {
      expect(sc.checklist.find((c) => c.id === id)!.noCueFound).toBe(false);
    }
  });
});

describe("IV y citas de IVG/AHVG", () => {
  it("la entrada de renta IV se activa por IVG y las citas se reconocen", async () => {
    expect(
      activatedGrounds("Die IV-Stelle verneint den Anspruch auf eine Invalidenrente.").map(
        (g) => g.id,
      ),
    ).toContain("iv-pension-basis");
    expect(activatedGrounds("Die Baubewilligung wird verweigert.").map((g) => g.id)).not.toContain(
      "iv-pension-basis",
    );
    const client = await connect();
    const r = await client.callTool({
      name: "prepare_decision_review",
      arguments: {
        text: "Verfügung der IV-Stelle. Gestützt auf Art. 28 IVG und Art. 21 AHVG wird entschieden.",
        verifyCitedNorms: false,
      },
    });
    const sc = r.structuredContent as { keyFacts: { citedFederalNorms: { citation: string }[] } };
    expect(sc.keyFacts.citedFederalNorms.map((c) => c.citation)).toEqual(
      expect.arrayContaining(["Art. 28 IVG", "Art. 21 AHVG"]),
    );
  });
});

describe("mas leyes federales reconocidas", () => {
  it("KVG, UVG, BVG, DBG, StHG, RPG, VZAE, BüG y sus siglas francesas", async () => {
    const client = await connect();
    const r = await client.callTool({
      name: "prepare_decision_review",
      arguments: {
        text: "Verfügung. Gestützt auf Art. 25 KVG, Art. 6 UVG, Art. 2 BVG, Art. 132 DBG, Art. 1 StHG, Art. 22 RPG, Art. 58 VZAE und Art. 9 BüG. Vu l'art. 25 LAMal et l'art. 22 LAT.",
        verifyCitedNorms: false,
      },
    });
    const sc = r.structuredContent as { keyFacts: { citedFederalNorms: { citation: string }[] } };
    const cits = sc.keyFacts.citedFederalNorms.map((c) => c.citation);
    for (const expected of [
      "Art. 25 KVG",
      "Art. 6 UVG",
      "Art. 2 BVG",
      "Art. 132 DBG",
      "Art. 1 StHG",
      "Art. 22 RPG",
      "Art. 58 VZAE",
      "Art. 9 BüG",
      "Art. 25 LAMal",
      "Art. 22 LAT",
    ]) {
      expect(cits).toContain(expected);
    }
  });
});

describe("leyes federales adicionales", () => {
  it("VGG, SVG, MWSTG, ArG, GlG, USG, BPG y LTAF", async () => {
    const client = await connect();
    const r = await client.callTool({
      name: "prepare_decision_review",
      arguments: {
        text: "Verfügung. Gestützt auf Art. 31 VGG, Art. 90 SVG, Art. 10 MWSTG, Art. 6 ArG, Art. 3 GlG, Art. 1 USG und Art. 6 BPG. Vu l'art. 31 LTAF.",
        verifyCitedNorms: false,
      },
    });
    const sc = r.structuredContent as { keyFacts: { citedFederalNorms: { citation: string }[] } };
    const cits = sc.keyFacts.citedFederalNorms.map((c) => c.citation);
    for (const e of [
      "Art. 31 VGG",
      "Art. 90 SVG",
      "Art. 10 MWSTG",
      "Art. 6 ArG",
      "Art. 3 GlG",
      "Art. 1 USG",
      "Art. 6 BPG",
      "Art. 31 LTAF",
    ]) {
      expect(cits).toContain(e);
    }
  });
});

describe("ley de proteccion de datos", () => {
  it("DSG y LPD se reconocen como citas federales", async () => {
    const client = await connect();
    const r = await client.callTool({
      name: "prepare_decision_review",
      arguments: {
        text: "Verfügung der Behörde. Gestützt auf Art. 6 DSG und vu l'art. 6 LPD wird das Gesuch geprüft.",
        verifyCitedNorms: false,
      },
    });
    const sc = r.structuredContent as { keyFacts: { citedFederalNorms: { citation: string }[] } };
    expect(sc.keyFacts.citedFederalNorms.map((c) => c.citation)).toEqual(
      expect.arrayContaining(["Art. 6 DSG", "Art. 6 LPD"]),
    );
  });
});

describe("mejoras tras el ensayo con textos propios", () => {
  it("limite en la misma frase con contraste y meses con palabras", () => {
    expect(
      findLimitViolations(
        st(
          "La multa inflitta è di 5 000 franchi, mentre la legge prevede un importo massimo di 2 000 franchi.",
        ),
      ).map((x) => x.value),
    ).toEqual([5000]);
    expect(
      findLimitViolations(
        st(
          "Die Leistungen werden für sechs Monate gesperrt, die Sperre darf höchstens drei Monate dauern.",
        ),
      ).map((x) => x.value),
    ).toEqual([6]);
  });

  it("excedente declarado que no sale de ninguna resta", () => {
    const out = findArithmeticMismatches(
      st(
        "Das Einkommen beträgt CHF 2'950.",
        "Der Bedarf beläuft sich auf CHF 2'711, es besteht ein Überschuss von CHF 1'200.",
      ),
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.stated).toBe(1200);
    expect(
      findArithmeticMismatches(
        st(
          "Das Einkommen beträgt CHF 2'950.",
          "Der Bedarf beläuft sich auf CHF 2'711, es besteht ein Überschuss von CHF 239.",
        ),
      ),
    ).toEqual([]);
    // resta de tres importes (1840 - 900 - 300 = 640)
    expect(
      findArithmeticMismatches(
        st(
          "Bedarf CHF 1'840, abgezogen werden CHF 900 und CHF 300.",
          "Der Fehlbetrag beträgt CHF 640.",
        ),
      ),
    ).toEqual([]);
  });

  it("exclusion de recurso en aleman e italiano, examen innecesario en verbo, hermano en la frase anterior", () => {
    const de = reviewDecision(
      "Verfügung. Diese Verfügung ist endgültig und kann nicht angefochten werden. Der Gesuchsteller hat einen Bruder. Es ist davon auszugehen, dass dieser ihn unterstützen kann.",
    ).map((f) => f.type);
    expect(de).toEqual(expect.arrayContaining(["appeal_excluded", "family_support_basis"]));
    expect(de).not.toContain("appeal_instruction_missing");
    const it_ = reviewDecision(
      "Decisione. Contro la presente decisione non è dato alcun ricorso.",
    ).map((f) => f.type);
    expect(it_).toContain("appeal_excluded");
    expect(
      reviewDecision("Décision. Il n'est pas nécessaire de vérifier ses recherches d'emploi.").map(
        (f) => f.type,
      ),
    ).toContain("examination_refused");
  });

  it("origen como agravante en italiano activa la entrada de trato por origen", () => {
    expect(
      activatedGrounds(
        "Il servizio revoca il permesso perché è di origine nordafricana, il che costituisce un fattore aggravante.",
      ).map((g) => g.id),
    ).toContain("origin-based-treatment");
  });
});
