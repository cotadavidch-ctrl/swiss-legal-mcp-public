# Contrato técnico — Legislación cantonal, plataforma SIL (Genève y Neuchâtel)

Verificado en vivo el 2026-07-26/27 (cierre de cobertura cantonal) contra `https://silgeneve.ch` (GE) y `https://rsn.ne.ch` (NE). Capturas en [`tests/fixtures/cantonal/sil-ge/`](../../tests/fixtures/cantonal/sil-ge/) y [`tests/fixtures/cantonal/sil-ne/`](../../tests/fixtures/cantonal/sil-ne/).

## Qué es

"SIL" es una plataforma comercial de publicación legislativa del vendor ARCHILEXMP sa, confirmada en vivo como **compartida, byte-a-byte en su estructura**, entre Ginebra (recueil systématique genevois, rs/GE) y Neuchâtel (recueil systématique neuchâtelois, RSN) — descubrimiento no anticipado, hecho solo mediante auditoría en vivo (el script `LVMP.js` y la estructura de catálogo son idénticos entre ambos cantones). Esto permitió un único `CantonalSilProvider` parametrizado en vez de dos implementaciones separadas.

## Endpoint y estructura real

- Catálogo real (idéntico en forma entre ambos cantones): `{baseUrl}/{bookPath}/content.htm`
  - GE: `https://silgeneve.ch/legis/program/books/RSG/content.htm`
  - NE: `https://rsn.ne.ch/DATA/program/books/rsne/content.htm`
- Estructura HTML real: árbol de categorías `<h1>`/`<h2>`/`<h3>`/`<h4>`, con los actos individuales como `<a href="htm/{docKey}.htm">{número real} {título real}</a>` dentro de un `<h3>`/`<h4>`.
- Documento individual: `{baseUrl}/{bookPath}/htm/{docKey}.htm` — HTML real, exportado desde Microsoft Word (marcado de estilos inline típico de exportación Word-a-HTML).
- **Sin búsqueda GET reproducible**: la UI de búsqueda real de ambos sitios dispara `searchEngine.min.js`/`searchEngineData.min.js` (motor de búsqueda real, pero no accesible vía un GET simple sin invertir el protocolo del motor, fuera de alcance de esta fase).
- `robots.txt`:
  - GE: respuesta real de 0 bytes — sin restricciones.
  - NE: `Disallow: /` salvo `Allow: /DATA/` (donde vive el contenido real) — cumplido: solo se accede a rutas bajo `/DATA/`.

## Bug de codificación real y su corrección

Ambos sitios sirven `Content-Type: text/html` **sin `charset=`** en la cabecera HTTP real (confirmado con inspección directa de cabeceras), pero declaran `<meta charset=windows-1252>` dentro del propio HTML. Decodificar con `TextDecoder()` por defecto (UTF-8) corrompe cada carácter acentuado francés (`République` → `Rï¿½publique`). `decodeSilHtml()` sniffea los primeros 512 bytes en windows-1252 (seguro para leer la declaración ASCII del `<meta>`), extrae el charset real declarado, y re-decodifica el documento completo con ese charset — verificado con contenido real ("République de Genève à la Confédération", "Neuchâtel") en `cantonalSilProvider.test.ts`.

## Datos reales confirmados

- Número real de acto (ej. "A 1 01" en GE, "101" en NE) + título, extraídos del texto del enlace `<h3>`/`<h4>`.
- `docKey` (identificador interno real, ej. `rsg_a1_01`) — **distinto** del número sistemático legible; es el identificador que debe usarse para `get_cantonal_law` (`rawMetadata.docKey`).
- Idioma real: francés en ambos cantones.

## Cobertura histórica

No verificada. Cada catálogo (`bookPath`) expone solo el libro de ley vigente; ambos cantones publican libros adicionales reales (modificaciones futuras, concordatos, legislación comunal) — confirmados como existentes durante la auditoría, pero no cubiertos por el adaptador en esta fase.

## Licencia

No se confirmó texto de licencia explícito. Obra oficial de una autoridad cantonal suiza: se asume dominio público (Art. 5 LDA/URG), pendiente de confirmación.

## Mecanismo real de búsqueda

`CantonalSilProvider.searchDocuments()` descarga y parsea el catálogo completo (cacheado) y filtra en memoria: por `systematicNumber` (coincidencia de prefijo exacto contra el número real al inicio del texto del enlace) o `query` (subcadena de título, case-insensitive).

## Extracción de documento

`getDocument()` descarga el HTML real del documento (vía `decodeSilHtml`) y extrae texto sanitizado con `extractSanitizedText`.

## Límites reales

- Sin `get_cantonal_article`: el HTML exportado desde Word no tiene una estructura de artículo verificada de forma fiable dentro del tiempo de auditoría disponible.
- Sin libros adicionales (solo el libro de ley vigente por canton).
- Sin búsqueda de texto libre real.

## Nivel de confianza

Alto para el catálogo y la extracción de documento (estructura idéntica confirmada entre GE y NE, charset corregido y verificado con contenido real). Bajo para cobertura histórica y libros adicionales (confirmados como existentes, no explorados a fondo).
