# Auditoría de fuentes jurídicas suizas — Fase 0

Fecha de la auditoría: 2026-07-25.
Método: verificación directa de páginas y documentación oficial (WebFetch/WebSearch) más investigación delegada en agentes de investigación, con verificación cruzada manual de los hallazgos más relevantes para la arquitectura.

Convención de confianza usada en todo el documento:

- **Verificado** — confirmado por acceso directo a la fuente o su documentación técnica.
- **Parcial** — confirmado en parte; algún detalle (licencia exacta, rate limits, formato secundario) no pudo confirmarse.
- **No verificado** — mencionado en fuentes secundarias pero sin confirmación directa. No debe tratarse como hecho hasta verificarlo en Fase 2+.
- **Pendiente** — no investigado en esta fase.

No se ha escrito ningún scraper ni cliente todavía. Este documento es la base para decidir, en cada fase posterior, qué proveedor es viable y con qué método de acceso.

---

## 1. Jurisprudencia federal (Tribunal Federal — BGE/ATF/DTF)

**Fuente oficial:** https://www.bger.ch

- Acceso: interfaz web de búsqueda (HTML) y descarga de PDF individuales. **No hay API pública documentada.** — Verificado.
- Identificadores: colección oficial **ATF** (alemán: BGE, italiano: DTF), formato `ATF [volumen] [sala] [página]` (ej. ATF 133 II 292); además número de expediente interno (ej. `6B_1234/2025`). — Verificado.
- ECLI (European Case Law Identifier): no se ha confirmado que los tribunales suizos asignen ECLI de forma sistemática. El campo `ecli` del modelo de datos permanecerá opcional y normalmente vacío. No debe inferirse su inexistencia exclusivamente de la no pertenencia de Suiza a la UE/EEE — Parcial, a reverificar en Fase 2 contra bger.ch y entscheidsuche.ch. **Reverificado en Fase 6** (revisión de capacidades previa a `packages/citations`): confirmado que ningún proveedor integrado (ni `entscheidsuche.ch`, ni ningún proveedor cantonal) puebla nunca el campo `ecli` en la práctica — el parser de citas reconoce el formato real (ISO 6923) pero el resolver nunca intenta verificarlo contra ninguna fuente, ver `docs/provider-contracts/citation-resolution.md`.
- Idiomas: alemán, francés, italiano. — Verificado.
- Cobertura: colección oficial (ATF) publicada desde 1954 en papel; sentencias no publicadas ("todas las sentencias") disponibles en línea desde ~2000.
- Licencia: obra oficial, dominio público bajo el derecho suizo (no hay copyright sobre actos oficiales). Sin términos de reutilización de datos explícitos porque no hay API que los acompañe.
- Limitación clave: sin API, sin descarga masiva verificada. Cualquier acceso automatizado tendría que respetar robots.txt y ser de descarga puntual, no scraping masivo.

### 1.1 Jurisprudencia federal — Tribunal Penal Federal / BStGer

**Fuente oficial:** https://www.bstger.ch enlaza su "Entscheiddatenbank BStGer" a
https://bstger.weblaw.ch.

- Acceso: aplicacion Weblaw oficial con API JSON usada por el frontend. Busqueda por POST a
  `https://bstger.weblaw.ch/api/getDocuments?withAggregations=true`; descarga por POST a
  `https://bstger.weblaw.ch/api/getDocumentFile/{leid}?locale={language}&userID=`. — Verificado en
  vivo el 2026-08-04.
- Formato de descarga: PDF (`application/pdf`) con `content-disposition: inline`.
- Identificadores: numeros de expediente como `SK.2023.1` y `RR.2024.1`; el endpoint devuelve
  `leid`, titulo, nombre de fichero, sala/tribunal, idioma y fecha de decision.
- Ejemplos oficiales verificados:
  - `SK.2023.1`, `leid` `01e7b851-1e32-3ea9-93ca-042e0b20230d`, SHA-256
    `e978933f018a1a27dbe8b2edad4ec6f4b6f2ba221428b1c6895230297dcb67fb`.
  - `RR.2024.1`, `leid` `5ea9d05c-758f-3df0-9fbe-492f7628af3b`, SHA-256
    `84d5328644356198d018c02f6f79fa2abac836a4759eca6bf3dd37aa33647811`.
- Implicacion arquitectonica: el adaptador `FederalCriminalCourtAdapter` debe seleccionar un unico
  resultado exacto antes de descargar el PDF; los resultados duplicados exactos quedan como
  ambiguos. No se debe tratar `entscheidsuche.ch` como fuente oficial para BStGer.

## 2. Agregador de jurisprudencia federal + cantonal — entscheidsuche.ch

**Hallazgo central de esta fase.** No es una entidad estatal, sino una asociación sin ánimo de lucro (Verein) fundada en 2017, con exención fiscal reconocida por el cantón de Berna desde 2020. Debe documentarse siempre como **fuente no oficial / agregador**, aunque los documentos que sirve son en sí mismos obras oficiales de los tribunales.

Definición operativa vinculante para el diseño (no cambiar sin ADR):

- Es un **agregador jurisprudencial no oficial**.
- Actúa como **proveedor primario de descubrimiento y recuperación** (búsqueda y obtención del documento), no como fuente jurídica de referencia.
- **Nunca sustituye a la fuente oficial cuando existe una URL del tribunal correspondiente**: el documento normalizado debe conservar/enlazar la URL del tribunal de origen siempre que se pueda resolver, y presentar la de entscheidsuche.ch como acceso, no como origen.
- Su cobertura **no debe describirse como garantizada ni exhaustiva** de los 26 cantones: es el resultado de scrapers que pueden romperse o quedar desactualizados, más aportes voluntarios desde 2021; cualquier respuesta que dependa de "ausencia de resultados" en esta fuente debe advertir que eso no equivale a "no existe tal sentencia".

- **Existe un servidor MCP público ya operativo**, verificado de forma independiente vía WebFetch al repositorio GitHub `entscheidsuche/entscheidsuche-mcp`:
  - Endpoint: `https://mcp.entscheidsuche.ch/mcp` (Streamable HTTP, **sin autenticación**).
  - Herramientas expuestas: `search` (texto completo, sintaxis Lucene, filtros por fecha de decisión, fecha de scraping, jerarquía cantón/tribunal/sala, idioma), `search_by_case_number` (búsqueda de **frase exacta** del número de expediente o cita BGE — **no es un lookup único**: verificado en Fase 2 que "BGE 142 III 1" devuelve 172 resultados reales, cualquier sentencia que cite esa referencia), `fetch_document` (documento completo por ID), `list_hierarchy`, `list_facets`, `server_info`. Contrato técnico completo verificado en Fase 2: ver [`docs/provider-contracts/entscheidsuche.md`](provider-contracts/entscheidsuche.md).
  - Stack: Python + FastMCP + Elasticsearch, expuesto vía uvicorn y nginx.
  - Licencia del código: MIT. Licencia de los datos: obras oficiales suizas no sujetas a copyright (Art. 5 LDA/URG); las estructuras/compilaciones de entscheidsuche.ch son de uso libre.
  - Verificado directamente (dos fuentes independientes: agente de investigación + WebFetch propio al repositorio).
- Cobertura: Tribunal Federal + los 26 cantones (tribunales cantonales, administrativos, órdenes penales), desde ~2017, con aceptación de aportes de decisiones no publicadas desde 2021.
- Implicación arquitectónica: la integración se realiza como **adaptador cliente MCP** (`EntscheidsucheMcpProvider`, en `packages/providers/entscheidsuche`) que habla el protocolo MCP directamente contra `https://mcp.entscheidsuche.ch/mcp` — **nunca** mediante scraping directo de tribunales ni mediante una API REST propia inventada para esta fuente, ya que la fuente real es un servidor MCP, no un REST endpoint.
- Existe también un PDF de documentación de API (`entscheidsuche.ch/pdf/EntscheidsucheAPI.pdf`) que no pudo extraerse como texto legible (PDF con contenido comprimido); pendiente de revisión manual antes de construir el proveedor.

## 3. Jurisprudencia cantonal directa (portales propios)

Muestra verificada (Zúrich, Vaud, Ginebra):

| Cantón  | Portal                              | Acceso                             | Idioma |
| ------- | ----------------------------------- | ---------------------------------- | ------ |
| Zúrich  | gerichte-zh.ch                      | Web, base de datos propia, sin API | DE     |
| Vaud    | vd.ch/justice/jurisprudence-et-lois | Web, sin API                       | FR     |
| Ginebra | justice.ge.ch                       | Web, sin API                       | FR     |

Estos portales son complementarios, no sustitutos de entscheidsuche.ch: sirven como fuente de verificación cruzada y como origen para el campo `url_fuente` cuando se quiera enlazar directamente al tribunal. — Verificado (nivel URL/acceso), no se investigó estructura HTML detallada de cada uno.

### 3.1 Jurisprudencia cantonal directa — Appenzell Ausserrhoden

**Fuente oficial:** `https://ar.ch/gerichte/kantonsgericht/rechtsprechung-der-gerichte/` enlaza la
base de datos pública `https://rechtsprechung.ar.ch/`.

- Acceso: aplicación web pública LEv4 con endpoints JSON usados por el frontend; sin autenticación
  ni CAPTCHA observado durante la verificación live del 2026-08-04. El portal establece cookie
  `SCDID_S`, pero la busqueda y descarga puntual funcionaron sin flujo de login.
- Busqueda: POST a
  `https://rechtsprechung.ar.ch/api/.netlify/functions/searchQueryService` con `queryString`,
  `guiLanguage` y agregaciones (`treePath`, `decisionDate`, `publicationDate`,
  `entscheidKategorie`, `argvpBehoerde`, `gvpNumber`, `pubYearGvp`).
- Descarga: PDF oficial desde rutas `https://rechtsprechung.ar.ch/download/Obergericht/...`.
- Identificadores verificados: numeros de procedimiento como `O2V 19 21`, `O1S 18 1` y `AB 17 16`.
  El año del numero de procedimiento no debe confundirse necesariamente con el año de la sentencia.
- Ejemplos oficiales verificados en vivo:
  - `O2V 19 21`, `leid` `834a4adb-0042-30b6-8d14-f0a7b47f2fd1`, PDF
    `OG-20200519-O2V-19-21-20200721.pdf`, 86.461 bytes, SHA-256
    `cf22ebd5ff0886a6173dcb29a6f67126a8c85e1b56b6e706ac8b41acb5c8d167`.
  - `O1S 18 1`, `leid` `b1516b52-bc8d-3c44-b184-8e1d321c3cb3`, PDF
    `OG-20181022-O1S-18-1-20190103.pdf`, 86.945 bytes, SHA-256
    `f4431b41ea52c7c259f33d58d6925578be41278166a8b8e91eb32b876fd0cc76`.
- Implicacion arquitectonica: `canton_appenzell_ausserrhoden` es un adaptador oficial directo y
  puntual. No sustituye a `entscheidsuche.ch` para otros cantones, no implica soporte para
  Appenzell Innerrhoden (`AI`) y no debe seleccionar documentos que solo citen la referencia.

## 4. Legislación federal — Fedlex

**Fuente oficial:** https://www.fedlex.admin.ch (portal público) y https://fedlex.data.admin.ch (datos enlazados).

- **SPARQL endpoint:** `https://fedlex.data.admin.ch/sparqlendpoint`, sin autenticación, timeout de 45s, interfaz OpenLink Virtuoso. — Verificado.
- **No hay API REST oficial documentada públicamente.** El único acceso programático confirmado es SPARQL. — Verificado.
- Formatos: RDF/Turtle (metadatos, ontología JOLux), XML Akoma Ntoso (textos legislativos), PDF y HTML desde el portal clásico. — Verificado. **Actualizado en Fase 3**: se localizó el corte real exacto para la Constitución federal escaneando sus 38 versiones fechadas reales: la primera con manifestación XML/Akoma Ntoso es `2021-01-01`, no "30 de mayo de 2022" como se estimó en Fase 0 — ver `tests/fixtures/fedlex/akoma_ntoso_cutover_scan_constitution.json`. Este corte es un dato empírico por acto, no una fecha universal documentada por Fedlex; cada consolidación debe verificarse individualmente (ver ADR 0012).
- Identificadores: **ELI (European Legislation Identifier)**, URIs con prefijo `https://fedlex.data.admin.ch/eli/...`, adoptado como estándar; y **RS/SR** (Systematische Sammlung / Recueil systématique), p. ej. `RS 952.0`. No se identificó un URN nativo distinto de ELI. — Verificado. **Actualizado en Fase 3**: el RS/SR no es único a través del tiempo — confirmado con dos casos reales independientes (KVG 832.10, Constitución 101 vs. su predecesora de 1874) — ver `docs/provider-contracts/fedlex.md`.
- Versionado histórico: los textos consolidados se identifican por fecha de entrada en vigor ("estado a [fecha]"); no por UUID de versión. Existe desde 1948 (inicio de la AS/RO), digital completo desde finales de los 90. — Verificado.
- Idiomas: DE, FR, IT, RM (romanche) y EN para ciertos metadatos. — Verificado. **Actualizado en Fase 3**: códigos reales de `jolux:language` confirmados en vivo: `DEU`, `FRA`, `ITA`, `ROH` (no `RON`), `ENG` (no `EN`).
- Licencia: reutilización permitida, incluido uso comercial, siguiendo principios de Linked Open Data; el texto exacto de la licencia (¿CC0? ¿CC-BY?) **no se confirmó literalmente** — Parcial, sigue pendiente tras Fase 3, revisar antes de redistribuir datos derivados.
- robots.txt: permite scraping general, excluye parámetros de impresión (`?print=`, `?printId=`). — Verificado.
- Limitación: sin descarga masiva nativa documentada; existen extractos en repositorios GitHub de terceros (no oficiales) que no deben tratarse como fuente primaria.
- **Nuevo en Fase 3**: `bif:contains` (búsqueda de texto libre propia de Virtuoso) se probó en vivo contra el endpoint público y fue rechazada con HTTP 400 "Illegal requests in query" — no está disponible. `FILTER(CONTAINS(...))` sí funciona pero es lento sin `LIMIT` (~58s observado en Fase 0) y rápido con `LIMIT` (<1s observado en Fase 3).
- **Nuevo en Fase 3**: se confirmó un hallazgo de seguridad real: `jolux:isExemplifiedByPrivate`/`jolux:wasExemplifiedByPrivate` apuntan a `intranet.fedlex.admin.ch`, un dominio interno visible solo porque el endpoint SPARQL público expone esas triplas — nunca debe seguirse (ver ADR 0010).

## 5. Bundesblatt (BBl) y Amtliche Sammlung (AS/RO/RU)

- **Ambos están totalmente integrados en Fedlex**, no son sistemas separados. — Verificado.
- Bundesblatt: acceso por año vía `fedlex.admin.ch/de/oc/index/{año}`, formatos PDF/HTML.
- Amtliche Sammlung: es la publicación que **confiere fuerza de ley** (la compilación sistemática RS/SR es meramente informativa) — dato jurídicamente crítico a reflejar en el modelo de datos (`caracter_oficial`).
- Histórico 1948–2018 disponible como dataset en opendata.swiss ("Official Compilation of Federal Legislation (BS/AS) 1947–2018"), formatos PDF/ZIP. — Verificado.

## 6. SHAB / FOSC / FUSC (Hoja Oficial Suiza de Comercio)

**Fuente:** https://www.shab.ch

- **No se confirmó una API REST pública propia y documentada de SHAB.** Se mencionan endpoints (`shab.ch/api/v1/publications/{uuid}/pdf`) en repositorios de terceros, sin especificación formal pública. — No verificado como API oficial.
- El "Amtsblattportal" federal ofrece una API REST para publicaciones oficiales, pero requiere cuenta registrada. — Parcial.
- Formato confirmado: PDF. Búsqueda web libre por fecha, cantón, empresa, tipo de publicación.
- Conclusión operativa: **usar Zefix como vía de acceso programático** a las publicaciones SHAB asociadas a una empresa, en lugar de intentar acceder a SHAB directamente.

**Corrección Fase 5 (auditoría en vivo, 2026-07-27):** el endpoint `shab.ch/api/v1/publications/...` mencionado arriba como "no verificado" **es real** — confirmado por inspección de red directa contra el frontend Angular oficial de SHAB (`GET /api/v1/publications`, `/api/v1/rubrics`, `/api/v1/tenants`, sin autenticación). Sin embargo, **`shab.ch` y `amtsblattportal.ch` declaran `robots.txt: Disallow: /` para todo user-agent** (bloqueo total, verificado en ambos dominios), y la API no tiene documentación pública ni términos de reutilización para terceros. Por esta razón `ShabProvider` (Fase 5) está implementado pero **bloqueado por política de la fuente**, nunca realiza una petición de red real — ver `docs/provider-contracts/shab.md`. Se confirmó además que Zefix solo cubre la rúbrica `HR` (Handelsregister) de SHAB; el resto de rúbricas reales (quiebras `KK`, sucesiones, convocatorias judiciales, etc.) no tiene ninguna vía de acceso alternativa confirmada — no asumir que Zefix sustituye a SHAB en su totalidad.

## 7. Zefix (Índice Central de Razones de Comercio)

**Fuente:** https://www.zefix.admin.ch

- **API REST oficial verificada**: `https://www.zefix.admin.ch/ZefixPublicREST/api/v1`, con entorno de integración/test en `zefixintg.admin.ch`, documentación Swagger en `/ZefixPublicREST/swagger-ui/index.html`. — Verificado.
- Autenticación: usuario/contraseña, se solicita escribiendo a `zefix@bj.admin.ch`. No hay barrera de entrada pública documentada (no es self-service). — Verificado.
- Formato: JSON. — Verificado.
- Datos expuestos: razón social, sede, domicilio, forma jurídica, número UID, estado, personas/administradores, publicaciones SHAB asociadas.
- También existe un endpoint Linked Data / SPARQL (LINDAS) para Zefix.
- Licencia: dataset publicado en opendata.swiss bajo CC-BY (requiere atribución). — Verificado.
- Límite de frecuencia: no documentado públicamente; a confirmar directamente con `zefix@bj.admin.ch` antes de construir el proveedor.

## 8. SECO — AVIG-Praxis (seguro de desempleo)

**Fuente:** https://www.arbeit.swiss/secoalv/en/home/service/publikationen/kreisschreiben---avig-praxis.html

- Formato: **exclusivamente PDF**, documentos monolíticos por módulo temático (ALE, KAE, SWE, IE, RVEI). — Verificado.
- **Sin estructura consultable por párrafo o capítulo**: no hay índice jerárquico navegable, solo el documento completo. Esto implica que `get_article_at_date`-like granularity no es posible sin post-procesado propio (extracción y segmentación manual/asistida).
- Versionado: por fecha de vigencia ("gültig ab [fecha]"), con archivo histórico en `.../archiv_weisungen.html`. — Verificado.
- Acceso: HTTP directo, sin autenticación, sin API.
- Licencia: copyright SECO, con prohibición expresa de reproducción sin consentimiento escrito — **restricción de licencia relevante**: cualquier herramienta MCP debe citar y enlazar, no reproducir el texto completo salvo fragmentos de cita razonable.

**Corrección Fase 4 (auditoría en vivo, 2026-07-26):** la URL de Fase 0 arriba redirige (301) a la página real actual `https://www.arbeit.swiss/de/informationszentrum/publikationen` (alemán) / `https://www.arbeit.swiss/fr/centre-dinformation/publications-fr` (francés, slug distinto, no un simple prefijo). No se encontró ningún texto de licencia explícito con prohibición de reproducción durante la auditoría en vivo (ni en la página ni en las cabeceras HTTP) — se documenta como obra oficial de dominio público (Art. 5 LDA/URG), consistente con el resto de fuentes federales auditadas, y se corrige la afirmación de Fase 0 por no haberse podido verificar. `SecoProvider` (Fase 4) implementa `search_seco_documents`/`get_official_document` citando siempre la fuente y preservando hash de contenido; ver `docs/provider-contracts/seco.md`.

## 9. BSV/OFAS — Seguridad social (AVS/AI)

**Fuente:** https://sozialversicherungen.admin.ch/de/ y https://www.bsv.admin.ch

- Formato: PDF, organizados temáticamente (AVS, AI, APG, prestaciones complementarias). — Verificado parcialmente; una de las URLs de circulares devolvió 404 durante la auditoría y redirige a un dominio alternativo, señal de que la estructura de URLs cambia y debe revalidarse antes de implementar el proveedor.
- Sin API pública, sin dataset confirmado en opendata.swiss específico de BSV.
- Licencia: derechos de la Confederación, sin marca CC explícita.

**Corrección Fase 4 (auditoría en vivo, 2026-07-26):** confirmado que las circulares BSV viven en un portal dedicado DotNetNuke/2sxc (`sozialversicherungen.admin.ch`), enlazado explícitamente desde `www.bsv.admin.ch/de/vollzug`. Estructura de URL real verificada: listado de carpeta `/de/f/{folderId}`, detalle/historial de versiones `/de/d/{docId}`, descarga `/de/d/{docId}/download[?version=N]` — con historial de versiones real y descargable por versión (a diferencia de SECO). Solo la rama IV (carpeta 5661) se auditó en profundidad. `BsvProvider` (Fase 4) implementa `search_bsv_documents`/`get_official_document`; ver `docs/provider-contracts/bsv.md`.

## 10. ESTV/AFC — Fiscalidad federal (IVA/MWST)

**Fuente:** https://www.estv.admin.ch y portal de publicaciones web `https://www.gate.estv.admin.ch/mwst-webpublikaciones/public/`

- Formato: HTML navegable + PDF descargable. Las "MWST-Info" son publicaciones web estructuradas (WAP) desde 2010, con tabla de contenido jerárquica (22 secciones, subsecciones por "Ziffer" numerada) y búsqueda textual — **la fuente mejor estructurada de las tres administrativas (SECO/BSV/ESTV) para extracción granular**. — Verificado.
- Tasas de IVA vigentes: página HTML estática (`.../vat-rates-switzerland.html`), sin descarga estructurada (CSV/Excel) ni dataset abierto confirmado.
- Sin API REST pública documentada.
- Licencia: derechos federales reservados, sin CC explícito.

**Corrección Fase 4 (auditoría en vivo, 2026-07-26/27):** confirmado que ESTV opera **tres sistemas reales distintos**: (1) el portal institucional clásico `www.estv.admin.ch/de/kreisschreiben-*` (Nuxt, misma familia que SECO), implementado en Fase 4; (2) el sistema JSF/PrimeFaces de MWST-Infos en `gate.estv.admin.ch` mencionado en la URL de Fase 0 arriba, verificado en vivo como real pero que requiere JavaScript para renderizar el contenido y por tanto **no implementado** (documentado como limitación, no como fuente activa); (3) `www.estv2.admin.ch`, observado por enlace, no explorado. `EstvProvider` (Fase 4) implementa `search_estv_documents`/`get_official_document` solo contra el portal clásico; ver `docs/provider-contracts/estv.md`.

## 11. Legislación cantonal (26 cantones)

Hallazgo principal: **alta heterogeneidad técnica, sin estandarización central.**

- Patrón dominante: al menos 23 cantones usan la plataforma comercial **LexWork** (proveedor Sitrox) para edición/publicación, con interfaz de búsqueda web, sin API REST pública documentada.
- Outliers verificados con sistemas propios: **Zúrich** (ZH-Lex), **Ticino** (Raccolta Leggi, sistema PHP propio desde 2018), **Ginebra** (SIL Genève, con versión "Pro" de pago).

| Cantón       | Portal                                | Acceso                                 | Identificador                         | Idioma  | Histórico                |
| ------------ | ------------------------------------- | -------------------------------------- | ------------------------------------- | ------- | ------------------------ |
| Zúrich (ZH)  | zh.ch/.../gesetzessammlung.html       | HTML, sin API                          | LS (14 carpetas) / OS (81 volúmenes)  | DE      | Digital desde 1999       |
| Vaud (VD)    | prestations.vd.ch/pub/blv-publication | HTML, sin API (sistema BLV desde 2018) | Números BLV (antes RSV)               | FR      | Electrónico desde 2004   |
| Ticino (TI)  | m3.ti.ch/CAN/RLeggi                   | HTML/PHP, sin API                      | Código de 6 dígitos                   | IT      | Sistema nuevo desde 2018 |
| Berna (BE)   | be.ch/belex                           | HTML, sin API                          | BSG (sistemática) / BAG (cronológica) | DE + FR | En línea desde 2005      |
| Ginebra (GE) | silgeneve.ch/legis                    | HTML                                   | rs/GE                                 | FR      | Actualización diaria     |

Agregadores relevantes (ambos **no oficiales**, a marcar explícitamente como tales en cualquier respuesta):

- **LexFind.ch** — buscador unificado que indexa los 26 cantones mediante scraping de los portales, sin exponer API propia documentada.
- **OpenCaseLaw.ch** — API REST de terceros, código abierto, con más de 21.000 leyes federales y cantonales indexadas (`opencaselaw.ch/api/`). Útil como candidato de arranque rápido, pero sin garantía de mantenimiento ni carácter oficial.

**Corrección Fase 5 (auditoría en vivo, 2026-07-27):** verificada en vivo una muestra representativa por familia técnica (decisión explícita con el usuario: muestra, no los 26 cantones). Hallazgos que corrigen la tabla de Fase 0:

- **Berna SÍ tiene una API JSON real** (`www.belex.sites.be.ch/api/de/texts_of_law/lightweight_index`, `/api/de/systematic_categories`) — la fila de Fase 0 ("HTML, sin API") era incorrecta; confirmado además que la plataforma se llama realmente "LexWork" (título de página, endpoint `/api/trox_work/...`) y que `robots.txt` permite explícitamente el catálogo, solo prohíbe los endpoints de búsqueda de texto libre. **Implementado** (`CantonalLexWorkProvider`, solo catálogo/listado — la recuperación de texto completo de una ley concreta no se verificó).
- **Zúrich confirmado**: esquema de URL real con número sistemático y fechas de vigencia codificadas literalmente (`zhlex-ls/erlass-131_1-2015_04_20-2018_01_01-105.html`), sin API, `robots.txt` sin restricciones. **Implementado** (`CantonalZhProvider`, resuelve una ley conocida por número sistemático; sin búsqueda de texto libre).
- **Ticino**: HTTP 403 a peticiones automatizadas (curl con User-Agent realista y navegación real por navegador) durante la auditoría — no se intentó eludir la protección. No implementado.
- **Vaud**: esquema de URL real confirmado por fuente externa (`prestations.vd.ch/pub/blv-publication/actes/consolide/{numeroBLV}`), pero el dominio completo (incluido su propio `robots.txt`) devolvió "Accès non autorisé" de forma consistente. No implementado.
- **Ginebra**: portal real confirmado, `robots.txt` sin restricciones, pero interfaz antigua basada en frames/JavaScript (`javascript:void(0)`) que requeriría exploración adicional sustancial. No implementado.
- El resto de los 26 cantones (asumidos como LexWork por Fase 0) **no se verificó individualmente** en Fase 5A — ver corrección de Fase 5B a continuación.

**Corrección Fase 5B (auditoría en vivo de los 21 cantones restantes, cierre de fase, 2026-07-27):** se auditaron en vivo (WebFetch/WebSearch/curl reales) los 21 cantones no cubiertos por la muestra de Fase 5A. Hallazgo principal: **19 de los 26 cantones (BE, LU, UR, OW, NW, GL, ZG, SH, AR, AI, SG, GR, AG, TG, SO, BS, BL, FR, VS) confirman LexWork en vivo** (título de página "LexWork" y/o respuesta JSON real idéntica en `/api/{lang}/systematic_categories`), contradiciendo la hipótesis de Fase 0 solo en el número exacto pero confirmándola en la sustancia — la generalización a "un adaptador genérico para LexWork" SÍ era viable, y se implementó (`CantonalLexWorkProvider` parametrizado, un descriptor real por canton). Además se descubrió el endpoint real de detalle (`texts_of_law/{numero}/show_as_json`, ausente de `robots.txt`) que expone texto completo de la versión vigente y granularidad real de artículo — no documentado en la auditoría de Fase 5A por limitación de tiempo, no por inexistencia.

Cantones NO LexWork confirmados: **Schwyz** (HTML/PDF simple sin API), **Neuchâtel** y **Jura** (sistema propio ASP.NET sin API JSON pública), además de Ticino/Vaud (bloqueados, ya documentado) y Ginebra (complejo, ya documentado). Ningún cantón adicional resultó ser LexWork sin serlo, ni viceversa — la clasificación de Fase 0 ("~23 cantones") era una sobreestimación razonable, no una fabricación.

Conclusión honesta sobre viabilidad (revisada tras Fase 5B): cubrir la mayoría de los 26 cantones **fue más viable de lo estimado en Fase 5A** gracias a la homogeneidad real de LexWork — 20/26 cantones tenían legislación implementada y probada en vivo tras Fase 5B (19 LexWork + ZH). Los 6 restantes (SZ, NE, JU, TI, VD, GE) quedaron pendientes de auditoría propia.

**Cierre de cobertura cantonal (2026-07-25/27):** se auditaron en vivo los 6 cantones restantes con la misma metodología (inspección de red real, nunca simulada). Resultado: **Schwyz** resultó tener acceso público real (colección HTML + PDF de texto), **Neuchâtel y Ginebra** resultaron compartir en vivo la misma plataforma comercial "SIL" (ARCHILEXMP sa) — un descubrimiento no anticipado que permitió un único adaptador reutilizable en vez de dos — y **Jura** resultó tener un único camino real de recuperación (descarga directa de un documento ya identificado, sin búsqueda). Los cuatro se implementaron: `CantonalSzProvider`, `CantonalSilProvider` (compartido GE/NE), `CantonalJuProvider`. **Ticino y Vaud** fueron re-auditados para determinar la causa precisa del bloqueo (no solo constatarlo): TI está protegido por F5 BIG-IP (WAF/Bot Defense real, cookies `TSPD_101`/`BIGipServer*` confirmadas), VD por un muro de acceso de aplicación real ("Accès non autorisé" en su propio portal de publicación y robots.txt) — ninguno tiene una alternativa oficial no-agregador dentro del tiempo de auditoría, y LexFind.ch (único agregador de terceros con cobertura de ambos) fue descartado explícitamente por instrucción del usuario. **Resultado final: 24/26 cantones con legislación implementada** (19 LexWork + ZH parcial + SZ + GE + NE + JU parcial), **26/26 no fue alcanzable** con acceso público, legítimo y reproducible — ver matriz completa y evidencia detallada en `docs/providers/cantonal-legislation.md` y los contratos técnicos `cantonal-sz.md`/`cantonal-sil.md`/`cantonal-ju.md`.

## 12. Fuentes municipales

**Pendiente.** No se investigó en esta fase. Dado que cada uno de los cerca de 2.000 municipios suizos publica de forma independiente (si es que publica normativa consultable en línea), este bloque requiere un enfoque distinto: probablemente cobertura bajo demanda (el usuario aporta el municipio concreto) en lugar de un catálogo exhaustivo. A decidir en una fase posterior, no antes de Fase 6.

---

## Resumen de viabilidad por fuente (para orientar las fases)

| #   | Fuente                                | Acceso confirmado                                              | Viabilidad de proveedor real                                                                                                           | Fase sugerida |
| --- | ------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | Tribunal Federal (bger.ch)            | Web/PDF, sin API                                               | Media — sin API, requiere scraping puntual respetuoso de robots.txt                                                                    | 2             |
| 2   | entscheidsuche.ch (agregador)         | MCP público sin auth                                           | **Implementada y probada en Fase 2** (`EntscheidsucheMcpProvider`)                                                                     | 2             |
| 3   | Portales cantonales de jurisprudencia | Web, sin API                                                   | Baja/complementaria                                                                                                                    | 6             |
| 4   | Fedlex                                | SPARQL sin auth                                                | Alta                                                                                                                                   | 3             |
| 5   | BBl / AS                              | Integrado en Fedlex                                            | Alta (mismo proveedor que Fedlex)                                                                                                      | 3             |
| 6   | SHAB                                  | API real confirmada, bloqueada por robots.txt                  | **Implementada, bloqueada por política de la fuente** (Fase 5)                                                                         | 5             |
| 7   | Zefix                                 | API REST oficial (credenciales por email)                      | Alta, sujeta a obtención de credenciales — fuera de alcance de Fase 5                                                                  | 5+            |
| 8   | SECO / AVIG-Praxis                    | PDF sin estructura                                             | **Implementada y probada en Fase 4** (`SecoProvider`)                                                                                  | 4             |
| 9   | BSV/OFAS                              | PDF, historial de versiones real                               | **Implementada y probada en Fase 4** (`BsvProvider`)                                                                                   | 4             |
| 10  | ESTV/AFC                              | HTML estructurado + PDF                                        | **Implementada y probada en Fase 4** (`EstvProvider`, portal clásico)                                                                  | 4             |
| 11  | Legislación cantonal (26)             | 19 LexWork + ZH-Lex + SZ + SIL(GE/NE) + JU verificados en vivo | **Implementada** (24 de 26 cantones; TI/VD legítimamente bloqueados con evidencia real — ver `docs/providers/cantonal-legislation.md`) | 5             |
| 12  | Fuentes municipales                   | No investigado                                                 | Pendiente                                                                                                                              | 6+            |

## Fuentes consultadas

- https://www.bger.ch
- https://github.com/entscheidsuche/entscheidsuche-mcp (verificado directamente)
- https://mcp.entscheidsuche.ch (verificado directamente)
- https://entscheidsuche.ch/pdf/EntscheidsucheAPI.pdf (no legible como texto; pendiente revisión manual)
- https://www.gerichte-zh.ch, https://www.vd.ch/justice/jurisprudence-et-lois, https://justice.ge.ch
- https://www.fedlex.admin.ch, https://fedlex.data.admin.ch/sparqlendpoint, https://swiss.github.io/fedlex-jolux/introduction.html
- https://opendata.swiss/en/dataset/official-compilation-of-federal-legislation-bs-as-1947-2018
- https://www.shab.ch
- https://www.zefix.admin.ch/ZefixPublicREST/swagger-ui/index.html, https://opendata.swiss/en/dataset/zefix-zentraler-firmenindex
- https://www.arbeit.swiss/secoalv/en/home/service/publikationen/kreisschreiben---avig-praxis.html
- https://sozialversicherungen.admin.ch/de/, https://www.bsv.admin.ch
- https://www.estv.admin.ch, https://www.gate.estv.admin.ch/mwst-webpublikaciones/public/
- https://www.zh.ch, https://prestations.vd.ch/pub/blv-publication, https://m3.ti.ch/CAN/RLeggi, https://www.be.ch/belex, https://silgeneve.ch/legis
- https://lexfind.ch, https://opencaselaw.ch/api/, https://github.com/rnckp/awesome-open-legal-switzerland (repositorio de referencia comunitario, no oficial)

## Próxima verificación recomendada antes de Fase 2

1. ~~Leer manualmente el PDF de la API de entscheidsuche.ch~~ — **hecho en Fase 3** (2026-07-26): las 12 páginas se descargaron y leyeron íntegras. Describe el sistema de scrapers/Elasticsearch subyacente (más antiguo y de bajo nivel) sobre el que corre el servidor MCP que ya integramos; no cambia ninguna decisión de Fase 2, la confirma y contextualiza. Ver `docs/provider-contracts/entscheidsuche.md#pdf-de-documentación-de-la-api-leído-íntegramente-en-fase-3-corrección-pendiente-de-fase-2`.
2. Solicitar acceso de prueba a Zefix (`zefix@bj.admin.ch`) para confirmar rate limits reales. Sigue pendiente (Fase 5).
3. ~~Revalidar las URLs de circulares BSV (una devolvió 404 en esta auditoría).~~ — **hecho en Fase 4** (2026-07-26): estructura real confirmada en `sozialversicherungen.admin.ch/de/f/{folderId}` y `/de/d/{docId}`, ver corrección arriba y `docs/provider-contracts/bsv.md`.
4. Confirmar el texto exacto de la licencia de reutilización de Fedlex antes de cachear o redistribuir contenido derivado. Sigue pendiente tras Fase 3 (ver `docs/provider-contracts/fedlex.md#licencia-y-condiciones-de-reutilización`).
