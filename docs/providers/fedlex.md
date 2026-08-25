# Proveedor: Fedlex (`FedlexProvider`)

Estado: implementado en Fase 3 (legislación federal). Ver [`docs/provider-contracts/fedlex.md`](../provider-contracts/fedlex.md) para el contrato técnico exacto (propiedades JOLux verificadas, esquemas SPARQL, límites, errores) y los ADR de Fase 3 (`docs/adr/00XX-fedlex-*.md`) para las decisiones arquitectónicas.

Esta fase se limita exclusivamente a **legislación federal vía Fedlex**. No se implementa SECO, BSV, ESTV, Zefix, SHAB ni legislación cantonal — eso queda para fases futuras (ver propuesta de Fase 4 al final de `IMPLEMENTATION_STATUS.md`).

## Qué es

Fedlex (`fedlex.admin.ch` / `fedlex.data.admin.ch`) es la plataforma oficial de publicación del derecho federal suizo, operada por la Cancillería Federal. Expone un endpoint SPARQL público (`https://fedlex.data.admin.ch/sparqlendpoint`) sin autenticación, con los datos modelados según la ontología **JOLux** (`http://data.legilux.public.lu/resource/ontology/jolux#`) — una ontología originalmente construida para el sistema legislativo de Luxemburgo, reutilizada tal cual por Fedlex. No existe una API REST propia documentada; el único punto de acceso estructurado verificado es SPARQL.

**Es siempre fuente oficial de primer orden.** A diferencia de `entscheidsuche.ch` (Fase 2, agregador no oficial de jurisprudencia), todo lo que devuelve Fedlex es la publicación oficial misma (o una manifestación oficial de la misma), no un espejo de terceros. No se aplica `UnofficialSourceWarning` a los resultados de este proveedor.

## Cómo se integra

`FedlexProvider` (`packages/providers/fedlex/`) es un cliente **SPARQL 1.1 sobre HTTPS** (peticiones `GET` con el parámetro `query`, `Accept: application/sparql-results+json`) — no un cliente MCP como `EntscheidsucheMcpProvider`, porque Fedlex no expone un servidor MCP propio. Reutiliza de `packages/shared` el `TtlCache` y el `CircuitBreaker` extraídos en esta misma fase del código de entscheidsuche, y aplica el mismo patrón de reintentos con backoff exponencial + jitter solo para errores transitorios. Las consultas SPARQL están parametrizadas (nunca se interpola texto de usuario directamente en la cadena de consulta) para evitar inyección SPARQL.

Para el contenido normativo estructurado (artículos, párrafos) se parsea el XML **Akoma Ntoso** real que Fedlex publica como una de las manifestaciones de cada expresión de idioma — nunca con expresiones regulares sobre texto plano. Para las versiones que no tienen manifestación XML (ver "Hueco histórico" abajo), el proveedor expone un adaptador separado que trabaja sobre la manifestación HTML/PDF disponible y marca explícitamente el resultado como no estructurado.

## Modelo de datos (FRBR vía JOLux)

Confirmado en vivo (ver contrato técnico para el detalle completo de propiedades):

- **Work** = `jolux:ConsolidationAbstract`: la norma en abstracto, sin fecha ni idioma concreto. Aquí vive el número RS/SR (`jolux:historicalLegalId`) y el enlace al Acto de la Colección Oficial (`jolux:basicAct`).
- **Expression** (nivel Work) = idioma abstracto de la norma, vía `jolux:isRealizedBy`.
- **Consolidation** = versión fechada concreta (también un `jolux:Work` en RDF, pero semánticamente es la "versión en vigor entre fecha X y fecha Y"), con `jolux:dateApplicability`/`jolux:dateEndApplicability`.
- **Expression** (nivel Consolidation) = idioma de esa versión fechada concreta.
- **Manifestation** = `jolux:isEmbodiedBy`, un archivo concreto en un formato concreto (xml, html, pdf-a, docx), con su URL pública en `jolux:isExemplifiedBy`.

## Principios operativos (hallazgos verificados en vivo)

1. **El RS/SR no es un identificador único a través del tiempo — confirmado con dos ejemplos reales independientes.** RS 832.10 identifica dos actos reales distintos: la antigua KVG de 1911 (derogada en 1996) y la KVG actual de 1994 (vigente desde 1996) — ver `tests/fixtures/fedlex/jolux_rs_832-10_kvg_ambiguous.json`. Y, descubierto durante la integración en vivo de `FedlexProvider` (no anticipado en la auditoría inicial), RS **101** identifica igualmente la Constitución de 1999 vigente Y su predecesora derogada, la Constitución de 1874 — ver `tests/fixtures/fedlex/jolux_rs_101_constitution_ambiguous.json`. Esto confirma que reutilizar el RS de una norma derogada en su sucesora es un patrón general de Fedlex. `search_legislation`/`get_law` con `systematicNumber` deben estar preparados para devolver más de un resultado (`AmbiguousCitationError` cuando se pide una norma concreta) y advertir de la ambigüedad, nunca asumir unicidad.
2. **Hueco histórico real en la cobertura estructurada, con corte exacto localizado.** Se escanearon en vivo las 38 versiones fechadas reales de la Constitución: todas las consolidaciones de `2000-01-01` a `2020-01-01` solo tienen manifestaciones `doc`/`pdf-a`; la primera con XML/Akoma Ntoso es `2021-01-01` (ver `tests/fixtures/fedlex/akoma_ntoso_cutover_scan_constitution.json`). Este corte es un dato empírico de este acto concreto, no una regla general documentada por Fedlex, así que `FedlexProvider` comprueba dinámicamente qué manifestaciones existen por cada consolidación en vez de asumir un año de corte fijo.
3. **Resolución temporal determinista y verificada.** El algoritmo "versión aplicable en fecha X" (elegir la Consolidation donde `dateApplicability <= X` y `dateEndApplicability` ausente o `>= X`) se confirmó viable con datos reales: ~40 versiones fechadas de la Constitución (2000 a una versión futura ya programada en 2029) y 100 versiones fechadas del Código de Obligaciones. `get_article_at_date` implementa exactamente este algoritmo y devuelve como evidencia la Consolidation elegida (su ELI fechado y su intervalo de vigencia), nunca una fecha "inventada" cuando cae fuera de cobertura — en ese caso se devuelve una advertencia explícita.
4. **El título a nivel de Consolidation fechada puede ser un literal genérico** (p. ej. `"Consolidation: 101 - 2000-01-01"`) en vez del título real de la ley en versiones antiguas. El mapeador usa siempre el título de la `ConsolidationAbstract` (nivel Work) como título canónico, documentando la discrepancia quan aparece.
5. **Hallazgo de seguridad: `jolux:isExemplifiedByPrivate`/`jolux:wasExemplifiedByPrivate` apuntan a `intranet.fedlex.admin.ch`**, un dominio interno no destinado al público, visible únicamente porque el endpoint SPARQL público expone esas triplas. El proveedor nunca construye ni sigue URLs a partir de estos predicados; el allowlist de dominios oficiales (`fedlex.admin.ch`, `fedlex.data.admin.ch`) rechaza explícitamente cualquier subdominio `intranet.*`.
6. **Multilingüismo confirmado pero no generalizable.** La Constitución federal tiene expresiones reales en 5 idiomas (de/fr/it/rm/en), incluido romanche. El Código de Obligaciones solo mostró de/fr/it en las consultas realizadas. El romanche se modela siempre en el esquema, pero solo se marca disponible cuando el propio documento consultado lo confirma — nunca por generalización desde otro acto.
7. **Consultas de texto libre sin índice son lentas** (~58s observado con `FILTER(CONTAINS(...))`). Las búsquedas reales de esta fase usan propiedades indexadas (`jolux:historicalLegalId`, `jolux:isMemberOf`) en vez de escaneo de texto libre; `search_legislation` advierte explícitamente cuando la búsqueda solicitada no es full-text real, sino filtrado por número/abreviatura/ELI.

## Herramientas MCP activadas en Fase 3

Solo estas seis, según lo exigido para esta fase:

- `search_legislation` → búsqueda por query/idioma/número sistemático/abreviatura/ELI/rango de fechas/estado, con paginación y advertencia explícita cuando no es full-text real.
- `get_law` → recupera el acto completo o su manifestación oficial más apropiada, por ELI, número sistemático, `documentId` o idioma+fecha.
- `get_article` → localiza un artículo vía Akoma Ntoso (`eId="art_N"`) cuando existe manifestación XML; usa el adaptador histórico cuando no.
- `get_article_at_date` → resuelve la Consolidation legalmente aplicable en una fecha dada, con evidencia de la elección y advertencia si la fecha cae fuera de cobertura histórica.
- `compare_article_versions` → compara dos versiones reales, preservando texto anterior/posterior, distinguiendo cambio literal de resumen generado.
- `get_amendment_history` → devuelve únicamente las modificaciones observables en Fedlex (vía las consolidaciones fechadas y sus metadatos de publicación), sin inferir relaciones que Fedlex no expone.

`get_transitional_provisions`, `verify_legal_citation`, `search_cantonal_legislation`, `identify_applicable_version` e `identify_related_regulations` permanecen desactivadas: no hay soporte real, probado y documentado para ellas en esta fase (ver `docs/tool-catalog.md` para el detalle de por qué cada una queda fuera).

## `LegislationProviderRegistry`

Se añade un registro específico para proveedores de legislación, hermano de `ProviderRegistry` (que ya cubre jurisprudencia), preparado para que futuras fases añadan proveedores cantonales sin tocar `FedlexProvider`. En esta fase solo se registra `FedlexProvider`; no se implementa ningún proveedor cantonal.

## Resiliencia y seguridad

Mismo patrón que `EntscheidsucheMcpProvider`: timeout configurable, reintentos con backoff exponencial + jitter solo para errores transitorios (timeout, HTTP 429/502/503/504), circuit breaker, caché TTL en memoria que nunca cachea errores, límite de tamaño de respuesta. Específico de Fedlex: allowlist de dominios oficiales (`fedlex.admin.ch`, `fedlex.data.admin.ch`, rechazando explícitamente `intranet.fedlex.admin.ch` y cualquier otro dominio), bloqueo de IPs privadas/localhost/redirecciones externas, parseo XML con entidades externas deshabilitadas y protección contra bombas XML (billion laughs), validación de `Content-Type`, hash de contenido y `retrievedAt` preservados en cada documento normalizado. Detalle exacto en el contrato técnico y en los ADR de Fase 3.

## Correcciones pendientes de Fase 2 (cerradas en esta fase)

Ver `docs/source-audit.md` y `IMPLEMENTATION_STATUS.md` (sección Fase 3) para el estado de: (1) la documentación de entscheidsuche.ch pendiente de lectura manual o su inaccesibilidad documentada, y (2) la confirmación de que `bger.ch` no se implementa en esta fase, quedando la jurisprudencia dependiente de un agregador no oficial tal como se documentó en Fase 2.
