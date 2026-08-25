# Contrato técnico — Legislación cantonal, Zúrich (ZH-Lex)

Verificado en vivo el 2026-07-27 contra `https://www.zh.ch` (Fase 5A: resolución de una ley conocida; Fase 5B: mecanismo real de búsqueda). Capturas en [`tests/fixtures/cantonal/zh-lex/`](../../tests/fixtures/cantonal/zh-lex/).

## Qué es

ZH-Lex es el sistema propio (no LexWork) del Cantón de Zúrich para su Loseblattsammlung (LS, recopilación vigente por materia, 14 carpetas) y su Offizielle Gesetzessammlung (OS, recopilación cronológica oficial).

## Endpoint y estructura real

- Página de búsqueda real: `https://www.zh.ch/de/politik-staat/gesetze-beschluesse/gesetzessammlung.html`, con formulario de búsqueda (Stichwort/keyword, Erlasstitel/título, Ordnungsnummer/número sistemático, Ordner/carpeta, rangos de fecha de Erlass/Inkraftsetzung/Publikation, opción "auch aufgehobene Erlasse" para incluir derogados).
- **Esquema de URL real, con versionado explícito codificado directamente en la URL** (confirmado por búsqueda externa y descarga directa):
  - LS (vigente/consolidado): `/de/politik-staat/gesetze-beschluesse/gesetzessammlung/zhlex-ls/erlass-{numeroSistematico_con_guion_bajo}-{fechaVigenciaDesde}-{fechaVigenciaHasta}-{idInterno}.html`, ej. `zhlex-ls/erlass-131_1-2015_04_20-2018_01_01-105.html`.
  - OS (cronológico/enmiendas): `/de/politik-staat/gesetze-beschluesse/gesetzessammlung/zhlex-os/erlass-{numeroSistematico}-{numeroSecuencial}-{idInterno}.html`, ej. `zhlex-os/erlass-131_1-65-180.html`.
- Sin API JSON pública confirmada: HTML server-renderizado real, sin SPA.
- `robots.txt` real: sin restricciones (`Disallow` vacío), solo declara `Sitemap`.
- Historial real desde 1999 vía el formulario de búsqueda; historial completo desde 1803 vía una herramienta separada del Archivo Estatal ("Online-Suche des Staatsarchivs"), no explorada en esta auditoría.
- Registro (`Sachregister`) descargable como PDF anual (ej. "Register zur Zürcher Gesetzessammlung 2025", 249 páginas).

## Datos reales confirmados

- "Ordnungsnummer" (número sistemático cantonal, ej. "131.1" = Gemeindegesetz) — análogo al RS/SR federal.
- Fechas de vigencia (`Inkraftsetzung`) codificadas literalmente en la URL de cada versión LS — versionado real explícito y verificable sin necesidad de consultar una API.
- Título del acto, organismo responsable (Staatskanzlei – Rechtsdienst).

## Cobertura histórica

Real y profunda: historial de una misma "Ordnungsnummer" (ej. "131.1") verificado con múltiples versiones reales desde 1926 hasta la actualidad (ver ejemplos reales en la auditoría: `1926_06_06`, `2015_04_20`, etc.), cada una con su propia URL versionada.

## Licencia

No se confirmó texto de licencia explícito. Obra oficial de una autoridad cantonal suiza: se asume dominio público (Art. 5 LDA/URG), pendiente de confirmación.

## Mecanismo real de búsqueda (Fase 5B)

Interactuando con el formulario real (campos "Stichwort"/"Erlasstitel"/"Ordnungsnummer") y capturando la petición de red generada al pulsar "Suchen", se descubrió el servlet JSON real:

```
GET /de/politik-staat/gesetze-beschluesse/gesetzessammlung/_jcr_content/main/lawcollectionsearch_312548694.zhweb-zhlex-ls.zhweb-cache.json?referenceNumber={numeroSistematico}&enactmentTitle={subcadenaDeTitulo}&page={pagina}
```

Respuesta real: `{data: [{link, referenceNumber, enactmentTitle, enactmentDate, withdrawalDate}], numberOfResults, numberOfResultPages, moreSearchResultsThanAllowed}`. Parámetros probados y su resultado real:

- `referenceNumber`: coincidencia **exacta** confirmada (ej. "131.1" → 1 resultado real).
- `enactmentTitle`: coincidencia de **subcadena** confirmada (ej. "Gemeindegesetz" → 1 resultado real).
- `keyword`, `query`, `searchText`, `text`, `q`: probados explícitamente y **descartados** — el servidor real los ignora y devuelve la lista completa sin filtrar (150 resultados), demostrando que NO son parámetros reales.

Existe una variante `.zhweb-zhlex-os.` (histórico cronológico, Offizielle Gesetzessammlung) con forma de respuesta similar (`entryIntoForceDate` en vez de `withdrawalDate`) — **no se usa** en el adaptador, que cubre solo la Loseblattsammlung (ley vigente).

`CantonalZhProvider.searchDocuments()` implementa esto real y probado (offline con fixture real + integración real en `liveIntegration.test.ts`). No implementa extracción de artículo individual (la estructura HTML interna de un artículo no se exploró a fondo).

## Nivel de confianza

Alto para el esquema de URL/versionado (confirmado con múltiples ejemplos reales) y para el mecanismo de búsqueda (parámetros reales confirmados, alternativas descartadas explícitamente por evidencia, no por suposición). Bajo para extracción de artículo individual (no implementado, no explorado).
