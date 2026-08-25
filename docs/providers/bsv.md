# Proveedor: BSV/OFAS (`BsvProvider`)

Estado: implementado en Fase 4. Ver [`docs/provider-contracts/bsv.md`](../provider-contracts/bsv.md) para el contrato técnico exacto.

## Qué es

El Bundesamt für Sozialversicherungen (BSV/OFAS) publica sus circulares y directivas (Kreisschreiben, Rundschreiben, Mitteilungen, Weisungen) para las distintas ramas del seguro social suizo (AHV/AVS, IV/AI, EL/PC, EO/APG, BVG/LPP, ATSG/LPGA, KVG/LAMal donde aplica) no en su sitio institucional principal, sino en un portal dedicado propio, `sozialversicherungen.admin.ch`, explícitamente señalizado desde `www.bsv.admin.ch/de/vollzug`.

## Cómo se integra

`BsvProvider` (`packages/providers/bsv/`) parsea el HTML real servido por el portal DNN/2sxc: listados de carpeta (`/de/f/{folderId}`) y páginas de detalle/historial de versión (`/de/d/{docId}`), descargando el PDF vigente o una versión histórica específica mediante `/de/d/{docId}/download[?version=N]`.

## Principios operativos (hallazgos verificados en vivo)

1. **Historial de versiones real y descargable** — a diferencia de SECO, BSV expone explícitamente cada versión anterior de un documento con su propia fecha, número y enlace de descarga. `ProviderCapabilities.getHistoricalVersion: true`.
2. **Numeración de referencia inconsistente entre el pie del PDF y el "Dokumentennummer" del portal** — documentado, no reconciliado. Se usa el valor estructurado del portal como `referenceNumber` canónico; el valor del PDF se conserva en `rawMetadata`.
3. **Relaciones de sustitución solo en prosa libre dentro del PDF** — nunca se infieren automáticamente; `supersedesDocuments`/`supersededByDocument` quedan ausentes salvo fuente estructurada futura.
4. **Multilingüe por parámetro de query** (`?lang=fr`/`?lang=it`) sobre el mismo `documentId` — más limpio que el esquema de SECO (PDFs separados por idioma con títulos distintos).
5. **Solo la rama IV fue auditada en profundidad.** El resto de ramas se asume estructuralmente idéntica (misma plataforma DNN/2sxc) pero no verificada individualmente; se documenta como límite de confianza medio.

## Herramientas MCP activadas en Fase 4

- `search_bsv_documents` → busca sobre listados de carpeta reales (por texto, tipo administrativo, materia, rango de fechas, estado).
- `get_official_document` (compartida) → recupera un documento por `documentId` o URL oficial validada, con soporte opcional de versión histórica.

## Resiliencia y seguridad

Mismo patrón compartido (timeout, reintentos solo en errores transitorios, circuit breaker, caché TTL acotada, allowlist SSRF específica de `sozialversicherungen.admin.ch`, límite de tamaño de respuesta, sanitización HTML, hash y `retrievedAt` en cada documento). El cliente HTTP compartido descarta explícitamente las cookies de sesión DNN/GA entre peticiones — no forman parte de ningún flujo de autenticación y no deben persistirse.
