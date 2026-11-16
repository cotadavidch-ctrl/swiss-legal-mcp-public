import { describe, expect, it } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createLogger, loadEnv } from "@swiss-legal-mcp/shared";
import { createMcpServer } from "../src/mcpServer.js";
import { buildRegistries } from "../src/registry.js";
import { analyzeSubmissions } from "../src/tools/opposingSubmissionAnalyzer.js";
import { analyzeDecisionText, reviewDecision } from "../src/tools/decisionDocumentAnalyzer.js";

const DE_VERFUEGUNG = `Arbeitslosenkasse des Kantons Beispiel
Beispielstrasse 1, 8000 Beispielstadt

Verfügung vom 12. Oktober 2026

Betreff: Einstellung in der Anspruchsberechtigung (Art. 30 AVIG)

Sie wurden mit Wirkung ab dem 1. September 2026 für 10 Tage in der Anspruchsberechtigung eingestellt.
Die Begründung finden Sie auf der folgenden Seite. Dieser Entscheid beruht auf dem Arbeitslosenversicherungsgesetz.

Rechtsmittelbelehrung
Gegen diese Verfügung kann innert 30 Tagen nach der Eröffnung bei der Arbeitslosenkasse des Kantons Beispiel schriftlich Einsprache erhoben werden (Art. 52 ATSG).
Die Einsprache muss begründet sein und einen Antrag enthalten.`;

const FR_DECISION = `Caisse de chômage du canton exemple

Décision sur opposition du 3 septembre 2026

Concerne : suspension du droit à l'indemnité.

Voies de droit
Un recours peut être formé dans un délai de 30 jours dès la notification de la présente décision auprès du tribunal cantonal des assurances. Le Tribunal fédéral n'est pas compétent à ce stade.`;

const DE_NO_REMEDY = `Mitteilung der Behörde vom 5. März 2026\n\nWir teilen Ihnen mit, dass Ihr Gesuch geprüft wird. Weitere Schritte folgen in den nächsten Wochen nach Eingang der Unterlagen.`;

describe("analyzeDecisionText", () => {
  it("DE: Verfuegung con Rechtsmittelbelehrung (ATSG Art. 52, 30 dias)", () => {
    const a = analyzeDecisionText(DE_VERFUEGUNG);
    expect(a.language).toBe("de");
    expect(a.kind).toBe("verfuegung");
    expect(a.remedyInstruction.found).toBe(true);
    expect(a.remedyInstruction.deadlineDays).toBe(30);
    expect(a.remedyInstruction.remedy).toBe("Einsprache");
    expect(a.remedyInstruction.deadlineQuote).toContain("innert 30 Tagen");
    expect(a.suggestedRuleSet.ruleSet).toBe("ATSG_EINSPRACHE");
    expect(a.suggestedRuleSet.confidence).toBe("medium");
    expect(a.dates.map((d) => d.iso)).toContain("2026-10-12");
    expect(a.dates.map((d) => d.iso)).toContain("2026-09-01");
    expect(a.requiresHumanReview).toBe(true);
  });

  it("la fecha del documento no se presenta como fecha de notificacion", () => {
    const a = analyzeDecisionText(DE_VERFUEGUNG);
    expect(a.warnings.join(" ")).toContain("NO es la fecha de notificacion");
    expect(JSON.stringify(a)).not.toMatch(/notificationDate/);
  });

  it("FR: decision sur opposition y voies de droit (30 jours)", () => {
    const a = analyzeDecisionText(FR_DECISION);
    expect(a.language).toBe("fr");
    expect(a.kind).toBe("einspracheentscheid");
    expect(a.remedyInstruction.deadlineDays).toBe(30);
    expect(a.remedyInstruction.remedy).toBe("Beschwerde");
    expect(a.dates.map((d) => d.iso)).toContain("2026-09-03");
  });

  it("sin instruccion de recursos: la declara ausente y avisa", () => {
    const a = analyzeDecisionText(DE_NO_REMEDY);
    expect(a.remedyInstruction.found).toBe(false);
    expect(a.remedyInstruction.deadlineDays).toBeNull();
    expect(a.suggestedRuleSet.ruleSet).toBeNull();
    expect(a.warnings.join(" ")).toContain("No se encontro ninguna instruccion de recursos");
  });

  it("Zahlungsbefehl sugiere Rechtsvorschlag (SchKG)", () => {
    const a = analyzeDecisionText(
      "Zahlungsbefehl\nBetreibung Nr. 123\nDer Schuldner kann innert 10 Tagen Rechtsvorschlag erheben.\nRechtsmittelbelehrung: Rechtsvorschlag innert 10 Tagen nach Zustellung bei dem Betreibungsamt.",
    );
    expect(a.kind).toBe("zahlungsbefehl");
    expect(a.suggestedRuleSet.ruleSet).toBe("SCHKG_RECHTSVORSCHLAG");
  });

  it("Strafbefehl sugiere Einsprache StPO de 10 dias (Art. 354 StPO)", () => {
    const a = analyzeDecisionText(
      "Staatsanwaltschaft\nStrafbefehl vom 02.11.2026\nDie beschuldigte Person wird verurteilt.\nEinsprache: Gegen diesen Strafbefehl kann innert 10 Tagen bei der Staatsanwaltschaft schriftlich Einsprache erhoben werden.",
    );
    expect(a.kind).toBe("strafbefehl");
    expect(a.suggestedRuleSet.ruleSet).toBe("STPO_EINSPRACHE_STRAFBEFEHL");
  });

  it("Berufung civil (ZPO) sugiere 30 dias y sumario sugiere 10 dias", () => {
    const civil = analyzeDecisionText(
      "Urteil vom 05.10.2026\nRechtsmittelbelehrung: Gegen diesen Entscheid kann innert 30 Tagen Berufung beim Obergericht erhoben werden (Art. 311 ZPO).",
    );
    expect(civil.suggestedRuleSet.ruleSet).toBe("ZPO_BERUFUNG");
    const summary = analyzeDecisionText(
      "Entscheid im summarischen Verfahren vom 05.10.2026\nRechtsmittelbelehrung: Berufung innert 10 Tagen beim Obergericht (Art. 314 ZPO).",
    );
    expect(summary.suggestedRuleSet.ruleSet).toBe("ZPO_BERUFUNG_SUMMARISCH");
  });

  it("recursos del proceso penal (StPO) sugieren las reglas de la StPO", () => {
    const beschwerde = analyzeDecisionText(
      "Verfügung der Staatsanwaltschaft vom 05.10.2026\nRechtsmittelbelehrung: Beschwerde innert 10 Tagen bei der Beschwerdeinstanz (Art. 396 StPO).",
    );
    expect(beschwerde.suggestedRuleSet.ruleSet).toBe("STPO_BESCHWERDE");
    const berufung = analyzeDecisionText(
      "Urteil des Bezirksgerichts vom 05.10.2026\nRechtsmittelbelehrung: Berufung ist innert 10 Tagen anzumelden (Art. 399 StPO).",
    );
    expect(berufung.suggestedRuleSet.ruleSet).toBe("STPO_BERUFUNG_ANMELDUNG");
  });

  it("fechas numericas y meses invalidos", () => {
    const a = analyzeDecisionText(
      "Verfügung vom 05.11.2026 und Termin am 31.02.2026. Rechtsmittelbelehrung: Einsprache innert 30 Tagen (ATSG).",
    );
    const isos = a.dates.map((d) => d.iso);
    expect(isos).toContain("2026-11-05");
    expect(isos).not.toContain("2026-02-31");
  });

  it("cada dato lleva cita literal y posicion", () => {
    const a = analyzeDecisionText(DE_VERFUEGUNG);
    for (const d of a.dates) {
      expect(DE_VERFUEGUNG.replace(/\s+/g, " ")).toContain(d.quote.slice(0, 15));
      expect(d.offset).toBeGreaterThanOrEqual(0);
    }
    expect(a.remedyInstruction.offset).toBeGreaterThan(0);
  });
});

async function buildClient() {
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

describe("analyze_decision_document via MCP", () => {
  it("analiza el texto y calcula el plazo con notificacion probada", async () => {
    const client = await buildClient();
    expect((await client.listTools()).tools.map((t) => t.name)).toContain(
      "analyze_decision_document",
    );
    const r = await client.callTool({
      name: "analyze_decision_document",
      arguments: {
        text: DE_VERFUEGUNG,
        notificationDate: "2026-10-14",
        notificationProof: "proven",
      },
    });
    const out = r.structuredContent as {
      status: string;
      deadline: { deadlineDate: string; status: string; warnings: string[] } | null;
    };
    expect(out.status).toBe("analyzed");
    expect(out.deadline?.deadlineDate).toBe("2026-11-13");
    expect(out.deadline?.status).toBe("computed");
  });

  it("sin notificacion no calcula plazo y lo explica", async () => {
    const client = await buildClient();
    const r = await client.callTool({
      name: "analyze_decision_document",
      arguments: { text: DE_VERFUEGUNG },
    });
    const out = r.structuredContent as { deadline: unknown; notes: string[] };
    expect(out.deadline).toBeNull();
    expect(out.notes.join(" ")).toContain("notificationDate");
  });

  it("avisa si el plazo indicado en el documento difiere de la regla legal", async () => {
    const client = await buildClient();
    const r = await client.callTool({
      name: "analyze_decision_document",
      arguments: {
        text: DE_VERFUEGUNG.replace("innert 30 Tagen", "innert 20 Tagen"),
        notificationDate: "2026-10-14",
        notificationProof: "proven",
      },
    });
    const out = r.structuredContent as { deadline: { warnings: string[] } };
    expect(out.deadline.warnings.join(" ")).toContain("Rechtsmittelbelehrung indica 20");
  });

  it("exige exactamente uno de text o pdfBase64", async () => {
    const client = await buildClient();
    const r = await client.callTool({ name: "analyze_decision_document", arguments: {} });
    expect((r.structuredContent as { status: string }).status).toBe("invalid_input");
  });
});

describe("analyze_decision_document con PDF real (sintetico)", () => {
  it("extrae el texto del PDF y localiza la instruccion de recursos con su pagina", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const pdf = readFileSync(
      fileURLToPath(
        new URL("../../../tests/fixtures/decisions/synthetic_verfuegung_de.pdf", import.meta.url),
      ),
    );
    const client = await buildClient();
    const r = await client.callTool({
      name: "analyze_decision_document",
      arguments: {
        pdfBase64: pdf.toString("base64"),
        notificationDate: "2026-10-14",
        notificationProof: "proven",
      },
    });
    const out = r.structuredContent as {
      status: string;
      pageCount: number;
      analysis: {
        remedyInstruction: { found: boolean; deadlineDays: number | null; page: number | null };
        suggestedRuleSet: { ruleSet: string | null };
      };
      deadline: { deadlineDate: string } | null;
    };
    expect(out.status).toBe("analyzed");
    expect(out.pageCount).toBe(1);
    expect(out.analysis.remedyInstruction.found).toBe(true);
    expect(out.analysis.remedyInstruction.deadlineDays).toBe(30);
    expect(out.analysis.remedyInstruction.page).toBe(1);
    expect(out.analysis.suggestedRuleSet.ruleSet).toBe("ATSG_EINSPRACHE");
    expect(out.deadline?.deadlineDate).toBe("2026-11-13");
  });

  it("un PDF corrupto se rechaza sin ejecutar nada", async () => {
    const client = await buildClient();
    const r = await client.callTool({
      name: "analyze_decision_document",
      arguments: { pdfBase64: Buffer.from("esto no es un pdf ".repeat(20)).toString("base64") },
    });
    expect(r.isError).toBe(true);
  });
});

const DEFECTIVE = `Gemeinde X, Sozialamt

VERFÜGUNG

I. Sachverhalt

1. Die Antragstellerin beantragte Sozialhilfe. Sie führte aus, sie sei arbeitslos und verfüge nicht über ausreichende finanzielle Mittel.

II. Rechtliche Beurteilung

1. Die Antragstellerin hat einen erwerbstätigen Bruder und muss zunächst dessen finanzielle Unterstützung in Anspruch nehmen. Da sie nicht nachgewiesen hat, dass er eine Unterstützung ausdrücklich und endgültig verweigert hat, ist davon auszugehen, dass sie möglich wäre.

2. Eine nähere Prüfung der Verhältnisse des Bruders erscheint nicht erforderlich.

3. Die Gemeinde hat im laufenden Haushaltsjahr begrenzte finanzielle Mittel.

III. Verfügung

1. Der Antrag wird abgelehnt.

IV. Rechtsmittelbelehrung

Die Sozialhilfe ist eine freiwillige Leistung nach eigenem Ermessen. Eine Anfechtung dieser Verfügung ist ausgeschlossen.`;

describe("reviewDecision: puntos impugnables de una resolucion", () => {
  const types = (t: string) => reviewDecision(t).map((f) => f.type);

  it("detecta los defectos de fondo de una resolucion deficiente", () => {
    const got = types(DEFECTIVE);
    for (const expected of [
      "appeal_excluded",
      "voluntary_benefit_claim",
      "no_legal_basis_cited",
      "examination_refused",
      "family_support_basis",
      "emergency_aid_not_addressed",
      "budget_rationale",
      "inference_without_evidence",
    ]) {
      expect(got).toContain(expected);
    }
  });

  it("cada bandera cita la frase literal y solo normas verificadas", () => {
    const allowed = /Art\. (5 Abs\. 1|12|29 Abs\. 2|29a) BV|Art\. 328 Abs\. 1 ZGB|Art\. 12 VwVG/;
    for (const f of reviewDecision(DEFECTIVE)) {
      for (const p of f.passages)
        expect(DEFECTIVE.slice(p.offset, p.offset + p.text.length)).toBe(p.text);
      for (const a of f.legalAnchors) expect(a).toMatch(allowed);
    }
  });

  it("la palabra 'endgültig' en otro contexto no se toma por exclusion de recurso", () => {
    const appeal = reviewDecision(DEFECTIVE).find((f) => f.type === "appeal_excluded")!;
    expect(appeal.passages).toHaveLength(1);
    expect(appeal.passages[0]!.text).toContain("Anfechtung");
  });

  it("una resolucion correcta no dispara las banderas graves", () => {
    const ok = `Verfügung

I. Sachverhalt

1. Der Antrag vom 6. Oktober 2026 wurde geprüft. Die Antragstellerin verfügt über CHF 240.

II. Erwägungen

1. Gemäss Art. 12 BV und dem kantonalen Sozialhilfegesetz wurde die Nothilfe geprüft. Art. 328 ZGB wurde nicht angewendet.

III. Verfügung

1. Der Antrag wird teilweise gutgeheissen.

IV. Rechtsmittelbelehrung

Gegen diese Verfügung kann innert 30 Tagen Rekurs bei der Rekurskommission erhoben werden.`;
    const got = types(ok);
    expect(got).not.toContain("appeal_excluded");
    expect(got).not.toContain("appeal_instruction_missing");
    expect(got).not.toContain("no_legal_basis_cited");
    expect(got).not.toContain("emergency_aid_not_addressed");
  });

  it("sin instruccion de recursos lo avisa", () => {
    expect(types("Verfügung\n\nDer Antrag wird gemäss Art. 5 abgelehnt.")).toContain(
      "appeal_instruction_missing",
    );
  });

  it("analyze_decision_document devuelve reviewFlags", async () => {
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
      name: "analyze_decision_document",
      arguments: { text: DEFECTIVE },
    });
    expect(JSON.stringify(r.structuredContent)).toContain("appeal_excluded");
  });
});

describe("una negacion delante de 'anerkannt' no es una admision", () => {
  it("'wird nicht anerkannt' y 'kein Anspruch ... anerkannt' no generan admision", () => {
    const out = analyzeSubmissions({
      documents: [
        {
          id: "v",
          label: "Verfügung",
          author: "opposing_party",
          text: "Verfügung\n\nEin Anspruch auf Übernahme der Kosten wird nicht anerkannt.\n\nDa kein Anspruch auf die beantragte Leistung anerkannt wurde, ist die Anfechtung ausgeschlossen.\n\nDie Beklagte räumt ein, dass die Zahlung verspätet erfolgte.",
        },
      ],
      procedureFamily: "administrative",
      outputLanguage: "de",
      maxFindings: 20,
    });
    const adm = out.findings.filter((f) => f.type === "admission");
    expect(adm).toHaveLength(1);
    expect(adm[0]!.passages[0]!.text).toContain("räumt ein");
  });
});

describe("reviewDecision en frances e italiano (texto propio)", () => {
  it("frances: examen superfluo, presuncion, aide refusee sin art. 12 Cst", () => {
    const types = reviewDecision(
      "Décision. La vérification des revenus n'est pas nécessaire. Il y a lieu de présumer que le requérant dispose de ressources. L'aide sociale est refusée. Aucun recours n'est possible.",
    ).map((f) => f.type);
    expect(types).toEqual(
      expect.arrayContaining(["examination_refused", "inference_without_evidence", "emergency_aid_not_addressed", "appeal_excluded"]),
    );
  });

  it("italiano: esame superfluo, presunzione y aiuto rifiutato", () => {
    const types = reviewDecision(
      "Decisione. L'esame dei redditi non è necessario. Si presume che il richiedente disponga di risorse. L'aiuto sociale è rifiutato. Nessun ricorso è dato.",
    ).map((f) => f.type);
    expect(types).toEqual(
      expect.arrayContaining(["examination_refused", "inference_without_evidence", "emergency_aid_not_addressed", "appeal_excluded"]),
    );
  });

  it("no marca el aid cuando se cita el art. 12 Cst", () => {
    expect(
      reviewDecision("Décision. L'aide sociale est refusée. Les situations de détresse selon l'art. 12 Cst. sont examinées.").map((f) => f.type),
    ).not.toContain("emergency_aid_not_addressed");
  });
});
