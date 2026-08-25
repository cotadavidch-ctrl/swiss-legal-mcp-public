import { describe, expect, it } from "vitest";
import { CantonalJuProvider, buildJuDocumentId } from "./cantonalJuProvider.js";
import { CantonalLexWorkProvider } from "./cantonalLexWorkProvider.js";
import { CantonalSilProvider } from "./cantonalSilProvider.js";
import { CantonalSzProvider } from "./cantonalSzProvider.js";
import { CantonalZhProvider, buildZhDocumentId } from "./cantonalZhProvider.js";
import {
  loadCantonalBeLexWorkConfig,
  loadCantonalJuConfig,
  loadCantonalLexWorkConfig,
  loadCantonalSilConfig,
  loadCantonalSzConfig,
  loadCantonalZhConfig,
} from "./config.js";
import { LEXWORK_CANTONS } from "./lexWorkCantons.js";

/**
 * Pruebas de integracion REALES contra los portales cantonales reales.
 * Nunca se ejecutan por defecto. Corren con:
 *
 *   RUN_LIVE_INTEGRATION_TESTS=true pnpm test -- cantonal
 *   RUN_LIVE_CANTONAL_TESTS=true pnpm test -- cantonal
 *   RUN_LIVE_SZ_TESTS=true / RUN_LIVE_NE_TESTS=true / RUN_LIVE_JU_TESTS=true /
 *   RUN_LIVE_TI_TESTS=true / RUN_LIVE_VD_TESTS=true / RUN_LIVE_GE_TESTS=true
 *   (flags individuales del cierre de cobertura cantonal, cada uno tambien
 *   activado por RUN_LIVE_CANTONAL_TESTS=true)
 */
const liveEnabled =
  process.env["RUN_LIVE_INTEGRATION_TESTS"] === "true" ||
  process.env["RUN_LIVE_CANTONAL_TESTS"] === "true";
const cantonalGlobal = process.env["RUN_LIVE_CANTONAL_TESTS"] === "true";
const szEnabled = cantonalGlobal || process.env["RUN_LIVE_SZ_TESTS"] === "true";
const neEnabled = cantonalGlobal || process.env["RUN_LIVE_NE_TESTS"] === "true";
const geEnabled = cantonalGlobal || process.env["RUN_LIVE_GE_TESTS"] === "true";
const juEnabled = cantonalGlobal || process.env["RUN_LIVE_JU_TESTS"] === "true";
const tiEnabled = cantonalGlobal || process.env["RUN_LIVE_TI_TESTS"] === "true";
const vdEnabled = cantonalGlobal || process.env["RUN_LIVE_VD_TESTS"] === "true";

describe.skipIf(!liveEnabled)(
  "CantonalLexWorkProvider (Berna, integracion real, RUN_LIVE_CANTONAL_TESTS=true)",
  () => {
    const provider = new CantonalLexWorkProvider(loadCantonalBeLexWorkConfig({}));

    it("healthCheck() contra el indice real de leyes de Berna", async () => {
      const health = await provider.healthCheck();
      expect(health.healthy).toBe(true);
    }, 20_000);

    it("searchDocuments() real encuentra la Kantonale Ordnungsbussenverordnung (324.111)", async () => {
      const outcome = await provider.searchDocuments({ systematicNumber: "324.111" });
      expect(outcome.results.length).toBeGreaterThan(0);
      expect(outcome.sourceAttribution.officialCharacter).toBe("official");
    }, 30_000);
  },
);

describe.skipIf(!liveEnabled)(
  "CantonalLexWorkProvider (Berna, getDocument/getArticle reales, RUN_LIVE_CANTONAL_TESTS=true)",
  () => {
    const provider = new CantonalLexWorkProvider(loadCantonalBeLexWorkConfig({}));

    it("getDocument() real recupera el texto completo de la version vigente (324.111)", async () => {
      const doc = await provider.getDocument("cantonal-be:324.111");
      expect(doc.title).toContain("Ordnungsbussenverordnung");
      expect(doc.fullText!.length).toBeGreaterThan(50);
    }, 30_000);

    it("getArticle() real recupera el Art. 1 de la version vigente (324.111)", async () => {
      const doc = await provider.getArticle("324.111", "1");
      expect(doc.fullText!.length).toBeGreaterThan(0);
    }, 30_000);
  },
);

describe.skipIf(!liveEnabled)(
  "CantonalZhProvider (Zurich, integracion real, RUN_LIVE_CANTONAL_TESTS=true)",
  () => {
    const provider = new CantonalZhProvider(loadCantonalZhConfig({}));

    it("healthCheck() contra la pagina real de Gesetzessammlung", async () => {
      const health = await provider.healthCheck();
      expect(health.healthy).toBe(true);
    }, 20_000);

    it("fetchDocument() real descarga el Gemeindegesetz (131.1) y extrae texto", async () => {
      const id = buildZhDocumentId({
        systematicNumber: "131.1",
        effectiveFrom: "2015-04-20",
        effectiveTo: "2018-01-01",
        internalId: "105",
      });
      const doc = await provider.fetchDocument(id);
      expect(doc.title).toContain("Gemeindegesetz");
      expect(doc.fullText!.length).toBeGreaterThan(50);
    }, 30_000);

    it("searchDocuments() real encuentra el Gemeindegesetz por referenceNumber (131.1)", async () => {
      const outcome = await provider.searchDocuments({ referenceNumber: "131.1" });
      expect(outcome.results.length).toBeGreaterThan(0);
      expect(outcome.results[0]?.title).toContain("Gemeindegesetz");
    }, 30_000);
  },
);

describe.skipIf(!szEnabled)(
  "CantonalSzProvider (Schwyz, integracion real, RUN_LIVE_SZ_TESTS=true o RUN_LIVE_CANTONAL_TESTS=true)",
  () => {
    const provider = new CantonalSzProvider(loadCantonalSzConfig({}));

    it("healthCheck() contra la coleccion sistematica real", async () => {
      const health = await provider.healthCheck();
      expect(health.healthy).toBe(true);
    }, 20_000);

    it("getDocument() real descarga el PDF de la Verfassung (100.100) y extrae texto", async () => {
      const doc = await provider.getDocument("cantonal-sz:100.100");
      expect(doc.fullText!.length).toBeGreaterThan(50);
      expect(doc.provenance.contentHash).toMatch(/^[0-9a-f]{64}$/);
    }, 30_000);
  },
);

describe.skipIf(!geEnabled)(
  "CantonalSilProvider (Geneve, integracion real, RUN_LIVE_GE_TESTS=true o RUN_LIVE_CANTONAL_TESTS=true)",
  () => {
    const provider = new CantonalSilProvider(
      loadCantonalSilConfig({
        cantonCode: "GE",
        cantonName: "Geneve",
        baseUrl: "https://silgeneve.ch",
        bookPath: "legis/program/books/RSG",
        language: "fr",
        domains: ["silgeneve.ch"],
      }),
    );

    it("healthCheck() contra el catalogo real del libro RSG", async () => {
      const health = await provider.healthCheck();
      expect(health.healthy).toBe(true);
    }, 20_000);

    it("searchDocuments() real encuentra al menos un documento", async () => {
      const outcome = await provider.searchDocuments({ page: 1, pageSize: 5 });
      expect(outcome.results.length).toBeGreaterThan(0);
      expect(outcome.sourceAttribution.officialCharacter).toBe("official");
    }, 30_000);
  },
);

describe.skipIf(!neEnabled)(
  "CantonalSilProvider (Neuchatel, mismo adaptador SIL, RUN_LIVE_NE_TESTS=true o RUN_LIVE_CANTONAL_TESTS=true)",
  () => {
    const provider = new CantonalSilProvider(
      loadCantonalSilConfig({
        cantonCode: "NE",
        cantonName: "Neuchatel",
        baseUrl: "https://rsn.ne.ch",
        bookPath: "DATA/program/books/rsne",
        language: "fr",
        domains: ["rsn.ne.ch"],
      }),
    );

    it("healthCheck() contra el catalogo real del libro rsne", async () => {
      const health = await provider.healthCheck();
      expect(health.healthy).toBe(true);
    }, 20_000);

    it("searchDocuments() real encuentra la Constitution (101)", async () => {
      const outcome = await provider.searchDocuments({ systematicNumber: "101" });
      expect(outcome.results.length).toBeGreaterThan(0);
      expect(outcome.results[0]?.title).toContain("Constitution");
    }, 30_000);
  },
);

describe.skipIf(!juEnabled)(
  "CantonalJuProvider (Jura, integracion real, RUN_LIVE_JU_TESTS=true o RUN_LIVE_CANTONAL_TESTS=true)",
  () => {
    const provider = new CantonalJuProvider(loadCantonalJuConfig({}));

    it("healthCheck() contra Default.aspx real", async () => {
      const health = await provider.healthCheck();
      expect(health.healthy).toBe(true);
    }, 20_000);

    it("getDocument() real descarga la Constitution du Jura (idn=20002, id=36641)", async () => {
      const id = buildJuDocumentId({ idn: "20002", id: "36641" });
      const doc = await provider.getDocument(id);
      expect(doc.fullText!.length).toBeGreaterThan(50);
      expect(doc.provenance.contentHash).toMatch(/^[0-9a-f]{64}$/);
    }, 30_000);
  },
);

/**
 * TI y VD no tienen proveedor: la auditoria en vivo (ver docs/providers/
 * cantonal-legislation.md) confirmo un bloqueo real de infraestructura (F5
 * BIG-IP Bot Defense en TI, muro "Acces non autorise" en VD) y ningun
 * intento de evasion esta permitido por instruccion explicita del usuario.
 * Estas pruebas NO implementan un proveedor: son un chequeo de regresion
 * que confirma que el bloqueo documentado sigue vigente (fetch directo, sin
 * SecureHttpClient), para detectar si algun dia el acceso se abre. Nunca se
 * intenta sortear el bloqueo (sin headers especiales, sin reintentos, sin
 * resolucion de CAPTCHA).
 */
describe.skipIf(!tiEnabled)(
  "Ticino (TI): confirmacion de bloqueo real, RUN_LIVE_TI_TESTS=true o RUN_LIVE_CANTONAL_TESTS=true",
  () => {
    it("la Raccolta delle leggi real sigue sin devolver contenido real de catalogo (F5 Bot Defense/TSPD o pagina no encontrada, nunca el listado real de leyes)", async () => {
      const response = await fetch("https://www4.ti.ch/can/sw/raccolta-leggi/rl/", {
        headers: { "user-agent": "swiss-legal-mcp-audit/1.0 (+contact via repo)" },
      });
      const body = await response.text();
      // F5 Bot Defense no es determinista por cliente/sesion (verificado en
      // vivo: curl recibe el desafio TSPD, fetch de Node a veces recibe en
      // su lugar la pagina 404 real del propio CMS) -- se acepta cualquiera
      // de las dos senales reales de bloqueo observadas, nunca se exige
      // status!==200 solo (séria fragil ante ambas).
      const blocked = /TSPD|Pagina non trovata/i.test(body);
      expect(blocked).toBe(true);
      expect(body).not.toMatch(/raccolta sistematica delle leggi/i);
    }, 20_000);
  },
);

describe.skipIf(!vdEnabled)(
  "Vaud (VD): confirmacion de bloqueo real, RUN_LIVE_VD_TESTS=true o RUN_LIVE_CANTONAL_TESTS=true",
  () => {
    it("el portal real de publicacion legislativa (prestations.vd.ch) sigue devolviendo 'Acces non autorise'", async () => {
      const response = await fetch("https://prestations.vd.ch/robots.txt", {
        headers: { "user-agent": "swiss-legal-mcp-audit/1.0 (+contact via repo)" },
      });
      const body = await response.text();
      expect(body).toContain("non autoris");
    }, 20_000);
  },
);

/**
 * Verificacion real de UN healthCheck() por cada uno de los 19 cantones
 * LexWork confirmados en vivo en Fase 5B (ver LEXWORK_CANTONS y
 * docs/providers/cantonal-legislation.md). Cada canton se instancia con su
 * config real (mismo mecanismo que registry.ts) y se comprueba que el
 * catalogo real responde -- evidencia minima real por canton implementado,
 * exigida por el criterio de cierre de Fase 5.
 */
describe.skipIf(!liveEnabled)(
  "CantonalLexWorkProvider (los 19 cantones, healthCheck real, RUN_LIVE_CANTONAL_TESTS=true)",
  () => {
    for (const descriptor of LEXWORK_CANTONS) {
      it(`healthCheck() real para ${descriptor.cantonName} (${descriptor.cantonCode})`, async () => {
        const provider = new CantonalLexWorkProvider(
          loadCantonalLexWorkConfig({
            cantonCode: descriptor.cantonCode,
            baseUrl: descriptor.baseUrl,
            domains: descriptor.domains,
            language: descriptor.language,
          }),
        );
        const health = await provider.healthCheck();
        expect(health.healthy).toBe(true);
      }, 20_000);
    }
  },
);

/**
 * Chequeo estructural (sin red) de que RUN_LIVE_CANTONAL_TESTS=true activa
 * una operacion real (healthCheck/getDocument/searchDocuments para los 24
 * cantones con proveedor, o el chequeo de bloqueo persistente para TI/VD)
 * para los 26 cantones: 19 LexWork + ZH + SZ + GE + NE + JU (proveedor real,
 * ver describes anteriores) + TI + VD (sin proveedor, bloqueo verificado
 * arriba). Este test documenta el recuento; la cobertura de red real la
 * ejercen los describes anteriores, todos gateados por el mismo flag.
 */
describe("Cobertura cantonal declarada: 26/26 cantones tienen al menos una operacion real gateada por RUN_LIVE_CANTONAL_TESTS", () => {
  it("19 LexWork + ZH + SZ + GE + NE + JU (proveedor real) + TI + VD (bloqueo verificado) = 26", () => {
    const providerBacked = new Set([
      ...LEXWORK_CANTONS.map((d) => d.cantonCode),
      "ZH",
      "SZ",
      "GE",
      "NE",
      "JU",
    ]);
    const blockedWithEvidence = new Set(["TI", "VD"]);
    expect(providerBacked.size).toBe(24);
    expect(blockedWithEvidence.size).toBe(2);
    const all = new Set([...providerBacked, ...blockedWithEvidence]);
    expect(all.size).toBe(26);
  });
});
