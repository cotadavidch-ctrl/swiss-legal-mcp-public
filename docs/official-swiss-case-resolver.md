# Resolvedor oficial de jurisprudencia suiza

Estado: implementado localmente con cinco herramientas MCP:

- `resolve_official_swiss_case`
- `fetch_official_swiss_case_full_text`
- `verify_swiss_case_identity`
- `compare_swiss_case_sources`
- `validate_swiss_case_ground_coverage`

El resolvedor es una capa de orquestacion y guardrails. No sustituye la fuente oficial por un
agregador y no rebaja la politica estricta de lectura completa.

## Arquitectura

El nucleo normaliza la referencia, invoca adaptadores, rankea candidatos, verifica identidad,
recupera texto, evalua integridad, compara fuentes y entrega estados uniformes de uso juridico.

Adaptadores iniciales:

- Swiss Federal Supreme Court.
- Federal Administrative Court.
- Federal Criminal Court.
- Generic cantonal official portal.
- Direct URL resolver.
- `entscheidsuche.ch` fallback no oficial.

La interfaz de adaptador separa `canHandle`, construccion de busquedas, parseo de resultados,
ranking, metadata, texto completo, identidad, completitud, cita canonica, fecha, tribunal, sala,
partes anonimizadas, dispositivo, secciones, version de fuente y restricciones. Los cantones nuevos
deben anadirse como adaptadores propios sin modificar el nucleo.

## Fuentes

Jerarquia:

1. Fuentes oficiales federales: Tribunal Federal, Tribunal Administrativo Federal, Tribunal Penal
   Federal y portales oficiales federales de jurisprudencia.
2. Fuentes oficiales cantonales: portales y repositorios oficiales cantonales.
3. Fuentes secundarias: agregadores publicos como `entscheidsuche.ch`, solo como fallback permitido.

Una fuente secundaria puede producir como maximo `full_text_read_unofficial`, `candidate_only` o
`unverified_reference`. Nunca produce `full_text_verified_official`.

## Identidad

`verify_swiss_case_identity` compara referencia normalizada, tribunal, sala, fecha, expediente,
tipo de publicacion, idioma, encabezado, URL canonica, hash, metadatos y referencias internas cuando
estan disponibles.

Estados:

- `identity_verified`
- `identity_probable`
- `identity_ambiguous`
- `identity_mismatch`
- `identity_not_verifiable`

Una coincidencia de numero por si sola no basta. Las referencias cantonales ambiguas requieren
canton, tribunal u otros datos.

## Integridad

La lectura completa exige encabezado, hechos, historia procesal, alegaciones, razonamiento de la
instancia inferior si existe, considerandos, ultimo considerando, dispositivo y costas. Las opiniones
separadas y fundamentos autonomos se registran y deben quedar leidos para confirmar ratio.
`validate_swiss_case_ground_coverage` trabaja solo sobre documentos oficiales ya persistidos y no
hace peticiones de red; bloquea usos juridicos si un fundamento autonomo verificado se omite.

Estados de lectura e integridad relevantes:

- `full_text_verified_official`
- `full_text_read_unofficial`
- `partial_text_only`
- `headnote_only`
- `extraction_incomplete`
- `complete`
- `missing_dispositive`
- `missing_facts`
- `missing_final_reasoning`
- `truncated`
- `ocr_defective`

## Cache

La cache auditable guarda referencia normalizada, URL de fuente, URL canonica, hash documental, hash
de metadatos, fechas de recuperacion/verificacion/lectura, version de fuente, version de extractor,
estado de identidad, estado de completitud y motivo de invalidacion.

Estados:

- `cache_miss`
- `cache_hit_valid`
- `cache_hit_stale`
- `cache_invalidated`

Un hash documental o de metadatos distinto invalida lectura, identidad, ratio y elegibilidad
juridica previa.

La ruta del almacén persistente no depende del directorio de trabajo del proceso. El resolvedor usa,
en orden, `SWISS_LEGAL_CACHE_DIR`, la cache de usuario del sistema operativo y finalmente
`os.tmpdir()/swiss-legal-mcp-cache`. En macOS el fallback esperado es
`~/Library/Caches/swiss-legal-mcp`.

Ejemplo opcional para Claude Desktop:

```json
{
  "env": {
    "NODE_ENV": "production",
    "SWISS_LEGAL_CACHE_DIR": "/Users/<username>/Library/Caches/swiss-legal-mcp"
  }
}
```

Los modos `clean` y `professional` no muestran la ruta completa de la cache. El diagnostico tecnico
incluye solo una ruta redactada y los campos `cache_directory_source`, `cache_directory_writable`,
`cache_store_initialized`, `cache_store_schema_version` y `cwd_independent`.

## Seguridad

El resolvedor aplica allowlist de dominios, bloqueo de credenciales embebidas, bloqueo de localhost,
loopback y rangos privados, rechazo de esquemas no HTTPS, limites de tamano, validacion MIME,
rechazo de contenido ejecutable, deteccion de login/rate-limit/challenge pages y sin JavaScript
remoto, cookies persistentes ni bypass de acceso.

En produccion no se acepta texto generado, fixture ni transporte mock como prueba de acceso
oficial. `fetch_success`, `identity_verified`, `full_text_verified_official` y `ratio_confirmed`
requieren una respuesta HTTP real con URL solicitada, URL final, codigo HTTP, cadena de redirects,
headers minimos, MIME, bytes recibidos, hash SHA-256 de los bytes descargados, `retrieved_at` real,
`network_transport: live_http` y `mock_or_fixture: false`.

El adaptador del Tribunal Federal usa el endpoint publico Eurospider:

`https://search.bger.ch/ext/eurospider/live/de/php/aza/http/index.php`

Primero busca con `type=search&query_words=<reference>`, selecciona un enlace exacto
`type=show_document` cuyo document id contenga la referencia solicitada y descarga ese documento.
URLs como `https://www.bger.ch/case/...` se rechazan como ficticias.

El adaptador del Tribunal Administrativo Federal usa la base oficial Weblaw enlazada por BVGer
(`https://bvger.weblaw.ch`) y consulta
`https://bvger.weblaw.ch/api/.netlify/functions/searchQueryService` con POST JSON. Selecciona solo
un resultado exacto por referencia antes de descargar el PDF oficial.

El adaptador del Tribunal Penal Federal usa la base oficial enlazada por `bstger.ch`
(`https://bstger.weblaw.ch`). La busqueda se ejecuta con POST JSON contra
`https://bstger.weblaw.ch/api/getDocuments?withAggregations=true` y la descarga del documento contra
`/api/getDocumentFile/{leid}?locale={language}&userID=`. El adaptador no usa agregadores para
promover una sentencia penal federal a oficial y trata resultados duplicados exactos como ambiguos.
Validacion live realizada el 2026-08-04:

- `SK.2023.1`: PDF oficial, SHA-256
  `e978933f018a1a27dbe8b2edad4ec6f4b6f2ba221428b1c6895230297dcb67fb`.
- `RR.2024.1`: PDF oficial, SHA-256
  `84d5328644356198d018c02f6f79fa2abac836a4759eca6bf3dd37aa33647811`.

## Uso juridico

Todas las salidas incluyen:

- `discovery_status`
- `identity_status`
- `source_status`
- `fetch_status`
- `completeness_status`
- `reading_status`
- `official_verification_status`
- `ratio_status`
- `comparability_eligibility`
- `drafting_eligibility`
- `strategy_eligibility`
- `citation_eligibility`

Una sentencia incompleta o no oficial queda bloqueada para estrategia, comparabilidad y redaccion.

## Modos de presentacion

- `clean`
- `professional`
- `technical_control`
- `debug`

Los modos `clean` y `professional` conservan la auditoria estructurada, pero resumen de forma
natural si la sentencia oficial fue verificada o si el texto no puede usarse como precedente.

## Fixtures

La suite `apps/mcp-server/tests/officialSwissCaseTools.test.ts` usa fixtures sinteticos minimos en
memoria. No contiene material protegido innecesario ni hardcodea sentencias reales como solucion
general.

`pnpm test:official-case-live --reference 1B_352/2019` ejecuta una prueba live opcional fuera del CI
offline para Tribunal Federal. Para Tribunal Penal Federal:

```bash
pnpm test:official-case-live --court bstger --reference SK.2023.1
pnpm test:official-case-live --court bstger --reference RR.2024.1
pnpm diagnose:official-case-pipeline --court bstger --reference SK.2023.1
```

Para Appenzell Ausserrhoden:

```bash
pnpm test:official-case-live --court ar --reference "O2V 19 21"
pnpm test:official-case-live --court ar --reference "O1S 18 1"
pnpm diagnose:official-case-pipeline --court ar --reference "O2V 19 21"
```

El portal oficial AR es `https://rechtsprechung.ar.ch/`, enlazado desde `https://ar.ch`. El
frontend usa busqueda POST JSON en
`https://rechtsprechung.ar.ch/api/.netlify/functions/searchQueryService` y descarga documentos
oficiales desde rutas `https://rechtsprechung.ar.ch/download/Obergericht/...`. Los dos expedientes
live verificados son:

- `O2V 19 21`: PDF
  `https://rechtsprechung.ar.ch/download/Obergericht/2020/OG-20200519-O2V-19-21-20200721.pdf`,
  86.461 bytes, SHA-256
  `cf22ebd5ff0886a6173dcb29a6f67126a8c85e1b56b6e706ac8b41acb5c8d167`.
- `O1S 18 1`: PDF
  `https://rechtsprechung.ar.ch/download/Obergericht/2018/OG-20181022-O1S-18-1-20190103.pdf`,
  86.945 bytes, SHA-256
  `f4431b41ea52c7c259f33d58d6925578be41278166a8b8e91eb32b876fd0cc76`.

El adaptador AR solo se activa para referencias AR reconocidas o `canton_hint: "AR"`. Un
`canton_hint: "AI"` no promueve AR ni usa el portal de Ausserrhoden como fuente de Innerrhoden.

Estas pruebas fallan honestamente si el portal no es accesible, limita la solicitud o cambia de
formato.
