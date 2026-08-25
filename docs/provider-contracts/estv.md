# Contrato técnico — ESTV/AFC (www.estv.admin.ch)

Verificado en vivo el 2026-07-26/27. Capturas en [`tests/fixtures/estv/`](../../tests/fixtures/estv/) con su README.

## Endpoint y estructura real

ESTV opera al menos **tres sistemas reales distintos** — hallazgo clave de esta auditoría:

1. `www.estv.admin.ch` — sitio institucional Nuxt (misma familia de plataforma que `arbeit.swiss` de SECO, plantilla de tarjeta distinta), con páginas reales `de/kreisschreiben-direkten-bundessteuer`, `de/kreisschreiben-stempelabgaben`, `de/kreisschreiben-verrechnungssteuer`. **Fuente implementada por `EstvProvider` en Fase 4.**
2. `www.gate.estv.admin.ch/mwst-webpublikationen/public` — aplicación Java/JSF (PrimeFaces v5.2.24, framework "ObliqueUI" v1.3.3) para las "MWST-Infos" (IVA), con tabla de contenidos, búsqueda e índice alfabético reales. **NO implementada en Fase 4** (ver limitaciones abajo).
3. `www.estv2.admin.ch` — dominio adicional observado sirviendo al menos un PDF de ayuda (`mwst-handbuch-webpubli-de.pdf`); no explorado en profundidad.

- `robots.txt` real de `www.estv.admin.ch` permite crawling completo y declara `Sitemap: https://www.estv.admin.ch/sitemap.xml`.

## Estructura HTML real (fuente implementada: www.estv.admin.ch)

```html
<li>
  <a
    class="download-item"
    aria-label="Download Kreisschreiben Nr. 50a: Unzulässigkeit des steuerlichen Abzugs von Bestechungsgeldern"
    href="https://www.estv.admin.ch/dam/de/sd-web/{hash}/dbst-ks-2020-1-050a-d-de.pdf"
    download="dbst-ks-2020-1-050a-d-de.pdf"
  >
  </a>
</li>
```

- El `aria-label` entrega **número de circular + título completo en un atributo limpio**, sin necesidad de parsear un título libre como en SECO — es la mejor superficie de extracción de las tres fuentes auditadas en Fase 4.
- El nombre de archivo (`dbst-ks-2020-1-050a-d-de.pdf`) codifica adicionalmente tema/tipo/año/número/idioma, mantenido en `rawMetadata` pero no usado como fuente primaria.
- **Tres formatos de referencia distintos y no reconciliados para el mismo documento real** (Kreisschreiben Nr. 50a): `dbst-ks-2020-1-050a-d-de` (nombre de archivo), "Kreisschreiben Nr. 50a" (`aria-label`), "1-050a-D-2023-d" (pie de página del PDF). `EstvProvider` usa el número del `aria-label` ("Nr. 50a") como `referenceNumber` canónico, por ser el más legible y consistente en la página de listado; los otros dos se preservan en `rawMetadata`.

## Formatos y contenido

- **Solo PDF**, verificado real y textual: `kreisschreiben_50a_bestechungsgelder_de.pdf`, 5 páginas, ~172KB.
- Portada con fecha de emisión ("Bern, 05. Dezember 2023") pero **sin "gültig ab" en portada** — a diferencia de SECO/BSV. La fecha de entrada en vigor está dentro del cuerpo del documento (sección "4 Inkrafttreten"), no extraíble de forma fiable sin parsing de layout; `effectiveDate` queda ausente cuando no aparece en una superficie estructurada.
- Cabeceras de descarga reales: `Content-Type: application/pdf`, cookie de sesión `TS5fba...` (cookie de balanceador/WAF F5, no de autenticación) — descartada entre peticiones por el cliente compartido.

## Cobertura histórica

**Real y profunda** en `www.estv.admin.ch`: la página de Kreisschreiben de Direkte Bundessteuer lista circulares desde 1995 ("w95", "w97", "w03") hasta la actualidad en una sola página — más histórico visible directamente que SECO, aunque sin mecanismo de "cadena de versión" explícito (cada año es una entrada PDF separada, no una relación de versión estructurada como en BSV). `ProviderCapabilities.getHistoricalVersion: false` para ESTV (no hay endpoint de versión, solo acumulación de entradas independientes).

## Relaciones legales cruzadas

Confirmado un enlace directo real desde la interfaz JSF de MWST-Infos a `https://www.fedlex.admin.ch/eli/cc/2009/615/de...` (ELI real de la Ley del IVA, MWSTG) — confirma que `relatedLegalProvisions` es un concepto real y verificable en ESTV, aunque no estructurado como enlace por artículo, y no accesible en la fuente implementada (clásica) sin JS.

## Limitaciones explícitas (JSF gate, no implementado)

Se verificó en vivo que `gate.estv.admin.ch/mwst-webpublikationen` requiere ejecución de JavaScript para renderizar el texto real de cada capítulo (confirmado por el literal servidor-renderizado "JavaScript must be enabled to use this app" y paneles de contenido vacíos en peticiones GET directas). Implementarlo exigiría automatización de navegador (Playwright) para interactuar con un árbol de navegación PrimeFaces con `ViewState`. Se documenta su existencia, estructura de URL (`pages/taxInfos/tableOfContent.xhtml?publicationId=N`) y capacidades observadas (búsqueda, índice alfabético, archivo, avisos de borradores en consulta), pero **no se consulta en esta fase** — decisión consistente con la instrucción de usar Playwright solo si es estrictamente necesario, dado que existe una alternativa real y completamente implementable (el portal clásico) dentro de la misma agencia.

## Errores y límites observados

- No se probó estrés deliberado (429/502/503/504 no observados).
- Sin rate limit explícito observado en cabeceras.

## Licencia

No se confirmó texto de licencia explícito. Obra oficial de una autoridad federal suiza: dominio público (Art. 5 LDA/URG), consistente con el resto de fuentes auditadas.

## Nivel de confianza

Alto para la mecánica de listado/descarga del portal clásico (Kreisschreiben de Direkte Bundessteuer, verificado con peticiones HTTP reales). Medio para la generalización a las otras dos secciones del mismo portal (Stempelabgaben, Verrechnungssteuer) — su estructura de página se asume idéntica por ser la misma plantilla pero no se verificó cada una en profundidad. Bajo/no aplicable para el sistema JSF de MWST-Infos, documentado pero no implementado.
