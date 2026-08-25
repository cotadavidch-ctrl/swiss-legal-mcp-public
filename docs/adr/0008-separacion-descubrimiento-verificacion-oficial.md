# ADR 0008 — Separación entre descubrimiento (agregador) y verificación oficial

## Estado

Aceptado e implementado (Fase 2, 2026-07-26).

## Contexto

El encargo exige explícitamente: "no marques un documento como verificado oficialmente solo porque tenga una URL oficial" y que `OfficialSourceResolver` en esta fase se limite a detectar sintaxis/dominio, sin descargar ni scrapear contenido. Esto responde a un riesgo real: mezclar "el agregador dice que hay una URL oficial" con "hemos confirmado que esa URL es correcta y su contenido coincide" induciría a error a cualquier usuario del asistente jurídico.

## Decisión

Se introduce una separación estructural en el modelo de datos (`packages/documents/src/normalizedDocument.ts`) y en el código:

1. **`provenance.aggregatorUrl`** — siempre presente cuando `officialCharacter === "unofficial_aggregator"` (impuesto por un `superRefine` de Zod). Es la URL de la que el proveedor obtuvo realmente el documento.
2. **`provenance.officialSourceUrl`** — opcional, **nunca inventado**. Solo se rellena cuando `OfficialSourceResolver.resolve(original_url)` devuelve `isOfficialCandidate: true`.
3. **`OfficialSourceResolver`** (`packages/providers/entscheidsuche/src/officialSourceResolver.ts`) en Fase 2 hace _solo_ tres cosas, deliberadamente nada más:
   - Valida que la URL sea sintácticamente correcta y use `https:`.
   - Rechaza `localhost`, IPs privadas/loopback (IPv4 y IPv6) y cualquier IP pública cruda (protección SSRF — ver sección de seguridad).
   - Comprueba que el dominio esté en una allowlist configurable de dominios judiciales suizos conocidos (`ENTSCHEIDSUCHE_ALLOWED_OFFICIAL_DOMAINS`).
   - **No hace ninguna petición HTTP.** No descarga el contenido oficial, no sigue redirecciones, no compara textos. Eso queda fuera de alcance de Fase 2.
4. Un documento con `officialSourceUrl` presente **sigue teniendo `officialCharacter: "unofficial_aggregator"`** — la presencia de esa URL nunca cambia el carácter oficial del documento en sí. Verificado con test dedicado (`normalizedDocument.test.ts`, `mapper.test.ts`).

## Consecuencias

- Hallazgo empírico relevante (ver ADR 0005, actualización Fase 2): en la práctica, `original_url` fue `null` en el 100% de los documentos observados durante esta fase. `officialSourceUrl` quedará vacío en la inmensa mayoría de los resultados reales hoy — la funcionalidad existe y está probada, pero su impacto práctico actual es bajo hasta que entscheidsuche.ch (o una fuente futura) aporte URLs oficiales de forma más consistente.
- Como no se realiza ninguna petición de red hacia `officialSourceUrl`, no hay superficie SSRF activa en esta fase más allá de la validación sintáctica en sí — pero la allowlist y el rechazo de IPs privadas/localhost ya quedan implementados y probados para cuando una fase futura (verificación real de fuente oficial) añada la descarga.
- Cuando una fase futura implemente la descarga/verificación real del contenido oficial, deberá releer este ADR: tendrá que añadir validación de la cadena de redirecciones contra la misma allowlist antes de seguir cualquier redirect (no implementado ahora porque no hay descarga que redirigir).
