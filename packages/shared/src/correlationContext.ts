import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage<string>();

/** Ejecuta `fn` con un correlation id disponible via getCorrelationId(). */
export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return storage.run(correlationId, fn);
}

/** Devuelve el correlation id activo, si la llamada ocurre dentro de runWithCorrelationId(). */
export function getCorrelationId(): string | undefined {
  return storage.getStore();
}
