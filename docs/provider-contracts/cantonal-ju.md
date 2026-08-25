# Contrato técnico — Legislación cantonal, Jura (RSJU)

Verificado en vivo el 2026-07-26 (cierre de cobertura cantonal) contra `https://rsju.jura.ch`. Capturas en [`tests/fixtures/cantonal/ju/`](../../tests/fixtures/cantonal/ju/).

## Qué es

El Recueil systématique jurassien (RSJU) corre sobre un CMS ASP.NET WebForms propio ("icecube2.net" — banner real "POWERED BY ICECUBE2.NET" en el pie de página), con el módulo "CustomView". **Verificado explícitamente distinto** de la plataforma SIL compartida por GE/NE (vendor y esquema de URL distintos) — no se fuerza un adaptador compartido sin evidencia.

## Endpoint y estructura real

- Artefactos reales de ASP.NET WebForms confirmados en las páginas (`__VIEWSTATE`, `ctl00` de master page), pero cabeceras del servidor deliberadamente endurecidas/suprimidas.
- **Único mecanismo real de recuperación confirmado**: descarga directa de un documento ya identificado, vía GET simple (sin postback):
  ```
  GET {baseUrl}/fr/viewdocument.html?idn={categoría}&id={documento}&download=1
  ```
  Devuelve un PDF real basado en texto (verificado con `pdftotext` durante la auditoría). Ejemplo real: `idn=20002&id=36641` → Constitution du Jura.
- `viewdocument.html?idn=X` sin un `id` válido redirige a `/Default.aspx` (no expone un listado).
- Ruta real de navegación por categoría, encontrada **solo** a través del propio sitemap del sitio (`Scripts/Modules/Sitemap/Sitemap.aspx`), nunca adivinada: `/Scripts/Modules/CustomView/List.aspx?idn={id}&name=SubCategories` — pero esta ruta solo devuelve la barra de navegación lateral persistente, **no** un listado real de documentos por categoría.
- **Sin búsqueda GET reproducible confirmada**: 5 nombres de parámetro reales distintos fueron probados en vivo contra `scripts/modules/search/list.aspx` y los 5 devolvieron una respuesta byte-idéntica (6654 bytes, shell vacío) — evidencia de que ninguno de esos nombres es el parámetro real, sin inventar uno adicional.
- `robots.txt` real: abierto (sin restricción relevante a las rutas usadas).
- El adaptador **nunca realiza un postback ASP.NET** (`__VIEWSTATE`/`__EVENTVALIDATION`) ni gestiona cookies de sesión: el único camino real verificado es el GET directo de descarga.

## Datos reales confirmados

- Par `idn` (categoría) + `id` (documento), tal como aparecen en la URL real de descarga — identificador compuesto real, sin mecanismo de resolución desde un número sistemático legible.
- El **título real** del documento no se pudo verificar en vivo: no se encontró una página de listado que lo exponga junto al par idn/id, así que `CantonalJuProvider` expone un título genérico (`Document {idn}/{id}`) con una nota explícita en `rawMetadata.titleSource` documentando esta limitación — nunca se inventa un título.

## Cobertura histórica

No verificada. No se encontró un mecanismo real de acceso a versiones anteriores del mismo documento.

## Licencia

No se confirmó texto de licencia explícito. Obra oficial de una autoridad cantonal suiza: se asume dominio público (Art. 5 LDA/URG), pendiente de confirmación.

## Mecanismo real de búsqueda

**No implementado.** `search()` lanza `ProviderUnavailableError` explícito con el detalle de la evidencia (5 parámetros probados sin efecto) en vez de simular resultados o adivinar un sexto parámetro. `search_cantonal_legislation` para Jura devuelve el mismo error explícito a nivel de herramienta MCP.

## Extracción de documento

`getDocument()`/`fetchDocument()` requieren el par `idn`+`id` ya conocido (no hay forma de descubrirlo dentro de esta fase) y descargan el PDF real vía el GET de descarga, extrayendo texto con `extractPdfText`.

## Límites reales

- Sin búsqueda ni enumeración de categoría.
- Sin `get_cantonal_article`.
- Sin historial de versiones.
- Título del documento no verificado (genérico, con nota explícita).
- No se realiza ningún postback ASP.NET real ni se gestionan cookies (no aplicable: el único camino verificado no los requiere).

## Nivel de confianza

Alto para la descarga de un documento con idn/id ya conocido (PDF real confirmado, texto extraíble). Bajo para descubrimiento/enumeración de documentos (no resuelto dentro del tiempo de auditoría disponible, evidenciado explícitamente en vez de forzado).
