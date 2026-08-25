# Contrato técnico — Legislación cantonal, Schwyz (colección sistemática)

Verificado en vivo el 2026-07-25/26 (cierre de cobertura cantonal) contra `https://www.sz.ch`. Capturas en [`tests/fixtures/cantonal/sz/`](../../tests/fixtures/cantonal/sz/).

## Qué es

El Cantón de Schwyz no usa LexWork ni un sistema propio con API estructurada: publica su colección sistemática de leyes ("Systematische Gesetzsammlung", SRSZ) como una única página HTML real con enlaces directos a PDF por acto.

## Endpoint y estructura real

- Página real de la colección: `https://www.sz.ch/kanton/gesetze/systematische-gesetzsammlung.html/8756-8757-10021-11689` — una sola página, sin paginación de servidor.
- Estructura HTML real confirmada: una tabla con **425 filas reales verificadas**, cada una `<tr><td><a href="{pdfUrl}">{srszNumber}</a></td><td>{título}, vom {fecha}</td></tr>`.
- Los PDF están en un CDN de assets del propio dominio (`https://www.sz.ch/public/upload/assets/{id}/{srsz}.pdf?fp={n}`), enlaces directos, sin autenticación.
- **Sin buscador propio de la colección**: el buscador del sitio (`suchresultate.html?searchParams.collection=...&searchParams.query=...&searchParams.exactMatch=...`) es genérico (site-wide), no específico de legislación — no se usa como mecanismo de búsqueda real de esta colección.
- `robots.txt` real: solo restringe `/route/` y `/xml_1/` — la colección y los PDF son accesibles.
- Sin mecanismo de historial de versiones verificado: la tabla solo lista la versión vigente de cada acto.
- Charset HTTP real: `Content-Type: text/html; charset=UTF-8` (decodificación por defecto correcta, sin bug de codificación).

## Datos reales confirmados

- Número SRSZ (ej. "100.100" = Verfassung des Kantons Schwyz), título, fecha, URL directa del PDF.
- 3 PDF reales verificados manualmente durante la auditoría: todos son PDF **basados en texto** (no escaneados), confirmando que la extracción de texto es viable sin OCR para esta colección.

## Cobertura histórica

No verificada. La tabla solo expone la versión vigente actual de cada acto; no se encontró un mecanismo real de acceso a versiones anteriores.

## Licencia

No se confirmó texto de licencia explícito. Obra oficial de una autoridad cantonal suiza: se asume dominio público (Art. 5 LDA/URG), pendiente de confirmación.

## Mecanismo real de búsqueda

`CantonalSzProvider` descarga y parsea la tabla HTML completa (cacheada tras la primera petición) y **filtra en memoria** por `systematicNumber` (coincidencia exacta) o `query` (subcadena de título, case-insensitive). No existe un GET simple que reproduzca una búsqueda del lado servidor específica de esta colección.

## Extracción de documento

`getDocument()` descarga el PDF real vinculado y extrae texto vía `extractPdfText` (`packages/shared-web`). Un PDF sin capa de texto suficiente (`< 20 caracteres/página`) lanza `NonTextualDocumentError` explícitamente — **nunca se usa OCR**, conforme a la instrucción explícita del cierre de cobertura.

## Límites reales

- Sin `get_cantonal_article`: los PDF no tienen una estructura de artículo verificable dentro del tiempo de auditoría disponible.
- Sin historial de versiones.
- Sin búsqueda de texto libre real (solo filtrado en memoria sobre el catálogo).

## Nivel de confianza

Alto para el catálogo (425 filas reales verificadas, estructura estable) y para la extracción de PDF (3 ejemplos reales confirmados basados en texto). Bajo para cobertura histórica (no explorada, sin evidencia de que exista un mecanismo real).
