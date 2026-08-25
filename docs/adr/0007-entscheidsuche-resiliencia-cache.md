# ADR 0007 — Estrategia de resiliencia y caché para `EntscheidsucheMcpProvider`

## Estado

Aceptado e implementado (Fase 2, 2026-07-26).

## Contexto

`EntscheidsucheMcpProvider` depende de un servicio de terceros gratuito y sin SLA publicado (ver `docs/provider-contracts/entscheidsuche.md`). El encargo de Fase 2 exige explícitamente: timeout configurable, reintentos solo para errores transitorios, backoff exponencial con jitter, circuit breaker, y caché en memoria con TTL que nunca almacene errores.

## Decisión

### Clasificación de errores (qué se reintenta y qué no)

Verificado leyendo el código compilado del SDK oficial de MCP:

- **Transitorios (se reintentan):** `McpError` con `code === ErrorCode.RequestTimeout` o `ErrorCode.ConnectionClosed`; `StreamableHTTPError` con `code` en `{429, 502, 503, 504}`.
- **No transitorios (nunca se reintentan):** cualquier `CallToolResult.isError: true` devuelto por el servidor remoto (validación, herramienta desconocida — ver contrato técnico), que se traduce en `ProviderResponseError` (nuevo error tipado en `packages/core/src/errors.ts`); y cualquier otro código HTTP no listado arriba.
- Un resultado vacío (`total: 0, hits: []`) **no es un error**: nunca entra en la lógica de reintento porque no lanza excepción.

### Backoff exponencial con jitter

Estrategia "full jitter" (AWS Architecture Blog, "Exponential Backoff And Jitter"): `espera = random(0, min(maxDelayMs, baseDelayMs * 2^intento))`. Se eligió sobre un backoff con jitter parcial por su simplicidad y porque evita la sincronización de reintentos entre múltiples instancias del cliente mejor que un backoff fijo o con jitter aditivo.

### Circuit breaker

Máquina de 3 estados (cerrado/abierto/semiabierto) implementada desde cero en `packages/providers/entscheidsuche/src/circuitBreaker.ts`, sin dependencias externas (no se justificaba añadir una librería para ~50 líneas de lógica bien acotada). Umbral de fallos consecutivos y tiempo de enfriamiento configurables por entorno. En estado abierto, `EntscheidsucheRemoteClient.callTool()` falla inmediatamente con `ProviderUnavailableError` **sin llamar a `fetch`**, verificado explícitamente en `remoteClient.test.ts`.

### Caché en memoria

`TtlCache<T>` genérico (`packages/providers/entscheidsuche/src/cache.ts`), una instancia por tipo de dato (`server_info`, `list_hierarchy`, `list_facets`, documentos individuales por id), con TTL configurable independiente por tipo. Reglas:

- Solo se cachea tras una respuesta **exitosa**; nunca se cachea una excepción (verificado: `entscheidsucheProvider.test.ts`, "nunca cachea un error").
- `healthCheck()` reutiliza la caché de `server_info` en vez de forzar una llamada de red fresca en cada `/ready` — es una decisión deliberada de coste/latencia, documentada aquí para que no se confunda con un descuido.
- `search`/`search_by_case_number` **no se cachean** (cada consulta con filtros distintos generaría demasiadas claves de caché de bajo valor); solo se cachean los recursos con alta probabilidad de reutilización idéntica (server_info, hierarchy, facets, un documento concreto por id).

### Límite de tamaño de respuesta

`createSizeLimitedFetch()` envuelve el `fetch` inyectado en `StreamableHTTPClientTransport`: comprueba `Content-Length` primero (rápido) y, si no está presente o es incorrecto, cuenta bytes reales mientras lee el stream, abortando si se supera `ENTSCHEIDSUCHE_MAX_RESPONSE_BYTES`.

## Consecuencias

- La resiliencia se probó con transporte mockeado (`vi.stubGlobal("fetch", ...)`) contra el `Client`/`StreamableHTTPClientTransport` reales del SDK oficial, no con una reimplementación simplificada — da confianza real de que el mecanismo funciona con el protocolo tal cual lo habla el SDK.
- Limitación conocida: el límite de tamaño de respuesta materializa el cuerpo completo en memoria antes de continuar (no hace streaming verdadero hacia el parser JSON-RPC); aceptable para los tamaños de documento observados (hasta ~84.000 caracteres), a revisar si en el futuro se manejan documentos mucho más grandes.

## Actualización (revisión arquitectónica pre-Fase 4, 2026-07-26)

Las rutas de archivo citadas arriba (`packages/providers/entscheidsuche/src/circuitBreaker.ts` y `packages/providers/entscheidsuche/src/cache.ts`) **ya no existen**: en Fase 3 ambas clases (`TtlCache`, `CircuitBreaker`) se extrajeron sin cambios funcionales a `packages/shared/src/ttlCache.ts` y `packages/shared/src/circuitBreaker.ts`, porque `FedlexProvider` necesitaba exactamente la misma lógica. `FedlexSparqlClient` reutiliza esas mismas clases (ver ADR 0009 y `docs/architecture.md`). La decisión y el razonamiento de este ADR siguen vigentes; solo la ubicación del código cambió. Este historial no se reescribe — se deja esta nota como referencia para quien lea el ADR original.
