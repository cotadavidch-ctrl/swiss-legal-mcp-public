# Arquitectura — swiss-legal-mcp

Estado: diseño de Fase 0/1. Ningún proveedor está implementado todavía; este documento describe la forma que tendrá el sistema, no su estado actual (ver [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md)).

## Objetivo

Servidor MCP que permite a Claude consultar, recuperar, comparar y verificar fuentes jurídicas suizas oficiales o públicamente accesibles, sin inventar nunca una sentencia, norma, cita, fecha, tribunal o enlace, y conservando siempre la fuente original.

## Principios de diseño derivados de la auditoría de fuentes

Estos principios no son aspiracionales: responden directamente a lo verificado en [source-audit.md](source-audit.md).

1. **Ningún proveedor se declara "implementado" sin una prueba de integración real** contra la fuente correspondiente (ver principio "No implementes herramientas simuladas").
2. **Cada proveedor conoce su propio nivel de confianza y carácter oficial.** Algunas fuentes (Fedlex, Zefix, bger.ch) son gubernamentales; otras (entscheidsuche.ch, LexFind, OpenCaseLaw) son agregadores no oficiales que sirven documentos oficiales. El modelo de datos y la respuesta al usuario deben distinguir esto siempre (`caracter_oficial`, ver [data-model.md](data-model.md)).
3. **No hay proveedor genérico "legislación cantonal".** La heterogeneidad de los 26 cantones (LexWork + ZH + SZ + SIL(GE/NE) + JU, 5 familias técnicas verificadas; TI/VD bloqueados) obliga a adaptadores independientes por familia técnica, activados incrementalmente.
4. **Cuando exista un servicio agregador con MCP ya operativo (p. ej. entscheidsuche.ch), se integra mediante un adaptador cliente MCP dedicado** (p. ej. `EntscheidsucheMcpProvider`) en lugar de construir un scraper propio o inventar una API REST para esa fuente. Estos agregadores actúan como proveedores primarios de _descubrimiento y recuperación_, nunca como sustituto de la fuente oficial cuando exista una URL del tribunal correspondiente, y su cobertura no se describe como garantizada ni exhaustiva.
5. **Ningún scraper se construye sin verificar antes robots.txt, términos de uso y licencia de la fuente concreta.**

## Monorepo

```
swiss-legal-mcp/
├── apps/
│   ├── mcp-server/        # Servidor MCP: stdio + Streamable HTTP
│   └── admin-cli/         # CLI de administración (health checks, cache, gestión de proveedores)
├── packages/
│   ├── core/              # Tipos compartidos, interfaz Provider, registro de herramientas, errores tipados
│   ├── providers/          # Un módulo por fuente (fedlex, bger, entscheidsuche, zefix, shab, seco, bsv, estv, cantonal/*)
│   ├── search/             # Normalización de queries, ranking, facetas
│   ├── citations/          # Parseo/normalización/resolución de citas legales y jurisprudenciales (Fase 6, implementado)
│   ├── documents/          # Modelo de documento normalizado, hashing de contenido, caché
│   └── shared/             # Validación Zod, logging estructurado, configuración de entorno
├── tests/                  # Unitarias, integración, contractuales (por proveedor)
├── docs/                   # Este documento, auditoría de fuentes, catálogo de herramientas, ADRs
└── scripts/                # Utilidades de desarrollo (seed de caché, verificación de salud, etc.)
```

Justificación: separar `providers` de `core` permite añadir un proveedor nuevo (p. ej. un cantón) sin tocar el servidor MCP ni las demás fuentes. `citations` y `search` son transversales porque operan sobre el modelo normalizado de `documents`, no sobre una fuente concreta.

## Interfaz común de proveedor

Cada proveedor en `packages/providers/*` implementa la misma interfaz (definida en `packages/core`):

```ts
interface LegalSourceProvider {
  search(query: SearchQuery): Promise<SearchResult[]>;
  getDocument(id: DocumentId): Promise<NormalizedDocument>;
  getMetadata(id: DocumentId): Promise<DocumentMetadata>;
  healthCheck(): Promise<HealthStatus>;
  normalize(raw: unknown): NormalizedDocument;
  getSourceAttribution(id: DocumentId): SourceAttribution;
}
```

Reglas:

- `search` y `getDocument` nunca devuelven datos sintéticos: si la fuente no responde, se propaga un error tipado (`ProviderUnavailableError`, `NotFoundError`, `RateLimitedError`), nunca un documento inventado.
- `normalize` es el único lugar donde datos crudos de la fuente (HTML, PDF, JSON, RDF) se convierten al modelo común. Debe ser puro y testeable con fixtures reales descargados de la fuente (marcados como fixtures, nunca presentados como datos en vivo).
- `getSourceAttribution` siempre devuelve URL de origen, fecha de recuperación y si la fuente es oficial o un agregador — es lo que alimenta el campo `caracter_oficial` del documento normalizado.
- `healthCheck` permite que `admin-cli` y el servidor reporten qué proveedores están operativos sin tener que ejecutar una búsqueda real.

## Interfaz de proveedor de legislación (Fase 3)

Los proveedores de legislación (Fedlex, y en el futuro adaptadores cantonales) implementan una interfaz distinta a `LegalSourceProvider` (pensada para jurisprudencia): `LegislationProvider` (`packages/core/src/legislationProvider.ts`), con `searchLegislation`, `getLaw`, `getArticle`, `getArticleAtDate`, `compareArticleVersions`, `getAmendmentHistory` y `healthCheck`. Se separó de `LegalSourceProvider` porque la resolución temporal de versiones y la comparación de artículos no encajan en el contrato genérico `getDocument(id)` (ver ADR 0014).

Cada proveedor de legislación declara una **matriz `ProviderCapabilities`** (booleanos: `fullTextSearch`, `searchByTitle`, `searchByAbbreviation`, `searchBySystematicNumber`, `searchByEli`, `getCurrentVersion`, `getHistoricalVersion`, `compareVersions`, `getArticle`, `getArticleAtDate`, `amendmentHistory`, `transitionalProvisions`, `entryIntoForce`, `repealInformation`, `multilingual`, `rdf`, `xml`, `akomaNtoso`, `html`, `pdf`) — ningún campo se marca `true` sin evidencia real verificada (ver `docs/provider-contracts/fedlex.md` para la matriz concreta de Fedlex).

Se registran en un `LegislationProviderRegistry` independiente de `ProviderRegistry`, y `ToolRegistry` acepta ambos registros (el segundo, opcional) para poder activar herramientas que dependan de un proveedor de cualquiera de los dos tipos.

## Registro de herramientas y activación por proveedor

Las herramientas MCP (ver [tool-catalog.md](tool-catalog.md)) están declaradas en `packages/core` como contratos (esquema Zod de entrada/salida) independientemente de si tienen un proveedor funcional detrás. El registro central en `apps/mcp-server` solo **activa** una herramienta cuando:

1. Existe al menos un proveedor que la implementa.
2. Ese proveedor ha pasado su prueba de integración contra la fuente real (no solo tipos/mocks).

Una herramienta sin proveedor funcional aparece en el catálogo como `pendiente` y el servidor MCP la rechaza explícitamente en vez de simular una respuesta.

Una herramienta cuyo proveedor requerido no está `healthy` queda `blocked`; por defecto, `apps/mcp-server` no la registra en el SDK MCP y por tanto no aparece en `tools/list` (no tiene sentido ofrecer a un cliente una herramienta que probablemente fallará y podría recuperarse sola). Existe una única excepción explícita y general, no atada al nombre de ninguna herramienta: cuando `HealthStatus.unavailableByPolicy` está presente (el proveedor está bloqueado por una decisión de cumplimiento permanente, p. ej. `robots.txt: Disallow: /`, no por una caída transitoria de red), `ToolRegistry` propaga esa señal como `ToolInfo.blockedByPolicy` y `apps/mcp-server` **sí** registra la herramienta pese a no estar `active`: queda visible en `tools/list`, pero `tools/call` lanza `ProviderUnavailableByPolicyError` (`code: PROVIDER_UNAVAILABLE_BY_POLICY`, `retryable: false`, `details: { reason, networkRequestPerformed: false }`) antes de invocar el handler de la herramienta — nunca se realiza la petición de red subyacente. El único proveedor que usa este mecanismo actualmente es `ShabProvider` (`reason: "robots_txt_disallow"`, ver `docs/providers/shab.md`), pero el mecanismo en sí es genérico y reutilizable por cualquier proveedor futuro con el mismo tipo de bloqueo permanente.

Desde Fase 5B, `ToolDefinition` admite además `requireAnyProviderIds` (opcional): en vez de exigir que **todos** los proveedores listados estén `healthy` (semántica AND de `requiredProviderIds`), exige que **al menos uno** lo esté (semántica OR). Se usa cuando una herramienta puede resolver su proveedor concreto en tiempo de ejecución a partir del propio input (ej. `search_cantonal_legislation` recibe `canton` y despacha al proveedor `cantonal-{codigo}` correspondiente entre 24 posibles tras el cierre de cobertura cantonal) — la herramienta debe activarse en cuanto exista al menos un proveedor disponible, no solo cuando los 24 lo estén. Ambos campos son combinables (AND entre sí); el campo es retrocompatible (los tools que no lo usan no cambian de comportamiento).

Desde Fase 8, `ToolDefinition` admite `strictInput` (opcional): cuando una herramienta lo activa, el servidor entrega al SDK MCP un objeto Zod `.strict()` y el `ToolRegistry` interno aplica la misma regla. Esto se usa en `analyze_procedural_strategy` para rechazar claves top-level desconocidas y mantener el expediente procesal en un formato estable. Las herramientas existentes mantienen la validación previa.

Desde Fase 12, el servidor incorpora una capa local de analisis juridico contradictorio multirrol. `analyze_swiss_legal_positions` y `validate_multirole_legal_analysis` no registran proveedores nuevos: consumen datos estructurados ya suministrados o producidos por las herramientas de estrategia/redaccion y aplican guardrails deterministas. La arquitectura separa `party_argument`, `authority_argument`, `court_finding`, `neutral_assessment` y `predicted_outcome`; una posicion de parte nunca se promueve automaticamente a conclusion judicial o neutral. La salida puede alimentar informes de control mediante `include_in_drafting_control_report`, pero el transporte MCP no inserta deliberaciones, argumentos de contraparte ni predicciones dentro del escrito limpio.

El resolvedor oficial de jurisprudencia suiza anade otra capa local de orquestacion con cuatro
herramientas MCP: `resolve_official_swiss_case`, `fetch_official_swiss_case_full_text`,
`verify_swiss_case_identity` y `compare_swiss_case_sources`. Su nucleo usa adaptadores separados
para Tribunal Federal, Tribunal Administrativo Federal, Tribunal Penal Federal, portales cantonales
genericos, URL directa y fallback no oficial. Esta capa no declara un agregador como oficial:
`entscheidsuche.ch` puede ayudar a descubrir candidatos, pero nunca produce
`full_text_verified_official`. La salida uniforme alimenta guardrails de citas, estrategia,
redaccion y multirrol mediante estados de identidad, integridad, lectura, ratio y elegibilidad.

## Transporte dual

`apps/mcp-server` expone el mismo registro de herramientas por dos transportes, usando el SDK oficial de Model Context Protocol:

- **stdio** — uso local con Claude Code. Sin autenticación adicional (el proceso ya corre en la máquina del usuario).
- **Streamable HTTP** — uso remoto. Requiere autenticación por token (Bearer) validada antes de aceptar cualquier llamada a herramienta. El token se gestiona vía variable de entorno validada (Zod), nunca hardcodeado.

Ambos transportes comparten el mismo core de negocio; la diferencia está solo en la capa de transporte y en la autenticación.

## Persistencia y caché

- **PostgreSQL** almacena: caché de documentos normalizados (con hash de contenido para invalidación), metadatos de trazabilidad (fecha de recuperación, proveedor, fuente), y registro de auditoría de consultas (sin datos sensibles del usuario).
- La caché respeta la licencia de cada fuente: para fuentes con licencia restrictiva confirmada (p. ej. SECO/AVIG-Praxis, ver auditoría), se cachean metadatos y enlaces, no el texto completo, salvo que se confirme que el cacheo está permitido.
- Todo registro de caché incluye: proveedor, timestamp de recuperación, hash de contenido, y si el dato es texto literal, resumen o inferencia (ver [data-model.md](data-model.md)).

## Errores tipados

`packages/core` define una jerarquía de errores (no excepciones genéricas):

- `ProviderUnavailableError` — la fuente no responde o cambió su estructura.
- `NotFoundError` — el documento/artículo/sentencia solicitado no existe en la fuente.
- `RateLimitedError` — se alcanzó el límite de frecuencia de la fuente.
- `UnofficialSourceWarning` — no es un error bloqueante, pero se adjunta a cualquier resultado que provenga de un agregador no oficial (entscheidsuche.ch, LexFind, OpenCaseLaw).
- `AmbiguousCitationError` — una cita no pudo resolverse de forma unívoca (útil para `verify_legal_citation` y `verify_case_quote`).

## Validación de entrada

Todo parámetro de entrada de toda herramienta MCP se valida con **Zod** en el límite del registro de herramientas, antes de llegar a ningún proveedor. Esto incluye fechas (formato y rango razonable), idiomas (enum cerrado DE/FR/IT/RM/EN), y identificadores (formato esperado de BGE/ATF/DTF, SR/RS, UID, etc.).

## Pruebas

Tres niveles, obligatorios antes de declarar un proveedor "implementado" (ver reglas de `IMPLEMENTATION_STATUS.md`):

- **Unitarias** — lógica de `normalize`, validadores Zod, utilidades de `citations`.
- **Integración** — llamada real (o contra fixture grabado con VCR/cassette) a la fuente, verificando que `search`/`getDocument` devuelven el modelo normalizado esperado.
- **Contractuales** — verifican que cada proveedor cumple realmente la interfaz `LegalSourceProvider` y que el esquema Zod de cada herramienta MCP coincide con lo que el proveedor puede entregar.

## CI/CD y calidad

- GitHub Actions: lint (ESLint), format check (Prettier), type-check (`tsc --noEmit`), tests (Vitest) en cada PR.
- Docker Compose: PostgreSQL + `apps/mcp-server` (HTTP) para desarrollo local y para pruebas de integración reproducibles.
- Variables de entorno validadas con Zod al arrancar el proceso (falla rápido si falta una variable requerida, nunca usa un valor por defecto inventado para credenciales).
- Logs estructurados (JSON) sin datos sensibles: no se registran tokens, credenciales de Zefix, ni contenido completo de documentos con licencia restrictiva.

## Variables de entorno

Este repositorio no versiona ningún archivo de configuración local con secretos (ver `.gitignore`). Todas las variables se aportan vía el entorno del proceso (export manual, gestor de entorno local, o secretos de CI/CD). `packages/shared` valida el proceso completo con Zod al arrancar; si falta una variable requerida, el proceso falla de inmediato con un mensaje explícito, nunca usa un valor por defecto inventado.

| Variable                        | Requerida                | Descripción                                                                                                                 |
| ------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                      | sí                       | `development` \| `test` \| `production` — controla si el bearer token es obligatorio y si `FixtureProvider` está habilitado |
| `MCP_HTTP_PORT`                 | no (default `3000`)      | Puerto del transporte Streamable HTTP                                                                                       |
| `MCP_HTTP_HOST`                 | no (default `0.0.0.0`)   | Host de escucha                                                                                                             |
| `MCP_HTTP_BEARER_TOKEN`         | sí si `NODE_ENV != test` | Token bearer exigido en `POST /mcp`                                                                                         |
| `MCP_HTTP_MAX_REQUEST_BYTES`    | no (default `1048576`)   | Límite de tamaño de petición                                                                                                |
| `MCP_HTTP_REQUEST_TIMEOUT_MS`   | no (default `30000`)     | Timeout por petición                                                                                                        |
| `MCP_HTTP_MAX_CONCURRENCY`      | no (default `20`)        | Peticiones concurrentes máximas                                                                                             |
| `MCP_HTTP_RATE_LIMIT_WINDOW_MS` | no (default `60000`)     | Ventana de rate limit                                                                                                       |
| `MCP_HTTP_RATE_LIMIT_MAX`       | no (default `120`)       | Peticiones máximas por ventana y IP                                                                                         |
| `LOG_LEVEL`                     | no (default `info`)      | Nivel de logging estructurado                                                                                               |

### Variables de `packages/providers/entscheidsuche` (Fase 2)

Todas opcionales, con defaults razonables (el servidor remoto es público y no requiere credenciales):

| Variable                                                                                    | Default                                                           | Descripción                                                     |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| `ENTSCHEIDSUCHE_MCP_URL`                                                                    | `https://mcp.entscheidsuche.ch/mcp`                               | Endpoint del servidor MCP remoto                                |
| `ENTSCHEIDSUCHE_TIMEOUT_MS`                                                                 | `10000`                                                           | Timeout por llamada a herramienta remota                        |
| `ENTSCHEIDSUCHE_MAX_RETRIES`                                                                | `3`                                                               | Reintentos máximos para errores transitorios                    |
| `ENTSCHEIDSUCHE_RETRY_BASE_DELAY_MS` / `_MAX_DELAY_MS`                                      | `200` / `5000`                                                    | Backoff exponencial con jitter completo                         |
| `ENTSCHEIDSUCHE_CIRCUIT_BREAKER_FAILURE_THRESHOLD`                                          | `5`                                                               | Fallos consecutivos antes de abrir el circuito                  |
| `ENTSCHEIDSUCHE_CIRCUIT_BREAKER_RESET_MS`                                                   | `30000`                                                           | Tiempo antes de pasar a semiabierto                             |
| `ENTSCHEIDSUCHE_CACHE_TTL_SERVER_INFO_MS` / `_HIERARCHY_MS` / `_FACETS_MS` / `_DOCUMENT_MS` | `3600000` / `3600000` / `3600000` / `900000`                      | TTL de caché en memoria por tipo de dato (nunca cachea errores) |
| `ENTSCHEIDSUCHE_MAX_RESPONSE_BYTES`                                                         | `5000000`                                                         | Límite de tamaño de respuesta remota                            |
| `ENTSCHEIDSUCHE_ALLOWED_OFFICIAL_DOMAINS`                                                   | `bger.ch,admin.ch,gerichte-zh.ch,justice.ge.ch,vd.ch,ti.ch,be.ch` | Allowlist de `OfficialSourceResolver` (protección SSRF)         |

### Variables de `packages/providers/fedlex` (Fase 3)

Todas opcionales, con defaults razonables (el endpoint SPARQL es público y no requiere credenciales):

| Variable                                           | Default                                       | Descripción                                                                        |
| -------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| `FEDLEX_SPARQL_ENDPOINT`                           | `https://fedlex.data.admin.ch/sparqlendpoint` | Endpoint SPARQL público                                                            |
| `FEDLEX_TIMEOUT_MS`                                | `20000`                                       | Timeout por consulta SPARQL o descarga de manifestación                            |
| `FEDLEX_MAX_RETRIES`                               | `3`                                           | Reintentos máximos para errores transitorios                                       |
| `FEDLEX_RETRY_BASE_DELAY_MS` / `_MAX_DELAY_MS`     | `200` / `5000`                                | Backoff exponencial con jitter completo                                            |
| `FEDLEX_CIRCUIT_BREAKER_FAILURE_THRESHOLD`         | `5`                                           | Fallos consecutivos antes de abrir el circuito                                     |
| `FEDLEX_CIRCUIT_BREAKER_RESET_MS`                  | `30000`                                       | Tiempo antes de pasar a semiabierto                                                |
| `FEDLEX_CACHE_TTL_SPARQL_MS` / `_MANIFESTATION_MS` | `900000` / `3600000`                          | TTL de caché en memoria (nunca cachea errores)                                     |
| `FEDLEX_MAX_RESPONSE_BYTES`                        | `10000000`                                    | Límite de tamaño de respuesta SPARQL/manifestación                                 |
| `FEDLEX_MAX_XML_BYTES`                             | `20000000`                                    | Límite de tamaño previo a parsear un documento Akoma Ntoso                         |
| `FEDLEX_ALLOWED_OFFICIAL_DOMAINS`                  | `fedlex.admin.ch,fedlex.data.admin.ch`        | Allowlist estricta (rechaza explícitamente el subdominio `intranet`, ver ADR 0010) |

### Variables de `packages/providers/{seco,bsv,estv}` (Fase 4)

Todas opcionales, con defaults razonables (las tres fuentes son HTML público sin autenticación). Prefijos `SECO_`/`BSV_`/`ESTV_` respectivamente; solo se listan las que no siguen el patrón común de timeout/reintentos/circuit breaker/caché (idéntico al de `entscheidsuche`/`fedlex`, ver `packages/shared-web/src/secureHttpClient.ts`):

| Variable                                                                            | Default                                                                                                         | Descripción                                                                                       |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `SECO_LISTING_URL_DE` / `_FR`                                                       | `https://www.arbeit.swiss/de/informationszentrum/publikationen` / `.../fr/centre-dinformation/publications-fr`  | Slugs reales verificados en vivo (distintos por idioma, no un simple prefijo `/fr/`)              |
| `SECO_ALLOWED_OFFICIAL_DOMAINS`                                                     | `www.arbeit.swiss,backend.arbeit.swiss`                                                                         | Dominio alemán y francés de descarga de PDF, verificados como distintos en vivo                   |
| `BSV_BASE_URL`                                                                      | `https://sozialversicherungen.admin.ch`                                                                         | Portal DNN/2sxc dedicado a circulares (no `www.bsv.admin.ch`)                                     |
| `BSV_FOLDER_IDS`                                                                    | `5661`                                                                                                          | Carpetas (ramas de seguro social) a indexar; solo IV auditada en profundidad en Fase 4            |
| `BSV_ALLOWED_OFFICIAL_DOMAINS`                                                      | `sozialversicherungen.admin.ch,www.bsv.admin.ch`                                                                | Allowlist SSRF                                                                                    |
| `ESTV_LISTING_URL_DIREKTE_BUNDESSTEUER` / `_STEMPELABGABEN` / `_VERRECHNUNGSSTEUER` | `https://www.estv.admin.ch/de/kreisschreiben-direkten-bundessteuer` / `-stempelabgaben` / `-verrechnungssteuer` | Las tres páginas del portal clásico; el sistema JSF de MWST-Infos NO está cubierto (ver ADR 0017) |
| `ESTV_ALLOWED_OFFICIAL_DOMAINS`                                                     | `www.estv.admin.ch`                                                                                             | Allowlist SSRF                                                                                    |
| `{SECO,BSV,ESTV}_MAX_RESPONSE_BYTES`                                                | `20000000`                                                                                                      | Límite único compartido por `SecureHttpClient` para listado HTML y descarga de PDF                |
| `{SECO,BSV,ESTV}_CACHE_MAX_ENTRIES`                                                 | `500`                                                                                                           | Límite de `TtlCache` (LRU, ver ADR de Fase 3-4 sobre caché acotada)                               |

### Variables de `packages/providers/cantonal` (Fase 5 + cierre de cobertura cantonal)

`packages/providers/shab` no tiene variables de entorno: el proveedor nunca realiza peticiones de red (ver ADR 0021).

| Variable                                                                                        | Default                                                           | Descripción                                                                                                                                        |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CANTONAL_{CODIGO}_BASE_URL`                                                                    | uno real por canton, ver `LEXWORK_CANTONS` en `lexWorkCantons.ts` | Sobreescribe el `baseUrl` verificado en vivo de cualquiera de los 19 cantones LexWork (ej. `CANTONAL_BE_BASE_URL`)                                 |
| `CANTONAL_{CODIGO}_ALLOWED_OFFICIAL_DOMAINS`                                                    | idem                                                              | Sobreescribe el allowlist SSRF de un canton concreto                                                                                               |
| `CANTONAL_ZH_BASE_URL`                                                                          | `https://www.zh.ch`                                               | Portal real de ZH-Lex                                                                                                                              |
| `CANTONAL_ZH_ALLOWED_OFFICIAL_DOMAINS`                                                          | `zh.ch`                                                           | Allowlist SSRF                                                                                                                                     |
| `CANTONAL_SZ_BASE_URL` / `CANTONAL_SZ_COLLECTION_PATH` / `CANTONAL_SZ_ALLOWED_OFFICIAL_DOMAINS` | `https://www.sz.ch` / ruta real de la colección / `sz.ch`         | Portal real de la colección sistemática de Schwyz                                                                                                  |
| `CANTONAL_GE_BASE_URL` / `CANTONAL_GE_BOOK_PATH`                                                | `https://silgeneve.ch` / `legis/program/books/RSG`                | Portal real SIL de Ginebra (mismo adaptador `CantonalSilProvider` que NE)                                                                          |
| `CANTONAL_NE_BASE_URL` / `CANTONAL_NE_BOOK_PATH`                                                | `https://rsn.ne.ch` / `DATA/program/books/rsne`                   | Portal real SIL de Neuchâtel (mismo adaptador `CantonalSilProvider` que GE)                                                                        |
| `CANTONAL_JU_BASE_URL` / `CANTONAL_JU_ALLOWED_OFFICIAL_DOMAINS`                                 | `https://rsju.jura.ch` / `rsju.jura.ch`                           | Portal real de Jura                                                                                                                                |
| `TIMEOUT_MS`/`MAX_RETRIES`/`RETRY_*`/`CIRCUIT_BREAKER_*`/`CACHE_*`/`MAX_RESPONSE_BYTES`         | mismos defaults que Fase 4                                        | Compartidos por los 24 proveedores cantonales (19 LexWork + ZH + SZ + GE + NE + JU), sin prefijo (ver `packages/providers/cantonal/src/config.ts`) |

## Decisiones ya tomadas

- **Fase 1:** decisiones de infraestructura (transporte, TypeScript, activación de herramientas) — ver ADRs 0001-0006.
- **Fase 2:** `entscheidsuche.ch` se integró como `EntscheidsucheMcpProvider` (`packages/providers/entscheidsuche`), un adaptador cliente MCP real contra `https://mcp.entscheidsuche.ch/mcp` usando el `Client` del SDK oficial + `StreamableHTTPClientTransport`, con timeout/reintentos/circuit breaker/caché propios (ver ADR 0007) y `OfficialSourceResolver` para distinguir URL oficial de URL de agregador sin descargar contenido (ver ADR 0008). Se activaron 4 herramientas MCP: `search_cases`, `get_case`, `get_case_metadata`, `search_cases_by_reference`.
- **Fase 3:** Fedlex se integró como `FedlexProvider` (`packages/providers/fedlex`), un cliente SPARQL 1.1 real (no MCP, no REST) contra `https://fedlex.data.admin.ch/sparqlendpoint`, reutilizando `TtlCache`/`CircuitBreaker` de `packages/shared` (extraídos de entscheidsuche a `packages/shared` en esta misma fase). Se adoptó el modelo FRBR/JOLux real de Fedlex sin reinterpretarlo (ADR 0009), con `FedlexSourceResolver` bloqueando explícitamente el dominio interno `intranet.fedlex.admin.ch` descubierto en la auditoría (ADR 0010), resolución temporal determinista de versiones (ADR 0011), extracción de artículo solo sobre Akoma Ntoso real con fallo explícito fuera del rango con XML — sin adaptador HTML histórico en esta fase (ADR 0012) —, el modelo `ArticleVersionComparison` separado de `NormalizedDocument` (ADR 0013), y la matriz `ProviderCapabilities` + `LegislationProviderRegistry` (ADR 0014). Se activaron 6 herramientas MCP: `search_legislation`, `get_law`, `get_article`, `get_article_at_date`, `compare_article_versions`, `get_amendment_history`.
- **Fase 4:** SECO, BSV/OFAS y ESTV/AFC se integraron como `SecoProvider`/`BsvProvider`/`EstvProvider` (`packages/providers/{seco,bsv,estv}`), los tres implementando `LegalSourceProvider` (misma interfaz que `entscheidsuche`, registrados en el mismo `ProviderRegistry` pero con `officialCharacter: 'official'`) y parseando HTML real (nunca una API inventada). Se extrajo un nuevo paquete `packages/shared-web` (ADR 0015) con los componentes HTTP/HTML/PDF antes duplicados por proveedor: `SecureHttpClient` (SSRF + timeout + reintentos + circuit breaker + redirecciones controladas + límite de tamaño + hash sha256, ADR 0016), `parseHtml`/`extractPdfText` (parsing/extracción compartidos, ADR 0017) y `buildAdministrativeCircularDocument` (normalización compartida a `documentType: administrative_circular`, ADR 0018 sobre el modelo mismo). Las relaciones de versión/sustitución de BSV (única fuente con historial real) siguen el criterio de nunca inferir sustitución entre documentos distintos por título o proximidad (ADR 0019). Se activaron 4 herramientas MCP: `search_seco_documents`, `search_bsv_documents`, `search_estv_documents`, `get_official_document` (compartida por `provider`).
- **Fase 5A:** SHAB/FOSC/FUSC y una muestra de legislación cantonal (Berna/LexWork, Zúrich/ZH-Lex). `ShabProvider` (`packages/providers/shab`) está implementado pero permanentemente `unhealthy`: `shab.ch`/`amtsblattportal.ch` declaran `robots.txt: Disallow: /` para todo user-agent y no ofrecen una API pensada para reutilización por terceros (ADR 0021) — sus dos herramientas quedan siempre en estado `blocked`, pero registradas y visibles en `tools/list` (`blockedByPolicy`, ver la sección "Registro de herramientas y activación por proveedor" más arriba); `tools/call` devuelve `PROVIDER_UNAVAILABLE_BY_POLICY` (`reason: robots_txt_disallow`, `retryable: false`, sin petición de red) en vez de simular disponibilidad. Se añadió el bloque `shabPublication` a `NormalizedDocument` (`documentType: shab_entry`, ADR 0020), probado contra datos reales capturados aunque el proveedor nunca los produzca en producción. `CantonalLexWorkProvider`/`CantonalZhProvider` (`packages/providers/cantonal`) cubren dos familias técnicas cantonales verificadas en vivo sobre una muestra representativa (ADR 0022); ambos reutilizan `documentType: "official_publication"` en vez de extender el bloque `legislation` de Fedlex, para no debilitar la exigencia real de `eli` en actos federales por una fuente cantonal sin ELI (ADR 0023).
- **Fase 5B (cierre):** se auditaron en vivo los 21 cantones restantes y se confirmó que 19 de los 26 comparten la plataforma LexWork con un contrato de API idéntico — `CantonalLexWorkProvider` se generalizó a los 19 vía un descriptor de datos (`LEXWORK_CANTONS`), sin duplicar código. Se descubrió (por inspección de red durante la propia auditoría de cierre) el endpoint real de detalle de LexWork, que expone texto completo de la versión vigente **y** un árbol de contenido recursivo con granularidad real de artículo — se activó `get_cantonal_article` para los 19 cantones. Se descubrió también el servlet JSON real de búsqueda de ZH-Lex, activando `search_cantonal_legislation` para Zúrich. Se verificó en vivo que `entscheidsuche.ch` ya cubre jurisprudencia real de los 26 cantones, satisfaciendo el requisito de jurisprudencia sin adaptadores dedicados. Se extendió `ToolRegistry` (`packages/core`) con `requireAnyProviderIds` ("al menos uno de N healthy", retrocompatible) para que las herramientas cantonales se activen con cualquiera de los 20 proveedores posibles. Las herramientas cantonales son ahora canton-aware: requieren `canton` y cada respuesta incluye familia/capacidades/limitaciones/fuente oficial específicas — nunca declaran soporte universal. 6 cantones (SZ, NE, JU, TI, VD, GE) quedan documentados como no disponibles/bloqueados con evidencia real, no como "pendiente" genérico. Ver ADR 0024 y `docs/providers/cantonal-legislation.md` para la matriz completa de los 26 cantones.
- **Cierre de cobertura cantonal (2026-07-25/27):** se auditaron en vivo los 6 cantones restantes de Fase 5B. Descubrimiento no anticipado: Ginebra y Neuchâtel comparten en vivo la misma plataforma comercial "SIL" (ARCHILEXMP sa) — un único `CantonalSilProvider` parametrizado los cubre a ambos, con un bug de codificación real corregido explícitamente (`decodeSilHtml`, charset windows-1252 declarado solo en el HTML, no en la cabecera HTTP). Se implementaron además `CantonalSzProvider` (Schwyz, colección HTML + PDF real) y `CantonalJuProvider` (Jura, ASP.NET propio, solo recuperación de documento ya conocido — sin búsqueda real verificada). Ticino y Vaud fueron re-auditados para determinar la causa precisa del bloqueo (F5 BIG-IP WAF real en TI; muro de acceso de aplicación real en VD) y quedan documentados como legítimamente inaccesibles, con una prueba de regresión real que confirma el bloqueo en cada ejecución (`RUN_LIVE_TI_TESTS`/`RUN_LIVE_VD_TESTS`) — sin ningún intento de evasión. El envelope de las 3 herramientas cantonales se amplió con `technicalFamily` (renombrado desde `family`), `language`, `documentIdentifier`, `canonicalOfficialUrl`, `contentFormat`, `contentHash`. **Resultado: 24/26 cantones con legislación implementada; 26/26 no fue alcanzable** con acceso público, legítimo y reproducible. Ver ADR 0025 y `docs/providers/cantonal-legislation.md`.
- **Fase 6 (funciones jurídicas avanzadas, 2026-07-28):** con la cobertura cantonal cerrada, se creó el paquete reutilizable `packages/citations` (parser/normalizer/resolver de citas suizas, desacoplado de cualquier proveedor concreto vía puertos genéricos) y se activaron 7 de las 8 herramientas priorizadas: `verify_legal_citation`, `identify_applicable_version`, `search_across_sources`, `extract_legal_passages`, `compare_legal_documents`, `find_cited_sources`, `build_case_citation_network`. Ninguna añade una fuente nueva. Se revisó primero qué identificadores tienen respaldo real de datos (RS/ELI/versión: rico solo en Fedlex; BGE/ATF/DTF: real vía autoidentificación + `search_by_case_number`; ECLI y `articlesCited`/`decisionsCited`: nunca poblados por ningún proveedor) y esa revisión determinó directamente qué se activó. `get_transitional_provisions` **no se activó**: ningún proveedor modela disposiciones transitorias como estructura real (`Fedlex.capabilities.transitionalProvisions: false`) y la deducción heurística por contenido fue explícitamente prohibida por el usuario. Sin embeddings ni base de datos vectorial (política documentada, no solo omisión). Ver ADR 0026, `docs/providers/advanced-legal-functions.md` y `docs/provider-contracts/citation-resolution.md`.
- **Fase 8 (estrategia procesal, 2026-08-03):** se añadió `analyze_procedural_strategy` como herramienta MCP determinista para expedientes procesales estructurados. Reutiliza proveedores existentes y `packages/citations`, no añade fuentes ni calcula reglas no modeladas. Su salida separa competencia, admisibilidad, plazos, prueba, jurisprudencia comparable, escenarios, riesgos, fuentes, trazas y confianza. Ver ADR 0027 y `docs/procedural-strategy/`.
- **Fase 11 (redaccion juridica, 2026-08-03):** se añadió una capa deterministica de redaccion, revision y refutacion juridica suiza con ocho herramientas MCP (`draft_swiss_legal_document`, `review_swiss_legal_document`, `validate_procedural_requirements`, `generate_rechtsbegehren`, `build_evidence_index`, `extract_challenged_passages`, `build_rebuttal_matrix`, `validate_swiss_legal_draft`). No añade proveedores, no usa IA, no inventa plazos/autoridades/citas y separa siempre documento limpio de informe de control con `human_legal_review_required`. Ver `docs/legal-drafting.md`.
- **Politica de lectura completa de sentencias:** `jurisprudenceGuardrails.ts` centraliza la compuerta de full text. Una sentencia parcial, snippet o headnote solo puede ser `candidate_only`/`unverified_reference`; no puede convertirse en `comparable_direct`, `limited_analogy` ni `general_analogy`, ni pasar a un escrito limpio como autoridad decisiva. Ver `docs/case-full-text-policy.md`.

## Decisiones pendientes (a registrar como ADR cuando se decidan)

- Zefix: si se solicita acceso a su API (credenciales por email a `zefix@bj.admin.ch`) y en qué fase se implementa — explícitamente fuera de alcance hasta ahora.
- Ticino y Vaud quedan documentados como legítimamente bloqueados (F5 WAF real / muro de acceso real); no se reintentará salvo que aparezca una alternativa oficial no-agregador.
- Si se justifica investigar el mecanismo real de recuperación de texto completo de versiones antiguas/futuras de una ley LexWork (solo la versión vigente está cubierta).
- Si en el futuro se puebla `articlesCited`/`decisionsCited` con datos reales en algún proveedor, o se demuestra necesidad funcional real de búsqueda semántica (ver política en ADR 0026) — ninguna de las dos está planificada hoy.
- Propuesta de Fase 7 (hardening, auditoría final, release 1.0): no iniciada, ver `IMPLEMENTATION_STATUS.md`.

# Secure Updater Boundary

The secure updater lives outside the MCP server in `packages/updater` and the administrative CLI.
MCP legal tools cannot install updates. The updater accepts only signed, versioned manifests and
data-only artifacts; it rejects remote scripts, arbitrary shell commands, path traversal and
unconfirmed install or rollback operations.

Claude Desktop production acceptance is treated as a release-gate input, not as a unit-test proxy.
