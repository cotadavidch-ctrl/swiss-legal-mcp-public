interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

/** Limite por defecto cuando el consumidor no especifica maxEntries. */
const DEFAULT_MAX_ENTRIES = 1000;

/**
 * Cache en memoria con TTL por clave y tamano acotado. Nunca cachea
 * errores: solo `set()` con un valor exitoso. Un TTL de 0 desactiva el
 * cacheo (siempre "miss"). Extraida a packages/shared en Fase 3 porque
 * tanto EntscheidsucheMcpProvider (Fase 2) como FedlexProvider (Fase 3) la
 * necesitan identica.
 *
 * Politica de evicción (corrige la deuda tecnica encontrada en la revision
 * arquitectonica pre-Fase 4: antes no habia limite de tamano ni barrido de
 * expirados, asi que un proceso de larga duracion con muchas claves
 * distintas podia crecer sin cota):
 *
 * 1. **LRU (least recently used)**: cada `get()` exitoso mueve la entrada
 *    al final del orden de iteracion del `Map` interno (que en JS preserva
 *    el orden de insercion) -- por eso el primer elemento del `Map` es
 *    siempre el menos usado recientemente.
 * 2. Al alcanzar `maxEntries`, `set()` primero purga cualquier entrada ya
 *    expirada (barrido de expirados); si tras eso sigue al limite, evict el
 *    elemento LRU (el primero en el orden de iteracion) hasta volver a caber.
 *
 * `entries.size` nunca supera `maxEntries` despues de ninguna llamada a
 * `set()` -- verificado en `ttlCache.test.ts` con una prueba de crecimiento
 * acotado (miles de claves distintas, tamano final <= maxEntries).
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly maxEntries: number;

  constructor(
    private readonly ttlMs: number,
    maxEntries: number = DEFAULT_MAX_ENTRIES,
  ) {
    this.maxEntries = Math.max(1, maxEntries);
  }

  get(key: string): T | undefined {
    if (this.ttlMs <= 0) return undefined;
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    // LRU: reinsertar mueve la clave al final del orden de iteracion (MRU).
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.ttlMs <= 0) return;
    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else if (this.entries.size >= this.maxEntries) {
      this.makeRoom();
    }
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /** Purga expirados y, si sigue sin caber, evict la entrada LRU (la mas antigua en orden de iteracion). */
  private makeRoom(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now >= entry.expiresAt) {
        this.entries.delete(key);
      }
    }
    while (this.entries.size >= this.maxEntries) {
      const oldestKey: string | undefined = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
