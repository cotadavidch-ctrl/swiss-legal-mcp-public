import { describe, expect, it, vi } from "vitest";
import { TtlCache } from "./ttlCache.js";

describe("TtlCache", () => {
  it("devuelve undefined en un miss", () => {
    const cache = new TtlCache<string>(1000);
    expect(cache.get("x")).toBeUndefined();
  });

  it("devuelve el valor mientras no expire el TTL", () => {
    const cache = new TtlCache<string>(1000);
    cache.set("x", "valor");
    expect(cache.get("x")).toBe("valor");
  });

  it("expira tras el TTL configurado", () => {
    vi.useFakeTimers();
    const cache = new TtlCache<string>(100);
    cache.set("x", "valor");
    vi.advanceTimersByTime(101);
    expect(cache.get("x")).toBeUndefined();
    vi.useRealTimers();
  });

  it("con TTL 0 nunca cachea (siempre miss)", () => {
    const cache = new TtlCache<string>(0);
    cache.set("x", "valor");
    expect(cache.get("x")).toBeUndefined();
  });

  it("clear() vacia todas las entradas", () => {
    const cache = new TtlCache<string>(1000);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  describe("limite de tamano (maxEntries) y politica LRU", () => {
    it("crecimiento acotado: insertar muchas mas claves que maxEntries nunca supera el limite", () => {
      const cache = new TtlCache<number>(60_000, 100);
      for (let i = 0; i < 5000; i += 1) {
        cache.set(`key-${i}`, i);
        expect(cache.size).toBeLessThanOrEqual(100);
      }
      expect(cache.size).toBeLessThanOrEqual(100);
    });

    it("al alcanzar el limite, evict la entrada menos usada recientemente (LRU), no la mas reciente", () => {
      const cache = new TtlCache<string>(60_000, 3);
      cache.set("a", "1");
      cache.set("b", "2");
      cache.set("c", "3");
      // Tocar "a" la hace la mas usada recientemente; "b" pasa a ser la LRU.
      expect(cache.get("a")).toBe("1");
      cache.set("d", "4"); // fuerza evict: debe eliminar "b", no "a" ni "c"
      expect(cache.get("b")).toBeUndefined();
      expect(cache.get("a")).toBe("1");
      expect(cache.get("c")).toBe("3");
      expect(cache.get("d")).toBe("4");
    });

    it("al hacer sitio, purga primero entradas ya expiradas antes de evict por LRU", () => {
      vi.useFakeTimers();
      const cache = new TtlCache<string>(100, 2);
      cache.set("a", "1");
      vi.advanceTimersByTime(101); // "a" expira, pero sigue en el Map hasta que algo lo purgue
      cache.set("b", "2");
      // "a" ya expiro (no cuenta como valida), asi que insertar una tercera
      // clave debe purgar "a" en vez de evict "b" (que sigue siendo valida).
      cache.set("c", "3");
      expect(cache.get("b")).toBe("2");
      expect(cache.get("c")).toBe("3");
      vi.useRealTimers();
    });

    it("usa un limite por defecto razonable cuando no se especifica maxEntries", () => {
      const cache = new TtlCache<number>(60_000);
      for (let i = 0; i < 2000; i += 1) {
        cache.set(`key-${i}`, i);
      }
      expect(cache.size).toBeLessThan(2000);
      expect(cache.size).toBeGreaterThan(0);
    });
  });
});
