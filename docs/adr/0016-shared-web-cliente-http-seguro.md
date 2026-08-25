# ADR 0016 — `packages/shared-web` y `SecureHttpClient` compartido

## Estado

Aceptado e implementado (Fase 4, 2026-07-27).

## Contexto

SECO, BSV y ESTV son los primeros tres proveedores que descargan HTML y PDF directamente por HTTP (no MCP como `entscheidsuche`, no SPARQL como `fedlex`). Sin un componente compartido, cada uno habría reimplementado -- por tercera vez, tras `EntscheidsucheRemoteClient` y `FedlexSparqlClient` -- la misma lógica de timeout, reintentos con backoff+jitter, circuit breaker, límite de tamaño de respuesta y protección SSRF, exactamente la duplicación que la revisión arquitectónica pre-Fase 4 identificó como deuda técnica y que la instrucción de Fase 4 prohíbe explícitamente repetir una tercera vez ("no copies-pega").

## Decisión

1. Se crea un paquete nuevo, `packages/shared-web` (`@swiss-legal-mcp/shared-web`), separado de `packages/shared`: `shared` se mantiene deliberadamente ligero (sin dependencias de parsing HTML/PDF) porque lo usan `packages/core`, `apps/mcp-server` y `apps/admin-cli`, ninguno de los cuales necesita `cheerio`/`pdf-parse`. `shared-web` depende de `shared` (reutiliza `CircuitBreaker`) y de `core` (para los errores tipados de descarga).
2. `SecureHttpClient` (`packages/shared-web/src/secureHttpClient.ts`) generaliza el patrón ya usado en `FedlexSparqlClient`/`EntscheidsucheRemoteClient`: timeout vía `AbortController`, reintentos con backoff+jitter solo para errores transitorios (timeout, HTTP 429/502/503/504), circuit breaker de `packages/shared`, lectura de cuerpo acotada por bytes reales (no solo `Content-Length`), y validación opcional de `Content-Type`.
3. **Redirecciones controladas**: `redirect: "manual"` explícito + bucle propio que revalida CADA salto contra la allowlist de dominio (nunca solo la URL inicial) hasta un máximo configurable de saltos -- a diferencia de dejar que `fetch` siga redirecciones automáticamente, que habría permitido escapar la allowlist SSRF en un salto intermedio.
4. `DomainAllowlistResolver` (generalización de `OfficialSourceResolver`/`FedlexSourceResolver`, ver `packages/shared/src/domainAllowlistResolver.ts`) se reutiliza tal cual, en vez de escribir un cuarto resolvedor. Los proveedores de Fase 2-3 NO se migraron a esta clase compartida en este cambio (fuera del alcance autorizado de Fase 4); queda como deuda de prioridad baja en `IMPLEMENTATION_STATUS.md`.
5. Nunca persiste cookies entre peticiones: cada llamada usa un `fetch` nuevo sin cookie jar -- las cookies de sesión observadas en BSV/ESTV (DNN, GA, F5/WAF) no son de autenticación y no deben reenviarse (ver `docs/provider-contracts/bsv.md`/`estv.md`).

## Consecuencias

- `SecoProvider`, `BsvProvider` y `EstvProvider` comparten un único cliente HTTP seguro probado una sola vez (19 tests propios en `packages/shared-web`), en vez de tres implementaciones casi idénticas con sus propios tests.
- Un futuro proveedor HTML/PDF (p. ej. un portal cantonal) reutiliza `SecureHttpClient` directamente sin reescribir SSRF/retry/circuit breaker.
- Queda como deuda documentada (no resuelta en Fase 4): unificar `DomainAllowlistResolver` con los resolvedores duplicados de `entscheidsuche`/`fedlex` (Fase 2-3), y decidir si `SecureHttpClient` debería reemplazar `sizeLimitedFetch` en `FedlexSparqlClient`/`EntscheidsucheRemoteClient` en una fase futura.
