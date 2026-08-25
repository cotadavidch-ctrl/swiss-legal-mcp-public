# ADR 0010 — Selección de manifestación y allowlist estricta de dominios de Fedlex

## Estado

Aceptado e implementado (Fase 3, 2026-07-26).

## Contexto

Cada Expression fechada de Fedlex (`jolux:isRealizedBy`) puede tener varias Manifestations (`jolux:isEmbodiedBy`): xml, html, pdf-a, docx, doc, según la versión. La auditoría en vivo descubrió un hallazgo de seguridad crítico: `jolux:isExemplifiedByPrivate`/`jolux:wasExemplifiedByPrivate` apuntan a `intranet.fedlex.admin.ch`, un dominio interno visible únicamente porque el endpoint SPARQL público expone esas triplas (ver `docs/provider-contracts/fedlex.md`).

## Decisión

1. **`FedlexProvider.getManifestation()`** solo lee `jolux:isExemplifiedBy` (nunca `*Private`) y usa un orden de preferencia real `["xml", "html", "pdf", "docx", "doc"]`: prioriza la manifestación estructurada (Akoma Ntoso) cuando existe, cae a HTML/PDF cuando no.
2. **`FedlexSourceResolver`** (`packages/providers/fedlex/src/officialSourceResolver.ts`) usa una allowlist deliberadamente distinta a la de `entscheidsuche` (ADR 0008): en vez de aceptar cualquier subdominio de un dominio permitido por sufijo, bloquea explícitamente la etiqueta de subdominio `intranet` antes de aplicar el sufijo — porque `"intranet.fedlex.admin.ch".endsWith(".fedlex.admin.ch")` es `true`, y un `endsWith` ingenuo habría aceptado el dominio interno real encontrado en la auditoría. Este es un caso concreto y verificado, no una precaución teórica.
3. `FedlexSparqlClient.fetchManifestation()` rechaza cualquier URL que `FedlexSourceResolver.resolve()` no marque como candidata oficial, antes de hacer ninguna petición HTTP (protección SSRF en el punto de entrada, no solo documentación).

## Consecuencias

- Si Fedlex reorganiza su dominio de filestore público en el futuro, la allowlist (`FEDLEX_ALLOWED_OFFICIAL_DOMAINS`) deberá actualizarse explícitamente; el sistema falla cerrado (rechaza la descarga) en vez de aceptar un dominio nuevo no revisado.
- El orden de preferencia de formato asume que XML/Akoma Ntoso es siempre la mejor fuente cuando existe. Si una fase futura necesita el DOCX/DOC nativo (p. ej. para preservar formato de firma), tendrá que añadir un parámetro explícito de formato preferido a `getLaw`/`getArticle`.
