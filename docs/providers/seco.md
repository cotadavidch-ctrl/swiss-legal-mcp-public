# Proveedor: SECO (`SecoProvider`)

Estado: implementado en Fase 4 (documentación administrativa federal). Ver [`docs/provider-contracts/seco.md`](../provider-contracts/seco.md) para el contrato técnico exacto y los ADR de Fase 4 para las decisiones arquitectónicas.

## Qué es

El Staatssekretariat für Wirtschaft (SECO) publica en `www.arbeit.swiss` las directivas administrativas ("Weisungen", conocidas también por su nombre histórico "AVIG-Praxis"/"AVIG-Kreisschreiben") que rigen la aplicación uniforme del seguro de desempleo (AVIG/LACI) por parte de las oficinas cantonales de ejecución. Es fuente oficial de primer orden: las publicaciones son obras del propio SECO, no de un agregador.

## Cómo se integra

`SecoProvider` (`packages/providers/seco/`) es un cliente HTTP simple (no SPARQL, no MCP) que descarga y parsea la página HTML real de publicaciones (`https://www.arbeit.swiss/de/informationszentrum/publikationen` y su equivalente francés), extrayendo cada elemento `<a class="u-base-download-item">` con un parser HTML real (no expresiones regulares sobre el documento completo — solo se usa una regex acotada para extraer el código de práctica y la fecha "gültig ab" incrustados en el título, documentado explícitamente como aproximación).

## Principios operativos (hallazgos verificados en vivo)

1. **Sin archivo histórico para las Weisungen núcleo.** Solo se puede recuperar la versión vigente de cada práctica (KAE, SWE, RVEI, ALE, AMM, IE, öAV, ALE 883); `ProviderCapabilities.getHistoricalVersion` se marca `false` para SECO.
2. **El código de práctica cambia entre idiomas** (alemán "AVIG-Praxis KAE" vs. francés "Bulletin LACI RHT" para el mismo concepto). Cada versión de idioma se normaliza como un documento independiente, sin intentar unificarlas bajo un identificador inventado.
3. **`referenceNumber`/`effectiveDate` se extraen del título libre con una expresión regular tolerante.** Cuando el título no sigue el patrón esperado, ambos campos quedan ausentes — nunca se inventa un valor.
4. **Solo PDF, texto real verificado.** Sin XML/HTML estructurado; no hay granularidad de artículo/capítulo individual en esta fase.
5. **Dos dominios reales de descarga** (`www.arbeit.swiss` y `backend.arbeit.swiss`) — ambos en la allowlist SSRF de `SecoProvider`.

## Herramientas MCP activadas en Fase 4

- `search_seco_documents` → busca sobre el listado real de publicaciones (por texto, tipo administrativo, materia, rango de fechas).
- `get_official_document` (compartida entre SECO/BSV/ESTV) → recupera un documento concreto por `documentId` o URL oficial validada.

## Resiliencia y seguridad

Mismo patrón que Fedlex/entscheidsuche: timeout configurable, reintentos con backoff+jitter solo para errores transitorios, circuit breaker, caché TTL acotada (`packages/shared`), validación de dominio (allowlist SSRF-safe específica de SECO), límite de tamaño de respuesta, sanitización HTML antes de extraer texto, hash de contenido y `retrievedAt` preservados en cada documento normalizado.
