# Proveedor: ESTV/AFC (`EstvProvider`)

Estado: implementado en Fase 4, alcance limitado al portal clásico. Ver [`docs/provider-contracts/estv.md`](../provider-contracts/estv.md) para el contrato técnico exacto y las limitaciones explícitas del sistema JSF de MWST-Infos.

## Qué es

La Eidgenössische Steuerverwaltung (ESTV/AFC) publica circulares (Kreisschreiben), comunicaciones e instrucciones sobre práctica tributaria federal: impuesto federal directo, IVA, impuesto de timbre, impuesto anticipado, entre otros. Opera realmente **tres sistemas distintos** (ver contrato técnico); Fase 4 implementa únicamente el portal institucional clásico `www.estv.admin.ch`, por ser el único de los tres directamente accesible sin ejecución de JavaScript.

## Cómo se integra

`EstvProvider` (`packages/providers/estv/`) parsea el HTML real de las páginas `de/kreisschreiben-direkten-bundessteuer`, `de/kreisschreiben-stempelabgaben` y `de/kreisschreiben-verrechnungssteuer`, extrayendo cada `<a class="download-item" aria-label="...">` — el `aria-label` entrega número de circular y título completo en un atributo limpio, la mejor superficie de extracción entre las tres fuentes de Fase 4.

## Principios operativos (hallazgos verificados en vivo)

1. **`aria-label` como fuente primaria de `referenceNumber`/título** — más fiable que el título libre de SECO o el nombre de archivo.
2. **Tres formatos de referencia distintos para el mismo documento, no reconciliados** (nombre de archivo, `aria-label`, pie de página del PDF) — se documentan todos, se usa el del `aria-label` como canónico.
3. **Sin "gültig ab" en portada**: la fecha de entrada en vigor está en el cuerpo del PDF (sección "Inkrafttreten"), no extraíble de forma fiable; `effectiveDate` queda ausente cuando no hay superficie estructurada.
4. **Cobertura histórica profunda pero sin cadena de versión**: circulares desde 1995 listadas como entradas independientes, no versiones relacionadas de un mismo documento. `ProviderCapabilities.getHistoricalVersion: false`.
5. **El sistema JSF de MWST-Infos (`gate.estv.admin.ch`) no se implementa**: requiere JavaScript real (confirmado); se documenta su existencia y estructura pero queda fuera de alcance, consistente con "Playwright solo si es estrictamente necesario" — no lo es, dado que existe una alternativa completa dentro de la misma agencia.

## Herramientas MCP activadas en Fase 4

- `search_estv_documents` → busca sobre las tres páginas de Kreisschreiben del portal clásico (por texto, tipo administrativo, materia, rango de fechas).
- `get_official_document` (compartida) → recupera un documento por `documentId` o URL oficial validada.

## Resiliencia y seguridad

Mismo patrón compartido (timeout, reintentos solo en errores transitorios, circuit breaker, caché TTL acotada, allowlist SSRF restringida a `www.estv.admin.ch`, límite de tamaño de respuesta, sanitización HTML, hash y `retrievedAt` en cada documento). La cookie de sesión F5/WAF observada en las descargas se descarta entre peticiones, igual que en BSV.
