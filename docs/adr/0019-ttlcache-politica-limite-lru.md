# ADR 0019 — `TtlCache` con límite de tamaño y política LRU

## Estado

Aceptado e implementado (revisión arquitectónica pre-Fase 4, 2026-07-26; usado por los tres proveedores de Fase 4 desde su implementación).

## Contexto

`TtlCache` (`packages/shared/src/ttlCache.ts`), compartida desde Fase 3 por `EntscheidsucheMcpProvider` y `FedlexProvider`, no tenía límite de tamaño ni barrido de entradas expiradas: un proceso de larga duración con muchas claves distintas (p. ej. muchos documentos SECO/BSV/ESTV distintos consultados a lo largo del tiempo) podía crecer sin cota, un riesgo de memoria identificado en la revisión arquitectónica pre-Fase 4 y marcado como prerrequisito obligatorio antes de añadir tres proveedores nuevos que la usarían intensivamente (listados + documentos individuales, cada uno con su propia clave de caché).

## Decisión

1. `TtlCache` acepta un segundo parámetro de constructor, `maxEntries` (default `1000`), además del TTL existente.
2. **Política LRU (least recently used)**, no FIFO: cada `get()` exitoso reinserta la entrada en el `Map` interno (JS preserva el orden de inserción), moviéndola al final -- el primer elemento del `Map` es siempre el menos usado recientemente.
3. Al alcanzar `maxEntries`, `set()` invoca `makeRoom()`, que primero purga cualquier entrada ya expirada (barrido de expirados, gratis porque ya se está iterando) y, si tras eso sigue al límite, evict la entrada LRU (la primera en el orden de iteración) hasta volver a caber. Invariante verificada por test: `entries.size <= maxEntries` después de cualquier `set()`.
4. Cada proveedor de Fase 4 (`SecoProvider`, `BsvProvider`, `EstvProvider`) configura su propio `cacheMaxEntries` (default `500`) vía variable de entorno (`{SECO,BSV,ESTV}_CACHE_MAX_ENTRIES`), independiente entre proveedores -- ninguno comparte instancia de caché con otro.

## Consecuencias

- Los tres proveedores de Fase 4 heredan la protección de memoria acotada sin código adicional, simplemente instanciando `TtlCache` con el límite configurado.
- Un `TtlCache` con TTL `0` sigue siendo un "always miss" explícito (comportamiento previo sin cambios); el límite de tamaño solo importa cuando el TTL es positivo y el proceso vive lo suficiente para acumular muchas claves.
- Los proveedores de Fase 2-3 (`entscheidsuche`, `fedlex`) se benefician automáticamente del mismo límite por ser el mismo `TtlCache` compartido, sin requerir cambios en su propio código -- consistente con el principio de extraer la lógica a `packages/shared` en vez de duplicarla.
