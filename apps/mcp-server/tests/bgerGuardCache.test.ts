import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertBgerNotCoolingDown,
  BgerCooldownError,
  looksLikeBgerChallenge,
  recordBgerChallenge,
  recordBgerSuccess,
  resetBgerGuardForTests,
} from "../src/tools/bgerGuard.js";
import { bgerCacheTtlMs, readBgerCache, writeBgerCache } from "../src/tools/bgerCache.js";
import { paceBgerRequest } from "../src/tools/bgerTlsFetch.js";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "bger-guard-"));
  process["env"]["SWISS_LEGAL_BGER_STATE_DIR"] = dir;
  process["env"]["SWISS_LEGAL_BGER_CACHE_DIR"] = path.join(dir, "cache");
  resetBgerGuardForTests();
});

afterEach(() => {
  delete process["env"]["SWISS_LEGAL_BGER_STATE_DIR"];
  delete process["env"]["SWISS_LEGAL_BGER_CACHE_DIR"];
  resetBgerGuardForTests();
  fs.rmSync(dir, { recursive: true, force: true });
});

const CHALLENGE_PAGE = Buffer.from(
  '<html style="height:100%"><head><META NAME="ROBOTS" CONTENT="NOINDEX, NOFOLLOW"><script type="text/javascript" src="/_Incapsula_Resource?SWJIYLWA=x"></script></head><body></body></html>',
);

describe("looksLikeBgerChallenge", () => {
  it("reconoce la pagina de reto de Incapsula", () => {
    expect(looksLikeBgerChallenge(CHALLENGE_PAGE)).toBe(true);
  });

  it("no confunde una pagina normal ni una grande con un reto", () => {
    expect(looksLikeBgerChallenge(Buffer.from("<html>Urteil 4A_1/2024</html>"))).toBe(false);
    const big = Buffer.concat([CHALLENGE_PAGE, Buffer.alloc(20_000, 32)]);
    expect(looksLikeBgerChallenge(big)).toBe(false);
    expect(looksLikeBgerChallenge(Buffer.alloc(0))).toBe(false);
  });
});

describe("pausa automatica tras un reto", () => {
  it("sin reto no bloquea", () => {
    expect(() => assertBgerNotCoolingDown()).not.toThrow();
  });

  it("tras un reto bloquea con BgerCooldownError y no hace peticiones", () => {
    const now = 1_000_000;
    recordBgerChallenge(now);
    expect(() => assertBgerNotCoolingDown(now + 60_000)).toThrow(BgerCooldownError);
    expect(() => assertBgerNotCoolingDown(now + 5 * 60_000 + 1)).not.toThrow();
  });

  it("la espera crece con cada reto seguido (5, 10, 20, 40, 60 min) y se detiene en 60", () => {
    const waits = [1, 2, 3, 4, 5, 6].map(() => recordBgerChallenge(0) / 60_000);
    expect(waits).toEqual([5, 10, 20, 40, 60, 60]);
  });

  it("una respuesta normal reinicia la escalada", () => {
    recordBgerChallenge(0);
    recordBgerChallenge(0);
    recordBgerSuccess();
    expect(() => assertBgerNotCoolingDown(1)).not.toThrow();
    expect(recordBgerChallenge(0) / 60_000).toBe(5);
  });

  it("la pausa sobrevive a un reinicio del servicio (estado en disco)", () => {
    recordBgerChallenge(Date.now());
    resetBgerGuardForTests(); // simula un proceso nuevo
    expect(() => assertBgerNotCoolingDown()).toThrow(BgerCooldownError);
  });

  it("el mensaje explica la pausa y que la cache sigue disponible", () => {
    recordBgerChallenge(Date.now());
    try {
      assertBgerNotCoolingDown();
      throw new Error("debia lanzar");
    } catch (error) {
      expect((error as Error).message).toContain("bger_cooldown_active");
      expect((error as Error).message).toContain("cache");
    }
  });
});

describe("cache en disco de bger.ch", () => {
  const docUrl =
    "https://www.bger.ch/ext/eurospider/live/de/php/clir/http/index.php?lang=de&type=show_document&highlight_docid=atf%3A%2F%2F133-III-335%3Ade";
  const searchUrl =
    "https://www.bger.ch/ext/eurospider/live/de/php/aza/http/index.php?lang=de&type=simple_query&query_words=Kaufvertrag";

  it("guarda y devuelve una respuesta 200", async () => {
    await writeBgerCache(docUrl, 200, "text/html", Buffer.from("<html>texto</html>"));
    const hit = await readBgerCache(docUrl);
    expect(hit?.status).toBe(200);
    expect(hit?.contentType).toBe("text/html");
    expect(hit?.body.toString()).toBe("<html>texto</html>");
  });

  it("no guarda respuestas que no son 200 ni cuerpos vacios", async () => {
    await writeBgerCache(docUrl, 503, "text/html", Buffer.from("x"));
    expect(await readBgerCache(docUrl)).toBeNull();
    await writeBgerCache(docUrl, 200, "text/html", Buffer.alloc(0));
    expect(await readBgerCache(docUrl)).toBeNull();
  });

  it("las sentencias duran 30 dias y las busquedas 6 horas", async () => {
    expect(bgerCacheTtlMs(docUrl)).toBe(30 * 24 * 3_600_000);
    expect(bgerCacheTtlMs(searchUrl)).toBe(6 * 3_600_000);
    const t0 = 1_000_000;
    await writeBgerCache(searchUrl, 200, "text/html", Buffer.from("resultados"), t0);
    expect(await readBgerCache(searchUrl, t0 + 5 * 3_600_000)).not.toBeNull();
    expect(await readBgerCache(searchUrl, t0 + 7 * 3_600_000)).toBeNull();
    await writeBgerCache(docUrl, 200, "text/html", Buffer.from("sentencia"), t0);
    expect(await readBgerCache(docUrl, t0 + 20 * 24 * 3_600_000)).not.toBeNull();
  });

  it("paceBgerRequest no espera con hosts ajenos a bger.ch ni con lo que ya esta en cache", async () => {
    const t0 = Date.now();
    await paceBgerRequest("https://www.fedlex.admin.ch/eli/cc/27/317_321_377/de");
    await writeBgerCache(docUrl, 200, "text/html", Buffer.from("texto"));
    await paceBgerRequest(docUrl);
    await paceBgerRequest("not a url");
    expect(Date.now() - t0).toBeLessThan(200);
  });

  it("sin directorio configurado en test no escribe nada", async () => {
    delete process["env"]["SWISS_LEGAL_BGER_CACHE_DIR"];
    await writeBgerCache(docUrl, 200, "text/html", Buffer.from("x"));
    expect(await readBgerCache(docUrl)).toBeNull();
  });
});
