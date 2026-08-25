# ADR 0017 — Estrategia de extracción HTML/PDF (sin OCR, sin JS)

## Estado

Aceptado e implementado (Fase 4, 2026-07-27).

## Contexto

Ninguna de las tres fuentes de Fase 4 expone una API estructurada: SECO y ESTV (portal clásico) sirven HTML server-renderizado con enlaces a PDF; BSV sirve HTML (DNN/2sxc) con historial de versiones también enlazando a PDF. ESTV además opera un segundo sistema real (MWST-Infos, JSF/PrimeFaces en `gate.estv.admin.ch`) que requiere ejecución de JavaScript para mostrar contenido -- confirmado en vivo por el literal servidor-renderizado "JavaScript must be enabled to use this app" en la respuesta HTML cruda.

## Decisión

1. **Parsing HTML**: `packages/shared-web/src/htmlParser.ts` envuelve `cheerio` (parser conforme al estándar HTML5, no regex sobre el documento completo). Elimina `<script>`/`<style>` antes de exponer el árbol -- el único saneamiento necesario porque este proyecto solo EXTRAE texto/atributos, nunca re-renderiza ni ejecuta HTML de terceros.
2. **Extracción de PDF**: `packages/shared-web/src/pdfTextExtractor.ts` envuelve `pdf-parse` (basado en pdf.js). Se aplica una heurística de caracteres-por-página (`MIN_CHARS_PER_PAGE = 20`, verificada contra los tres PDF reales de la auditoría: 111, 136 y 5 páginas, todos muy por encima del umbral) para distinguir un PDF textual real de uno escaneado sin capa de texto; si no la supera, se lanza `NonTextualDocumentError` en vez de intentar OCR silenciosamente.
3. **Sin OCR en Fase 4**: ninguno de los PDF reales encontrados en la auditoría era un documento escaneado, así que no hubo necesidad real de implementarlo. Se documenta como capacidad NO implementada (no como "false" arbitrario): si un futuro documento escaneado sin alternativa textual lo requiere, `NonTextualDocumentError` es el punto de extensión explícito.
4. **Sin Playwright/automatización de navegador**: el sistema JSF de MWST-Infos de ESTV (`gate.estv.admin.ch`) se documenta (`docs/provider-contracts/estv.md`) pero NO se implementa, porque existe una alternativa real y completamente funcional dentro de la misma agencia (el portal clásico `www.estv.admin.ch/de/kreisschreiben-*`) -- consistente con la instrucción de usar Playwright "solo si es estrictamente necesario". No se intenta eludir ninguna protección: el sistema JSF simplemente no es alcanzable por HTTP simple, y la decisión es no implementarlo, no evadir su mecanismo de renderizado.

## Consecuencias

- `EstvProvider` cubre las circulares del portal clásico (Direkte Bundessteuer, Stempelabgaben, Verrechnungssteuer) pero NO las "MWST-Infos" de IVA -- limitación conocida y documentada, no un vacío silencioso.
- Cualquier PDF futuro que falle el umbral de texto se rechaza explícitamente (`NonTextualDocumentError`) en vez de devolver un documento con `fullText` vacío o inventado.
- Si en el futuro se decide implementar el portal JSF de ESTV, requerirá Playwright y una revisión de seguridad específica (interacción con `ViewState` de PrimeFaces) -- se deja como propuesta de fase futura, no como trabajo pendiente de Fase 4.
