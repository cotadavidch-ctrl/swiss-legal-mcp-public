# Contrato técnico — Fedlex (SPARQL / Linked Data / Akoma Ntoso)

Verificado en vivo el 2026-07-26 contra `https://fedlex.data.admin.ch/sparqlendpoint` (SPARQL 1.1, `GET` con parámetro `query`, `Accept: application/sparql-results+json`, sin autenticación) y descarga directa de manifestaciones vía HTTPS. Todas las capturas crudas están en [`tests/fixtures/fedlex/`](../../tests/fixtures/fedlex/) con su README explicando cada una.

Fedlex reutiliza la ontología **JOLux** (`http://data.legilux.public.lu/resource/ontology/jolux#`), originalmente desarrollada para el sistema legislativo de Luxemburgo — el prefijo del namespace lo confirma; Fedlex no tiene su propia ontología independiente.

## Endpoint

- URL: `https://fedlex.data.admin.ch/sparqlendpoint` (interfaz Virtuoso OpenLink).
- Método: `GET` con `?query=<SPARQL urlencoded>`. Timeout observado del propio servidor: no confirmado explícitamente en esta fase, pero Fase 0 documentó 45s; en esta auditoría las consultas tardaron entre 100ms y ~58s según la selectividad (ver "Rendimiento" abajo).
- Sin autenticación, sin cabeceras de rate-limit observadas.
- Formatos de respuesta: `application/sparql-results+json` (usado en toda la auditoría) — no se probó `application/sparql-results+xml` ni RDF/XML directo sobre el endpoint SPARQL en esta fase.

## Modelo FRBR/JOLux confirmado (Work → Expression → Manifestation)

```
jolux:ConsolidationAbstract  (= jolux:Work; representa la norma en abstracto, multilingüe, sin fecha)
  │  jolux:historicalLegalId        → número RS/SR (string, p.ej. "101", "220", "832.10")
  │  jolux:basicAct                 → eli/oc/... (el Acto tal como se publicó en la Colección Oficial / AS)
  │  jolux:classifiedByTaxonomyEntry→ tema de la Systematische Sammlung
  │  jolux:inForceStatus            → vocabulario SKOS (ver "Vigencia" abajo)
  │  jolux:dateEntryInForce, jolux:dateDocument
  │  jolux:isRealizedBy             → N expresiones de idioma (abstractas, sin fecha)
  │       jolux:title, jolux:titleShort, jolux:language, jolux:historicalLegalId
  │
  └─ jolux:isMemberOf ← jolux:Consolidation  (versión FECHADA concreta; también jolux:Work)
         │  jolux:dateApplicability, jolux:dateEndApplicability  → intervalo de vigencia exacto
         │  jolux:publicationDate (puede repetirse, multivaluado)
         │  jolux:legalResourceFamilyType → resource-family/cc
         │  jolux:isRealizedBy      → N expresiones de idioma FECHADAS
         │       jolux:language, jolux:historicalLegalId
         │       jolux:title ⚠️ en versiones antiguas puede ser un literal genérico
         │            ("Consolidation: 101 - 2000-01-01"), no el título real de la ley —
         │            usar siempre el título de la ConsolidationAbstract como canónico.
         │       jolux:isEmbodiedBy → M manifestaciones (una por formato)
         │            jolux:format          → vocabulario EU file-type (XML, HTML, PDF...)
         │            jolux:userFormat      → vocabulario propio de Fedlex (xml, html, pdf-a, docx, doc)
         │            jolux:isExemplifiedBy → URL PÚBLICA del archivo (única fuente fiable)
         │            jolux:isExemplifiedByPrivate  → ⚠️ dominio intranet.fedlex.admin.ch — NUNCA USAR
         │            jolux:wasExemplifiedBy(Private) → revisiones intermedias/historicas del archivo — no usar como canónico
```

Verificado con la Constitución federal (`eli/cc/1999/404`, RS 101): `jolux:isRealizedBy` de la ConsolidationAbstract da 5 expresiones (`de`, `fr`, `it`, `rm`, `en`) — multilingüe real incluyendo romanche e inglés para este acto concreto. **No generalizar**: el Código de Obligaciones (RS 220) solo mostró de/fr/it en las consultas realizadas; no se confirmó romanche ni inglés para todos los actos.

## Identificadores

- **ELI**: `https://fedlex.data.admin.ch/eli/{familia}/{año}/{número}[/{fecha o idioma}[/{formato}]]`. Familias confirmadas: `cc` (Classified Compilation / Systematische Sammlung — la que consultan casi todas las herramientas de esta fase) y `oc` (Official Compilation / Amtliche Sammlung — la publicación que realmente confiere fuerza de ley). El `{año}` en la URI **no siempre es el año calendario real** de la ley: RS 220 (Código de Obligaciones, 1911) tiene ELI `cc/27/...` y RS 210 (Código Civil, 1907) tiene `cc/24/...` — son identificadores de secuencia interna de Fedlex, no años literales. No asumir `{año}` == año de promulgación.
- **RS/SR**: propiedad `jolux:historicalLegalId` (string, p. ej. `"101"`, `"220"`, `"832.10"`). **No es estable en el tiempo, confirmado con DOS ejemplos reales independientes**: RS 832.10 devolvió dos `ConsolidationAbstract` distintos (KVG 1911 derogada en 1996, y KVG 1994 vigente desde 1996) — ver `tests/fixtures/fedlex/jolux_rs_832-10_kvg_ambiguous.json`. Y, verificado durante la integración en vivo de `FedlexProvider`, RS **101** identifica igualmente dos actos: la Constitución de 1999 vigente Y su predecesora derogada, la Constitución federal de 1874 (`eli/cc/1/1_1_1`, `jolux:dateNoLongerInForce` = 2000-01-01) — ver `tests/fixtures/fedlex/jolux_rs_101_constitution_ambiguous.json`. Esto confirma que la reutilización de RS entre una norma y su predecesora derogada es un patrón general de Fedlex, no un caso aislado. Cualquier búsqueda por RS debe estar preparada para más de un resultado y no asumir unicidad; `FedlexProvider.resolveWorkEli` lanza `AmbiguousCitationError` en ambos casos reales.
- **BBl/FF (Bundesblatt/Feuille fédérale)**: no se encontró una propiedad JOLux dedicada y documentada; el único dato relacionado observado fue un predicado no oficial (`http://cogni.internal.system/model#historicalId`, valor `"RO 1999 2556"` para la Constitución) que en realidad es una cita **AS/RO**, no BBl/FF. No se confirmó ninguna referencia BBl/FF real en esta auditoría — campo ausente, no inventado.
- **Dossier interno**: `dcterms:identifier` con datatype `https://fedlex.data.admin.ch/datatype/dossier` (p. ej. `"19995395"`) — identificador administrativo interno de Fedlex, se preserva en `rawMetadata` pero no se expone como campo semántico propio.

## Vigencia (`jolux:inForceStatus`)

Vocabulario SKOS confirmado (`https://fedlex.data.admin.ch/vocabulary/enforcement-status/{0..4}`), con etiquetas de/fr/it/en/rm:

| Valor | de                                                                            | fr                     | en                            |
| ----- | ----------------------------------------------------------------------------- | ---------------------- | ----------------------------- |
| 0     | In Kraft                                                                      | En vigueur             | In force                      |
| 1     | Nicht mehr in der SR publiziert                                               | Plus publié dans le RS | No longer published in the SR |
| 2     | Gegenstandslos                                                                | Sans objet             | Not applicable                |
| 3     | Nicht mehr in Kraft                                                           | Plus en vigueur        | No longer in force            |
| 4     | (no resuelto en esta auditoría — existe pero no se consultaron sus etiquetas) |                        |                               |

## Resolución temporal de versiones (determinista, verificada)

Cada `jolux:Consolidation` fechada expone `jolux:dateApplicability` (inicio) y `jolux:dateEndApplicability` (fin, ausente en la versión vigente/futura más reciente). Verificado con la Constitución: **~40 versiones** desde `2000-01-01` hasta una versión futura ya programada `2029-01-01` (sin fecha de fin — significa "última versión conocida, aún no hay otra que la suceda"). El Código de Obligaciones tiene **100 versiones fechadas**. Algoritmo de resolución confirmado como viable: elegir la `Consolidation` donde `dateApplicability <= fecha` y (`dateEndApplicability` ausente o `>= fecha`).

## Formatos y Akoma Ntoso

Manifestaciones confirmadas para una consolidación reciente (2024): `xml`, `html`, `pdf-a`, `docx` (via `jolux:userFormat`). El XML descargado es **Akoma Ntoso real** (`xmlns="http://docs.oasis-open.org/legaldocml/ns/akn/3.0"`), con `FRBRWork`/`FRBRExpression`/`FRBRManifestation` embebidos y fechas (`jolux:dateEntryInForce`, `dateDocument`, `dateApplicability`) replicadas dentro del propio XML. Contiene `<article eId="art_N">` con `<num>`, `<heading>` y `<paragraph eId="art_N/para_M">` — permite localizar un artículo por `eId` sin regex sobre texto libre.

**Hueco histórico confirmado, con corte exacto localizado**: se escanearon en vivo formato por formato las 38 versiones fechadas reales de la Constitución (ver `tests/fixtures/fedlex/akoma_ntoso_cutover_scan_constitution.json`). Todas las consolidaciones desde `2000-01-01` hasta `2020-01-01` inclusive solo tienen manifestaciones `doc`/`pdf-a`. La primera con XML/Akoma Ntoso real es `2021-01-01` (`doc, pdf-a, docx, xml, html`). El corte no está documentado por ley ni es necesariamente el mismo para todos los actos — es un dato empírico de la Constitución, no una regla general — por eso `FedlexProvider` verifica dinámicamente las manifestaciones de cada consolidación en vez de asumir un año de corte fijo.

## Idiomas

Confirmado con consultas reales en alemán, francés e italiano (Constitución y Código de Obligaciones). El valor de `jolux:language` usa el vocabulario de idiomas de la Oficina de Publicaciones de la UE (`http://publications.europa.eu/resource/authority/language/{DEU,FRA,ITA,ENG,ROH}`), no códigos ISO 639-1 simples — hay que mapear explícitamente. El romanche (`ROH`) se confirmó disponible **para la Constitución concretamente**, no se generalizó a otras leyes.

## Riesgos y hallazgos de seguridad/calidad de datos

1. **`jolux:isExemplifiedByPrivate` / `jolux:wasExemplifiedByPrivate` apuntan a `intranet.fedlex.admin.ch`** — un dominio interno, no accesible ni destinado al público. `FedlexProvider` nunca debe construir ni seguir estas URLs (ver `OfficialSourceResolver`/allowlist en la sección de seguridad de `docs/providers/fedlex.md`).
2. **Predicados bajo `http://cogni.internal.system/model#...`** se filtran vía el endpoint público (`skipIndex`, `firstPublicationDate`, `historicalId`, `botschaftDate`, `repealDecisionDate_datum`) pero no forman parte de la ontología JOLux documentada — se preservan en `rawMetadata`, nunca se prometen como parte del contrato estable.
3. **Ambigüedad de RS/SR en el tiempo** (ver arriba) — cualquier búsqueda por número sistemático debe manejar múltiples resultados.
4. **Consultas SPARQL de texto libre sin índice son lentas**: una búsqueda por `FILTER(CONTAINS(...))` sobre literales tardó ~58 segundos en esta auditoría. El cliente debe evitar patrones de consulta equivalentes a un escaneo completo; las búsquedas reales de esta fase usan propiedades indexadas (`historicalLegalId`, `isMemberOf`) en vez de `CONTAINS` sobre texto libre.

## Licencia y condiciones de reutilización

No se confirmó el texto exacto de la licencia en esta auditoría (arrastrado como bloqueo desde Fase 0/1/2 — ver `IMPLEMENTATION_STATUS.md`). El propio dataset se declara como Linked Open Data (verificado en Fase 0), y los actos legislativos suizos son obras oficiales de dominio público (Art. 5 LDA/URG), pero la licencia de reutilización específica del dataset RDF/JOLux (¿CC0? ¿CC-BY?) sigue sin confirmarse textualmente.

## Cobertura histórica real

Confirmada profunda para actos con muchas enmiendas (Código de Obligaciones: 100 versiones) y para la Constitución (~40 versiones desde 2000, incluida una versión futura programada). No se determinó una fecha de corte universal para la disponibilidad de Akoma Ntoso — se confirmó que existe al menos un hueco (Constitución, versión de 2000) y que las versiones recientes (2024) sí lo tienen. Cada consolidación debe comprobarse individualmente.
