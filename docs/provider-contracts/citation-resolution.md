# Contrato técnico — Resolución de citas (`packages/citations`)

No es un proveedor de datos: es un paquete puro que **parsea, normaliza y resuelve** citas legales suizas contra los proveedores ya integrados, inyectados por el llamador. Verificado en vivo el 2026-07-28 (mismo día que el cierre de cobertura cantonal, dentro de la misma sesión de Fase 6).

## Tipos de cita reconocidos (`parser.ts`)

| Tipo                                    | Patrón real                                                                                          | Ejemplo                                                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `systematic_number`                     | `\b(?:RS\|SR)\s*(\d{1,3}(?:\.\d{1,4}){0,3})\b`                                                       | `RS 220`, `SR 210`, `RS 172.220.111.3`                                                                           |
| `bge_atf_dtf`                           | `\b(BGE\|ATF\|DTF)\s+(\d{1,3})\s+([IV]+[a-z]?)\s+(\d+)\b`                                            | `ATF 142 III 1`                                                                                                  |
| `case_number`                           | `\b(\d[A-Z]{1,3}_\d+)\/(\d{4})\b`                                                                    | `6B_1234/2025` (formato real confirmado en `docs/source-audit.md`)                                               |
| `ecli`                                  | `\bECLI:[A-Z]{2}:[A-Za-z0-9]+:\d{4}:[A-Za-z0-9._-]+\b`                                               | `ECLI:CH:BGer:2020:6B_1234_2019` (formato ISO 6923 estándar; reconocimiento de formato solamente, ver más abajo) |
| `unresolvable` (artículo + abreviatura) | `\bart\.?\s*(\d+[a-z]?)(?:...al\.?/abs\.?...)?(?:...let\.?/lit\.?...)?(?:\s+([A-Z][A-Za-z]{1,10}))?` | `Art. 41 al. 2 let. a OR`, `Art. 41 Abs. 2 lit. a` (formas FR/DE)                                                |

`systematic_number` es deliberadamente genérico (no `rs_federal`/`rs_cantonal`): un número RS federal y un número sistemático cantonal (SRSZ, RSN, etc.) comparten el mismo formato numérico punteado y **no se pueden distinguir por texto solo** — la desambiguación ocurre siempre en el resolver, nunca en el parser.

No existe un diccionario abreviatura→RS (`art. 41 CO` → RS 220): `FedlexProvider.capabilities.searchByAbbreviation` es `false` (nunca verificado en la auditoría real de Fase 3). El parser extrae la abreviatura como texto (`lawAbbreviation`) para trazabilidad, pero el resolver **declina explícitamente** resolverla en vez de adivinar un mapeo.

## Niveles de coincidencia (`CitationMatchStatus`)

| Nivel       | Significado real                                                                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `exact`     | Identificador con garantía estructural real de unicidad — hoy solo cuando Fedlex resuelve por ELI (`searchLegislation` devuelve exactamente 1 resultado real).                                                                                   |
| `probable`  | Se encontró un único resultado real pero sin garantía estructural de unicidad (ej. un único candidato cantonal sin ELI; una única sentencia real que coincide con una referencia BGE/ATF/DTF vía búsqueda de frase exacta de entscheidsuche.ch). |
| `ambiguous` | Más de un candidato real (ej. el mismo número sistemático existe en Fedlex Y en un canton real sin `cantonHint`; una referencia BGE/ATF/DTF citada por varias sentencias reales indexadas). Nunca se elige uno arbitrariamente.                  |
| `not_found` | Se consultó la fuente real y no devolvió nada, o no había ninguna fuente real configurada para ese tipo de cita.                                                                                                                                 |

**Nunca se convierte un match aproximado en una verificación positiva** — `probable` y `ambiguous` se comunican siempre explícitamente en `match`, nunca se colapsan a `exact`.

## ECLI: reconocimiento de formato, nunca verificación

El resolver **nunca intenta resolver un ECLI contra ninguna fuente**: siempre devuelve `not_found` con una advertencia explícita ("ningún tribunal suizo indexado por las fuentes integradas asigna ECLI de forma sistemática"). Esto es una decisión deliberada, no una limitación de implementación: verificado en `docs/source-audit.md` (sección 1) que Suiza no asigna ECLI de forma sistemática, y ningún proveedor integrado (Fedlex, entscheidsuche.ch, ningún cantonal) puebla el campo `ecli` del modelo normalizado.

## Resolución de número sistemático (federal + cantonal)

1. Se consulta primero `LegislationProviderRegistry.get("fedlex").searchLegislation({systematicNumber})` (real, `capabilities.searchBySystematicNumber: true`). Cada item real devuelto se resuelve a documento completo vía `getLaw({eli})`.
2. Si el llamador provee un `CantonalCitationLookupPort` (implementado en `apps/mcp-server/src/tools/citationSupport.ts`, reutilizando `resolveCantonalProvider`), se consulta el proveedor cantonal correspondiente **solo si `cantonHint` está presente** — nunca se consultan los 26 proveedores cantonales a la fuerza por cada cita.
3. Con 0 candidatos reales: `not_found`. Con 1: `exact` si vino de Fedlex, `probable` si vino de un cantonal (sin ELI, sin garantía estructural). Con 2+: `ambiguous`, con advertencia explícita mencionando el número RS reutilizado entre jurisdicciones.

## Resolución de jurisprudencia (BGE/ATF/DTF, número de expediente)

Se normaliza la cita al prefijo canónico `BGE` (mismo prefijo que usa `entscheidsuche.ch` para autoidentificar sus propios documentos, ver `extractBgeReference` en `packages/providers/entscheidsuche/src/mapper.ts`) y se consulta `EntscheidsucheMcpProvider.searchByCaseNumber` (ya activa como `search_cases_by_reference`, búsqueda de frase exacta real). 0 resultados → `not_found`; 1 → `probable` (entscheidsuche.ch es un agregador no oficial, nunca garantiza unicidad estructural); 2+ → `ambiguous`.

## Evidencia y trazabilidad

Cada `CitationResolution` incluye `evidence: CitationEvidenceEntry[]` con `providerConsulted`, `sourceUrl`, `officialCharacter`, y una nota explicando por qué esa fuente se consideró. `warnings` documenta explícitamente cualquier limitación real encontrada (proveedor no disponible, ambigüedad, fuente sin capacidad real) — nunca se omite silenciosamente un camino de resolución no intentado.

## Nivel de confianza

Alto para la resolución federal (ELI real, `searchBySystematicNumber` verificado) y para BGE/ATF/DTF vía búsqueda de frase exacta. Medio para la resolución cantonal (depende de que el llamador provea `cantonHint`; sin ELI ni garantía de unicidad estructural). Ninguno para ECLI (nunca se intenta) ni para abreviatura-only (nunca se intenta, motivo declarado explícitamente en cada respuesta).
