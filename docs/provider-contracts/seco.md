# Contrato técnico — SECO (arbeit.swiss)

Verificado en vivo el 2026-07-26 contra `https://www.arbeit.swiss` (Nuxt SSR, sin autenticación). Todas las capturas están en [`tests/fixtures/seco/`](../../tests/fixtures/seco/) con su README.

## Endpoint y estructura real

- Página principal de publicaciones: `https://www.arbeit.swiss/de/informationszentrum/publikationen` (alemán). **El slug es distinto por idioma**, no un simple prefijo: francés es `https://www.arbeit.swiss/fr/centre-dinformation/publications-fr` (verificado en vivo vía redirect 301 real desde la URL antigua). Italiano no se verificó explícitamente en esta fase.
- `robots.txt` (`https://www.arbeit.swiss/robots.txt`) permite crawling completo y declara `Sitemap: https://www.arbeit.swiss/sitemap_index.xml`.
- Sin API JSON documentada. Existe un endpoint interno de Nuxt (`<página>/_payload.json`, verificado con HTTP 200 y ~484KB) que replica el mismo contenido en el formato de estado serializado propio de Nuxt — **no se usa como fuente**: es un mecanismo interno no documentado, propenso a cambiar entre versiones de Nuxt.

## Estructura HTML real (confirmada, no inventada)

Cada publicación es un elemento:

```html
<a
  class="u-base-download-item"
  href="/api/media/fileservice/sdweb-docs-prod-arbeitswiss-files/files/{YYYY}/{MM}/{DD}/{uuid}.pdf"
  target="_blank"
>
  <h5 class="u-base-download-item__title">
    {título completo, incluye código de práctica y "gültig ab"}
  </h5>
  <div class="u-base-download-item__meta-info">
    <span class="u-base-download-item__type">PDF</span>
    <span>|</span>
    <span class="u-base-download-item__created">{fecha DD.MM.YYYY}</span>
  </div>
</a>
```

- **Dos dominios de descarga reales observados**: `www.arbeit.swiss/api/media/fileservice/...` (alemán) y `backend.arbeit.swiss/fileservice/...` (francés) — ambos deben estar en la allowlist SSRF.
- **`referenceNumber` y `effectiveDate` no son campos separados**: solo existen como subcadenas dentro de `<h5>`, p.ej. `"Weisung AVIG KAE (Kurzarbeitsentschädigung) (AVIG-Praxis KAE) gültig ab 1.7.2026"`. Se extraen con una expresión regular tolerante (`/\(([\wÄÖÜäöü.-]+-Praxis\s+[\wÄÖÜäöü]+)\)/` para el código, `/gültig ab (\d{1,2}\.\d{1,2}\.\d{4})/` o equivalente en francés `/valable dès (...)/`); si no coinciden, el campo queda ausente — nunca se inventa.
- **El código de práctica NO es estable entre idiomas**: alemán "AVIG-Praxis KAE" vs. francés "Bulletin LACI RHT" para el mismo concepto real (Kurzarbeitsentschädigung / Réduction de l'Horaire de Travail). Cada idioma se modela como documento independiente.
- La fecha del `<span class="...__created">` es la fecha de publicación/actualización del archivo, no necesariamente la fecha de vigencia legal (que va en el título como "gültig ab"/"valable dès").

## Formatos y contenido

- **Solo PDF.** Verificado real y textual (no escaneado): documento de 111 páginas descargado y leído íntegramente (`Weisung AVIG KAE`), con portada `Stand: DD.MM.YYYY`, base legal citada explícitamente (`Art. 110 AVIG`), y una convención de cita propia (`Zitierung: Weisung AVIG KAE A1`).
- Sin XML/HTML estructurado ni Akoma Ntoso — extracción de artículo/capítulo individual (más allá del documento completo) no es viable sin OCR/parsing de layout, fuera de alcance de esta fase.

## Cobertura histórica

**Sin archivo visible para las Weisungen "núcleo"** (KAE, SWE, RVEI, ALE, AMM, IE, öAV, ALE 883): la página de publicaciones solo lista la versión **vigente** de cada una (verificado: una sola entrada por código de práctica). Las "Themenspezifische Fachweisungen" (numeradas por año, p.ej. `Weisung 2024/02`) sí se acumulan en la lista y no se sustituyen — comportamiento real distinto para esta subcategoría.

## Errores y límites observados

- No se probó estrés deliberado contra el servicio (429/502/503/504 no observados en la práctica).
- Tamaño de PDF observado hasta ~1.2MB; sin límite documentado por el servidor.
- Sin rate limit explícito en cabeceras.

## Licencia

No se confirmó texto de licencia explícito. Documentos de una autoridad federal suiza: obra oficial de dominio público (Art. 5 LDA/URG), consistente con el resto de fuentes federales auditadas.

## Nivel de confianza

Alto para la mecánica de descarga/listado (verificada con peticiones HTTP reales, sin inferencia). Medio para la generalización a francés/italiano de las demás categorías de la página (solo se verificó la sección de Weisungen en alemán y francés explícitamente).
