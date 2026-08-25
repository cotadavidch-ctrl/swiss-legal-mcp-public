# Contrato técnico — Legislación cantonal, familia LexWork (19 cantones)

Verificado en vivo: Berna el 2026-07-27 (Fase 5A); Luzern, Uri, Obwalden, Nidwalden, Glarus, Zug, Schaffhausen, Appenzell A.Rh., Appenzell I.Rh., St. Gallen, Graubünden, Aargau, Thurgau, Solothurn, Basel-Stadt, Basel-Landschaft, Fribourg, Valais el 2026-07-27 (Fase 5B). Capturas en [`tests/fixtures/cantonal/be-lexwork/`](../../tests/fixtures/cantonal/be-lexwork/); descriptor completo de los 19 en `packages/providers/cantonal/src/lexWorkCantons.ts`.

## Qué es

LexWork es una plataforma comercial (proveedor Sitrox) usada por 19 de los 26 cantones suizos para publicar su legislación sistemática (recopilación vigente). Cada canton corre su propia instancia sobre su propio dominio (o un dominio compartido del vendor, ver más abajo), pero el **contrato de API es idéntico letra por letra** en los 19 verificados: mismos parámetros, misma forma de respuesta, mismo patrón de `robots.txt`.

## Endpoints reales confirmados

- `GET /api/{lang}/systematic_categories?show_abrogated=false` — árbol jerárquico de categorías. Confirmado con JSON real idéntico en forma en los 19 cantones.
- `GET /api/{lang}/texts_of_law/lightweight_index?show_abrogated=false` — índice completo de leyes: `{id, systematic_number, systematic_category_id, title, abrogated, structured_document_id}` agrupado por `systematic_category_id`. **`structured_document_id` puede ser `null`** (leyes catalogadas sin documento digitalizado — observado en vivo en Luzern y otros; el esquema Zod se corrigió a `.nullable()` tras esta evidencia, no por suposición).
- `GET /api/{lang}/texts_of_law/{numeroSistematico}/show_as_json` — **detalle real de una ley concreta**, descubierto por inspección de red en Fase 5B (no documentado en ningún sitio, hallado navegando la SPA real y observando las peticiones XHR). Devuelve:
  - `text_of_law.current_version`/`selected_version`/`old_versions`/`future_versions`: metadatos reales de versión (`id`, `structured_document_id`, `version_dates_str`, `title`).
  - `selected_version.json_content.document.content`: **árbol recursivo real** (título → artículo → párrafo), cada nodo con `uid` (puede ser `null` en nodos internos sin identidad propia), `type` (`"title"`/`"article"`/`"paragraph"`), `number` (por idioma, ej. `{de: "Art.&nbsp;1", fr: "Art.&nbsp;1"}`), `html_content`/`text` (por idioma). Confirma que la granularidad de artículo es real, verificada con datos reales, no una suposición.
  - Solo la **versión vigente** (`selected_version`) trae el árbol de contenido completo; `old_versions`/`future_versions` solo traen metadatos de resumen — no se encontró un endpoint real para su texto completo dentro del tiempo disponible.
- `GET /api/trox_work/v1/maintenance_message` — confirma "trox_work" como nombre interno del producto.
- **`robots.txt` real, idéntico en los 19 cantones**: permite explícitamente el catálogo/detalle anteriores. Solo prohíbe los endpoints de búsqueda de texto libre: `/api/*fulltext_search*`, `/api/*direct_searches*`, y las rutas de UI `/app/*quick_search/*`, `/app/*systematic/search/*`, `/app/*chronology/search/*`, `/app/*systematic/index_search/*` (en las 5 variantes de idioma de la UI). El adaptador **nunca llama a estos endpoints prohibidos**: la búsqueda de catálogo filtra en memoria sobre el índice ya obtenido de un endpoint permitido.

## Datos reales confirmados (no inventados)

Índice: `id`, `systematic_number` (ej. "324.111"), `systematic_category_id`, `title`, `abrogated` (booleano real), `structured_document_id` (nullable). Detalle: árbol de contenido real con texto normativo verbatim en `html_content`/`text` por idioma, extraído y sanitizado en `getDocument()`/`getArticle()` (`lexWorkContentTree.ts`).

## Cobertura histórica

`abrogated: true/false` disponible directamente. `old_versions`/`future_versions` reales (Berna: 5 versiones antiguas confirmadas para la ley 324.111) — solo como resumen (id/fecha/título), sin texto completo verificado.

## Multilingüe

Confirmado real: cantones de habla alemana usan `/api/de/...`; Fribourg y Valais (francófonos/bilingües) usan `/api/fr/...`, verificado en vivo con JSON real y ejemplos concretos (Fribourg: "Constitution du canton de Fribourg", numéro systématique "10.1"). Graubünden es trilingüe (de/rm/it) pero solo `de` se verificó a fondo.

## Licencia

No se confirmó texto de licencia explícito. Documento de una autoridad cantonal suiza: se asume obra oficial de dominio público (Art. 5 LDA/URG), consistente con el resto de fuentes auditadas.

## Nuances de dominio (no todos son dominios gubernamentales propios)

- **AR, AI, BL**: la instancia LexWork vive en `clex.ch` (dominio de infraestructura del vendor), no en un subdominio gubernamental propio (`*.ar.ch`/`*.ai.ch`/`*.bl.ch`). Las páginas gubernamentales que enlazarían ahí devolvieron HTTP 403 durante la auditoría — el enlace saliente exacto no se confirmó visualmente, solo el sistema real al que apuntan (mismo esquema de API verificado).
- **FR**: la auditoría inicial confirmó `fr.lexwork.naz.ch` (dominio del vendor) funcional; una verificación posterior durante la implementación encontró ese mismo dominio devolviendo HTTP 404. Se usa `bdlf.fr.ch` (dominio oficial de gobierno), que respondió JSON real y consistente en ambas verificaciones — es además la fuente más apropiada al ser el dominio gubernamental.
- **GR**: dos dominios equivalentes observados (`www.gr-lex.gr.ch` oficial, `gr.lexwork.naz.ch` del vendor); se usa el primero.

## Reutilización

`CantonalLexWorkProvider` (`packages/providers/cantonal`) es una única clase parametrizada por `{cantonCode, baseUrl, domains, language}`; los 19 descriptores reales viven en `LEXWORK_CANTONS` (`lexWorkCantons.ts`). Un canton nuevo solo se añade tras verificarlo en vivo — nunca por analogía. `apps/mcp-server/src/registry.ts` instancia un proveedor por descriptor en un bucle, sin duplicar código.

## Nivel de confianza

Alto para catálogo, texto completo de la versión vigente y artículos individuales (los 19 cantones verificados en vivo con `healthCheck()` real; Berna además con `getDocument()`/`getArticle()` de contenido real verificado end-to-end). Bajo para texto completo de versiones antiguas/futuras (no verificado). Alto para el patrón de `robots.txt` (idéntico letra por letra en los 19).
