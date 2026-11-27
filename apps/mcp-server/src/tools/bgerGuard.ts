import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Pausa automatica del acceso a bger.ch tras un reto antibots (Incapsula).
 *
 * Seguir pidiendo mientras el portal esta devolviendo el reto no lo resuelve y alarga el
 * bloqueo: cada llamada de ChatGPT durante el bloqueo volvia a golpear al portal. Aqui, al
 * detectar el reto se corta TODO acceso a la red hacia bger.ch durante un tiempo creciente
 * (5, 10, 20, 40 y 60 min) y se vuelve a intentar despues; la primera respuesta normal
 * reinicia la escalada. El estado se guarda en disco para que un reinicio del servicio (cada
 * despliegue lo reinicia) no salte la pausa. No elude el reto: solo deja de provocarlo.
 */
const BASE_COOLDOWN_MS = 5 * 60_000;
const MAX_COOLDOWN_MS = 60 * 60_000;

interface GuardState {
  until: number;
  streak: number;
}

let state: GuardState | null = null;

export class BgerCooldownError extends Error {
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super(
      `bger_cooldown_active: el portal del Tribunal Federal devolvio un reto antibots; se pausan las peticiones ${Math.max(1, Math.ceil(retryAfterMs / 60_000))} min para no empeorar el bloqueo (las sentencias ya descargadas siguen disponibles desde la cache).`,
    );
    this.name = "BgerCooldownError";
    this.retryAfterMs = retryAfterMs;
  }
}

function stateFile(): string | null {
  const dir = process["env"]["SWISS_LEGAL_BGER_STATE_DIR"];
  if (dir) return path.join(dir, "bger-guard.json");
  if (process["env"]["NODE_ENV"] === "test") return null;
  return path.join(os.homedir(), ".local", "share", "swiss-legal-mcp", "bger-guard.json");
}

function load(): GuardState {
  if (state) return state;
  state = { until: 0, streak: 0 };
  const file = stateFile();
  if (file) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<GuardState>;
      if (typeof parsed.until === "number" && typeof parsed.streak === "number") {
        state = { until: parsed.until, streak: parsed.streak };
      }
    } catch {
      // sin estado previo: se empieza limpio
    }
  }
  return state;
}

function persist(): void {
  const file = stateFile();
  if (!file || !state) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(state));
  } catch {
    // no poder guardar el estado no debe romper la peticion
  }
}

export function resetBgerGuardForTests(): void {
  state = null;
}

/** Lanza BgerCooldownError si hay una pausa activa; no hace ninguna peticion. */
export function assertBgerNotCoolingDown(now: number = Date.now()): void {
  const current = load();
  if (current.until > now) throw new BgerCooldownError(current.until - now);
}

export function recordBgerChallenge(now: number = Date.now()): number {
  const current = load();
  current.streak += 1;
  const wait = Math.min(MAX_COOLDOWN_MS, BASE_COOLDOWN_MS * 2 ** (current.streak - 1));
  current.until = now + wait;
  persist();
  return wait;
}

export function recordBgerSuccess(): void {
  const current = load();
  if (current.streak === 0 && current.until === 0) return;
  current.streak = 0;
  current.until = 0;
  persist();
}

/** Una pagina de reto es pequena y trae los marcadores de Incapsula (verificado en vivo). */
export function looksLikeBgerChallenge(body: Buffer | Uint8Array): boolean {
  if (body.byteLength === 0 || body.byteLength > 8_000) return false;
  const text = Buffer.from(body).toString("latin1");
  return /_Incapsula_Resource|incap_ses|Request unsuccessful/i.test(text);
}
