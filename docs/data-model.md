# Modelo de documento normalizado — swiss-legal-mcp

Estado: diseño de Fase 0. Este es el contrato de datos al que todo proveedor debe convertir (`normalize()`) su formato crudo (HTML, PDF, XML/RDF, JSON). Ningún proveedor puede omitir un campo aplicable solo porque su fuente lo hace difícil de extraer: si el dato no existe en la fuente, el campo se marca `null`/ausente, nunca se rellena con un valor inventado o inferido sin marcarlo como tal.

## Principio de trazabilidad

Todo documento normalizado debe permitir responder, sin ambigüedad: _¿de dónde viene este texto, quién lo dijo, en qué fecha, en qué idioma, y es esto literal, un resumen, o una inferencia del sistema?_

## Esquema (Zod, forma conceptual)

```ts
interface NormalizedDocument {
  // Identidad
  id: string; // ID interno swiss-legal-mcp, estable y determinista (hash de proveedor+id_origen)
  provider: ProviderId; // p.ej. "fedlex", "bger", "entscheidsuche", "zefix", "cantonal:zh"
  documentType: DocumentType; // "case" | "legislation_article" | "legislation_law" | "official_publication"
  // | "shab_entry" | "company_record" | "administrative_circular"

  // Jurisdicción
  jurisdiction: {
    level: "federal" | "cantonal" | "municipal";
    canton?: CantonCode; // ISO-ish: ZH, BE, VD, GE, TI, ... (solo si level != "federal")
    municipality?: string; // solo si level === "municipal"
  };
  authority?: string; // tribunal o autoridad emisora (p.ej. "Bundesgericht", "Tribunal cantonal de Vaud")

  // Identificadores legales específicos
  caseNumber?: string; // número de expediente (p.ej. "6B_1234/2025")
  bgeAtfDtf?: string; // cita de colección oficial (p.ej. "ATF 133 II 292"), si está publicada
  ecli?: string; // opcional, normalmente ausente. No se ha confirmado que los tribunales suizos
  // asignen ECLI de forma sistemática; no inferir su inexistencia solo por la
  // no pertenencia de Suiza a la UE/EEE — ver source-audit.md
  sourceOriginalId: string; // ID o URI tal como lo usa la fuente original (p.ej. URI ELI de Fedlex)

  // Fecha e idioma
  date: {
    decisionOrEnactment?: string; // fecha de la sentencia o de promulgación (ISO 8601). Opcional
    // desde Fase 2: el esquema remoto de entscheidsuche.ch permite decision_date == null (no
    // observado en la muestra real, pero permitido); no inventar una fecha si falta.
    inForceFrom?: string; // para legislación: fecha de entrada en vigor de esta versión
    publicationDate?: string; // fecha de publicación oficial (AS/BBl/SHAB, etc.)
  };
  language?: "de" | "fr" | "it" | "rm" | "en"; // opcional desde Fase 2: algunas fuentes (p.ej.
  // entscheidsuche.ch) no declaran el idioma real del documento en su propio esquema de
  // salida — verificado pidiendo el mismo documento en dos idiomas y obteniendo texto
  // identico (ver docs/provider-contracts/entscheidsuche.md). No inventar el idioma.

  // Contenido
  title: string;
  summary?: string; // resumen — SIEMPRE marcado como tal, nunca mezclado con texto literal
  fullText?: string; // texto literal completo, si la licencia de la fuente permite guardarlo
  excerptOnly?: boolean; // true si, por licencia, solo se conserva extracto/cita corta en vez de texto completo

  // Referencias cruzadas
  articlesCited?: string[]; // artículos de ley citados (referencias normalizadas, p.ej. "OR Art. 41")
  decisionsCited?: string[]; // otras sentencias citadas (IDs normalizados o citas BGE/ATF/DTF)
  outcome?: string; // resultado del caso (admitido/rechazado/parcial), solo si consta explícitamente en la fuente

  // Legislación (Fase 3, Fedlex) — obligatorio si documentType es
  // "legislation_law" o "legislation_article"; prohibido en cualquier otro caso.
  legislation?: {
    eli: string; // URI ELI completo de la manifestación/expresión resuelta
    systematicNumber?: string; // RS/SR (jolux:historicalLegalId) — no es único en el tiempo, ver abajo
    workTitle: string; // título canónico a nivel de Work (ConsolidationAbstract), nunca el título
    // genérico que puede aparecer en una Consolidation histórica
    expressionLanguage: "de" | "fr" | "it" | "rm" | "en";
    version: {
      date: string; // jolux:dateApplicability de la Consolidation elegida
      endDate?: string; // jolux:dateEndApplicability; ausente = versión vigente o futura sin sucesora conocida
      isHistorical: boolean;
      structuredFormatAvailable: boolean; // true solo si se verificó una manifestación Akoma Ntoso/XML real
    };
    manifestation?: { format: "xml" | "html" | "pdf" | "docx" | "doc"; url: string };
    inForceStatus:
      "in_force" | "no_longer_published" | "not_applicable" | "no_longer_in_force" | "other";
    entryIntoForceDate?: string;
    repealDate?: string;
    officialCompilationReference?: string; // cita AS/RO, p.ej. "RO 1999 2556"
    federalGazetteReference?: string; // cita BBl/FF — no confirmada en ningún acto auditado en Fase 3
    amendingActs?: { eli?: string; systematicNumber?: string; title?: string; date?: string }[];
    articleLocation?: {
      articleNumber: string;
      paragraph?: string;
      letter?: string;
      annex?: string;
    };
    // obligatorio si documentType === "legislation_article"; prohibido si es "legislation_law"
  };

  // Procedencia (obligatorio, nunca opcional en la práctica)
  provenance: {
    sourceUrl: string; // URL de la fuente original (no del agregador, si se puede resolver)
    downloadUrl?: string; // URL de descarga directa (PDF/XML) si existe
    officialSourceUrl?: string; // URL del tribunal/autoridad de origen, SOLO si el proveedor la
    // detecto en los datos de la fuente (nunca inferida). Presencia no implica verificacion —
    // ver OfficialSourceResolver, que solo valida sintaxis/dominio, no descarga el contenido.
    aggregatorUrl?: string; // URL del propio agregador (p.ej. entscheidsuche.ch). Obligatoria
    // cuando officialCharacter === "unofficial_aggregator" (ver superRefine en el schema Zod).
    retrievedAt: string; // timestamp ISO 8601 de cuándo se recuperó
    contentHash: string; // hash del contenido crudo, para detectar cambios/invalidar caché
    officialCharacter: "official" | "unofficial_aggregator";
    // p.ej. bger.ch/fedlex.admin.ch = "official";
    // entscheidsuche.ch/LexFind/OpenCaseLaw = "unofficial_aggregator"
    aggregatorName?: string; // si officialCharacter === "unofficial_aggregator", nombre del agregador
  };

  // Metadatos originales sin transformar (para depuración y auditoría)
  rawMetadata: Record<string, unknown>;

  // Marcador de naturaleza del contenido — obligatorio para cualquier campo de texto derivado
  contentNature: "literal" | "summary" | "inference";
}
```

## Reglas de uso obligatorias

1. **`contentNature` no es opcional en ninguna respuesta al usuario.** Si `fullText` está presente, `contentNature` debe ser `"literal"`. Si el sistema generó un resumen, debe ir en `summary` con `contentNature: "summary"`. Cualquier razonamiento del sistema sobre lo que "probablemente significa" un pasaje debe marcarse `"inference"` y presentarse separado del texto de la fuente, nunca entremezclado.
2. **`provenance.officialCharacter` determina el aviso al usuario.** Toda herramienta MCP que devuelva un documento con `officialCharacter: "unofficial_aggregator"` debe incluir una advertencia explícita en la respuesta (principio "advertir cuando una fuente no sea oficial").
3. **Separación federal/cantonal/municipal es estructural, no textual.** `jurisdiction.level` determina qué otros campos son válidos (`canton` solo si no es federal, `municipality` solo si es municipal) — se aplica con un refinamiento Zod (`superRefine`), no con convención de nombres.
4. **Nunca se rellena `bgeAtfDtf` o `ecli` como string vacío.** Si el dato no existe, el campo está ausente. Un string vacío se trataría erróneamente como "existe pero está vacío".
5. **`contentHash` habilita tanto caché como verificación de citas**: `verify_case_quote` y `verify_legal_citation` comparan el hash del fragmento citado por el usuario contra el `contentHash` (o un hash por sección, ver nota abajo) del documento en caché, para detectar citas alteradas o desactualizadas.
6. **Consultas históricas por fecha dependen de `date.inForceFrom`**: `get_article_at_date` y `compare_article_versions` requieren que el proveedor pueda resolver una fecha arbitraria a la versión vigente en ese momento; si el proveedor no soporta esto (p. ej. SECO/AVIG-Praxis, que solo tiene "gültig ab" a nivel de documento completo, ver auditoría), la herramienta debe declarar esa limitación explícitamente en su respuesta, no aproximarla.
7. **`officialSourceUrl` presente no equivale a "verificado".** Solo significa que el proveedor detectó sintácticamente una URL que parece apuntar a la autoridad de origen (dominio en una allowlist, HTTPS, sin IP privada — ver `OfficialSourceResolver`). Nunca implica que se descargó o comparó el contenido oficial; esa verificación real es trabajo de una fase posterior. Un documento nunca se marca `officialCharacter: "official"` solo por tener `officialSourceUrl` presente.
8. **`legislation.systematicNumber` (RS/SR) no es un identificador único a través del tiempo.** Se confirmó en vivo (Fase 3) que RS 832.10 identifica dos actos reales distintos (KVG derogada de 1911 y KVG vigente desde 1994/1996, ver `docs/provider-contracts/fedlex.md`). Ninguna herramienta puede asumir que una búsqueda por número sistemático devuelve un único resultado; debe manejar y advertir sobre múltiples coincidencias.
9. **`legislation.version.structuredFormatAvailable` gobierna si `get_article`/`compare_article_versions` pueden operar sobre estructura real.** Cuando es `false` (hueco histórico pre-Akoma Ntoso confirmado en Fase 3), la herramienta debe usar el adaptador de manifestación no estructurada (HTML/PDF) y marcar el resultado en consecuencia — nunca aplicar extracción por artículo vía regex sobre ese contenido presentándolo como equivalente a la extracción estructurada.

## Extensión Fase 3: comparación de versiones de artículo (`ArticleVersionComparison`)

`compare_article_versions` no devuelve un `NormalizedDocument` — devuelve una relación calculada entre dos documentos, modelada aparte en `packages/documents/src/articleComparison.ts` para no mezclar "documento de la fuente" con "cálculo derivado por el sistema":

```ts
interface ArticleVersionComparison {
  articleNumber: string;
  language: "de" | "fr" | "it" | "rm" | "en";
  before: { eli: string; date: string; text: string }; // texto literal de la versión anterior
  after: { eli: string; date: string; text: string }; // texto literal de la versión posterior
  changes: {
    kind: "added" | "removed" | "modified" | "unchanged";
    paragraph?: string;
    letter?: string;
    beforeText?: string;
    afterText?: string;
  }[];
  comparisonNature: "literal" | "summary";
  // "literal": los changes se derivaron de una comparación estructural real (Akoma Ntoso, eId por eId).
  // "summary": al menos una versión carece de estructura fiable (hueco histórico pre-Akoma Ntoso) y los
  // changes son una aproximación generada — nunca se presenta como comparación exacta en ese caso.
}
```

Reglas: `before.text`/`after.text` son siempre literales (nunca resumidos); si Fedlex no expone una manifestación estructurada para alguna de las dos versiones, `comparisonNature` debe ser `"summary"` y la herramienta debe advertirlo explícitamente al usuario, nunca presentar un diff aproximado como si fuera exacto.

## Extensión Fase 4: documentación administrativa (`administrativeCircular`)

`documentType: "administrative_circular"` cubre circulares, directivas, instrucciones, prácticas, comunicaciones, criterios y guías de SECO, BSV/OFAS y ESTV/AFC — nunca leyes, sentencias, formularios de otra fuente o publicaciones técnicas de otro tipo (esas usan su propio `documentType`). El bloque, obligatorio para ese `documentType` (impuesto por `superRefine`, igual que `legislation`):

```ts
interface AdministrativeCircularMetadata {
  department?: string; // oficina/departamento dentro de la autoridad (ver `authority` de nivel superior)
  administrativeDocumentType:
    | "circular"
    | "directive"
    | "instruction"
    | "guidance"
    | "practice"
    | "information_notice"
    | "technical_notice"
    | "faq"
    | "form"
    | "report"
    | "other";
  referenceNumber?: string;
  version?: string;
  issuedDate?: string;
  effectiveDate?: string;
  supersededDate?: string;
  status: "current" | "superseded" | "withdrawn" | "unknown";
  subjects?: string[];
  relatedLegalProvisions?: string[]; // texto libre, p.ej. "LACI Art. 30" — sin enlace estructurado a Fedlex todavía
  supersedesDocuments?: string[]; // SOLO si la fuente declara la relación explícitamente
  supersededByDocument?: string; // idem
  territorialScope?: string; // dónde se aplica, distinto de `jurisdiction` (dónde reside la autoridad)
  declaredBindingCharacter?: "binding" | "non_binding" | "administrative_guidance_only";
  // ausente = la fuente no se pronuncia; NUNCA se infiere a partir del tipo o formato del documento
}
```

Reglas obligatorias:

1. **Nunca inferir relaciones de sustitución.** `supersedesDocuments`/`supersededByDocument` solo se rellenan cuando la fuente lo declara explícitamente (p.ej. un aviso "sustituye a la Circular X de 2019"). Nunca se infiere por títulos parecidos, proximidad de fecha o numeración similar — riesgo explícito señalado en el encargo de Fase 4.
2. **Nunca inferir carácter vinculante.** `declaredBindingCharacter` queda ausente salvo que la propia fuente se pronuncie (muchas Weisungen de BSV/SECO se autodescriben como "sin carácter de norma jurídica" — cuando ese sea el caso, se marca `"administrative_guidance_only"`; en caso contrario, ausente).
3. **`administrativeDocumentType` sub-clasifica dentro del mismo `documentType`.** Un formulario descargable, una nota informativa y una circular formal comparten `documentType: "administrative_circular"`, distinguidos solo por este campo — no se crean `documentType` nuevos por cada variante.

## Extensión Fase 5: publicaciones SHAB (`shabPublication`)

`documentType: "shab_entry"` (ya presente en el enum desde Fase 0/1, sin bloque de metadatos hasta esta fase) cubre publicaciones del Schweizerisches Handelsamtsblatt/FOSC/FUSC. El bloque, obligatorio para ese `documentType`:

```ts
interface ShabPublicationMetadata {
  publicationNumber: string; // p.ej. "HR02-1006716804"
  rubric: string; // codigo real de la fuente, p.ej. "HR", "KK" -- nunca traducido a una taxonomia inventada
  subRubric?: string;
  publicationState: "published" | "cancelled";
  editionNumber?: string; // numero de edicion del boletin impreso, cuando la fuente lo declara
  expirationDate?: string;
  affectedEntity?: {
    type?: "company" | "person" | "other";
    displayName?: string;
    uid?: string;
    chId?: string;
  };
  registrationOffice?: { displayName: string; uid?: string };
  cantons?: string[]; // una publicacion puede afectar a varios cantones
  legalBasisText?: string; // texto libre de `meta.legalRemedy`, nunca resuelto a un articulo estructurado
  relatedPublicationIds?: string[]; // SOLO si la fuente declara la relacion explicitamente
}
```

Reglas obligatorias:

1. **`rubric`/`subRubric` son los códigos reales de SHAB**, nunca una categoría inventada — ver `docs/provider-contracts/shab.md` para la lista real observada (AB, AW, AZ, BB, BH, EK, ES, FM, HR, KK, LS, NA, SB, SR, UP, UV).
2. **`affectedEntity.type: "person"` es un hallazgo de privacidad real** (rúbrica `KK`, quiebras/sucesiones, expone nombre/fecha de nacimiento/defunción/domicilio de individuos reales) — ningún consumidor de este modelo debe usarlo para construir perfiles ni indexar en bloque.
3. **`relatedPublicationIds` nunca se infiere** — solo se rellena si la fuente declara la relación de forma estructurada (p.ej. `repeatedPublications`).
4. `ShabProvider` (Fase 5) está bloqueado por política de la fuente (`robots.txt: Disallow: /` en `shab.ch` y `amtsblattportal.ch`) — este bloque de metadatos y su mapper están implementados y probados contra datos reales capturados, pero el proveedor nunca los popula en producción (ver ADR correspondiente).

## Nota sobre granularidad

El modelo de arriba describe un documento completo (una sentencia, una ley, una circular). Para herramientas de artículo individual (`get_article`, `get_article_at_date`) se usa el mismo esquema con `documentType: "legislation_article"` y un `sourceOriginalId` que apunta al artículo específico (URI ELI con fragmento, en el caso de Fedlex). Cuando la fuente no permite esa granularidad (PDFs monolíticos de SECO/BSV, ver auditoría), el proveedor debe: (a) devolver el documento completo con un aviso de que la granularidad de artículo no está disponible, o (b) si se implementa segmentación propia, marcar el resultado con `contentNature` acorde y registrar en `rawMetadata` que la segmentación es post-procesado interno, no estructura de la fuente.

## Extensión Fase 6: modelo de citas (`packages/citations`)

Deliberadamente **separado** de `NormalizedDocument` (igual criterio que `ArticleVersionComparison` en Fase 3): una cita reconocida en texto libre no es un documento, es una interpretación estructural de un fragmento de texto que aún no se ha resuelto contra ninguna fuente. Vive en `packages/citations/src/citationTypes.ts`.

- **`ParsedCitation`**: salida del parser (`raw`, `type`, y campos específicos por tipo — `systematicNumber`, `bgeReference`, `caseNumber`, `ecli`, `location`/`lawAbbreviation`). Nunca incluye un resultado de resolución.
- **`CitationType`**: `"systematic_number" | "bge_atf_dtf" | "case_number" | "ecli" | "unresolvable"`. Deliberadamente NO distingue `rs_federal` de `rs_cantonal` en el parseo — un número sistemático cantonal (SRSZ, RSN, etc.) comparte el mismo formato numérico punteado que un RS/SR federal; la jurisdicción real solo se conoce tras resolver, nunca se adivina por formato.
- **`CitationMatchStatus`**: `"exact" | "probable" | "ambiguous" | "not_found"` — ver `docs/provider-contracts/citation-resolution.md` para la semántica exacta de cada nivel. Nunca se colapsa a un booleano "encontrado/no encontrado".
- **`CitationResolution`**: resultado completo de resolver una `ParsedCitation` — `match`, `document` (un `NormalizedDocument` real, solo si `match` es `exact` o `probable` con un único candidato), `alternativeCandidates` (para `ambiguous`), `warnings`, `evidence` (`CitationEvidenceEntry[]`: proveedor consultado, URL, carácter oficial, nota).

Este modelo es intencionalmente ajeno a cualquier proveedor concreto (`packages/citations` no importa ningún paquete de `packages/providers/*`) — la resolución real se inyecta desde `apps/mcp-server` vía puertos genéricos (`CantonalCitationLookupPort`, `CaseLawCitationLookupPort`), manteniendo el modelo de citas reutilizable fuera de este servidor concreto si algún día hiciera falta.

## Campos explícitamente fuera de este modelo (por ahora)

- Vectores de embedding / índices de búsqueda: viven en `packages/search`, no en el documento normalizado en sí (evita acoplar el modelo de datos a una tecnología de búsqueda concreta).
- Anotaciones o comentarios del usuario: fuera de alcance de Fase 0-8; este es un modelo de documento de fuente, no de espacio de trabajo del usuario.
