# ADR 0018 — Versionado y sustitución de documentos administrativos

## Estado

Aceptado e implementado (Fase 4, 2026-07-27).

## Contexto

Las tres fuentes tienen mecanismos de versionado real muy distintos entre sí (ver `docs/provider-contracts/{seco,bsv,estv}.md`):

- **SECO**: sin historial visible para las Weisungen "núcleo" (solo la versión vigente listada); las "Fachweisungen" numeradas se acumulan sin sustituirse.
- **BSV**: historial real y descargable por versión (`/de/d/{docId}/download?version=N`), verificado con 6 versiones reales del mismo documento (KSIR).
- **ESTV**: cobertura histórica profunda (circulares desde 1995) pero sin mecanismo de "cadena de versión" -- cada año es una entrada PDF independiente, no una relación estructurada.

## Decisión

1. `ProviderCapabilities`-equivalente informal (capacidades reales documentadas en prosa en `docs/providers/*.md`, no un nuevo campo tipado -- ver deuda de "resolver duplicación de registro" explícitamente fuera de alcance de Fase 4): `getHistoricalVersion` es real solo para BSV.
2. **Solo BSV modela `status: "superseded"`**, y únicamente para versiones **de un mismo `docId`** con número de versión inferior a la vigente (`isCurrent: false` en `BsvVersionDetail`) -- nunca para sustitución entre documentos distintos. El id incluye el sufijo `:vN` (`bsv:18452:v5`) solo para versiones históricas; la vigente no lleva sufijo (`bsv:18452`), reflejando la propia convención real de la fuente (el enlace de descarga vigente tampoco lleva `?version=`).
3. **Ninguna relación de sustitución entre documentos distintos se infiere automáticamente**, ni en BSV ni en SECO/ESTV. El caso real conocido (el KSIR de BSV declara en su propio prefacio que sustituye partes del KSIH, un documento con nombre distinto) queda documentado como hallazgo, pero `supersedesDocuments`/`supersededByDocument` permanecen ausentes en la implementación: extraerlo automáticamente requeriría NLP sobre prosa libre, explícitamente prohibido por la regla "no infieras sustitución por títulos parecidos ni proximidad de fecha".
4. Para SECO/ESTV, `status` siempre es `"current"` en Fase 4: es lo único que la fuente presenta (una única entrada por práctica/circular en el listado), no una inferencia sobre datos ausentes de historial.

## Consecuencias

- Un cliente de `get_official_document` puede pedir una versión histórica concreta de BSV (`documentId: "bsv:18452"`, `version: "5"`) y recibirá el PDF real de esa versión con su propio hash de contenido -- pero no puede pedir versiones históricas de SECO/ESTV porque genuinamente no existen en la fuente.
- Si en el futuro alguna de las tres fuentes expone una relación de sustitución de forma estructurada (no en prosa libre), los mappers ya soportan poblar `supersedesDocuments`/`supersededByDocument` sin cambios de esquema (ver ADR 0015).
- El caso KSIR/KSIH queda como ejemplo documentado de una limitación deliberada, no accidental: cualquier revisor puede verificarlo leyendo el PDF real (`tests/fixtures/bsv/ksir_de_v6_current.pdf`) sin que el sistema pretenda haberlo modelado.
