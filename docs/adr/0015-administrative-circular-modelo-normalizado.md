# ADR 0015 — Bloque `administrativeCircular` en `NormalizedDocument`

## Estado

Aceptado e implementado (revisión arquitectónica pre-Fase 4, 2026-07-26; usado en producción desde Fase 4).

## Contexto

SECO, BSV/OFAS y ESTV/AFC publican documentación administrativa (Weisungen, Kreisschreiben, Rundschreiben, Mitteilungen) que no encaja en ninguno de los `documentType` existentes tras Fase 3 (`case`, `legislation_law`, `legislation_article`, `official_publication`, `shab_entry`, `company_record`): no son sentencias, no son actos legislativos con cadena FRBR/JOLux, y "official_publication" era demasiado genérico para modelar campos reales verificados (referencia, versión, fecha de vigencia, estado, carácter vinculante declarado).

## Decisión

1. Se añade un único `documentType: "administrative_circular"` (no uno por variante) y un campo `administrativeDocumentType` (enum: `circular`, `directive`, `instruction`, `guidance`, `practice`, `information_notice`, `technical_notice`, `faq`, `form`, `report`, `other`) para sub-clasificar dentro de ese mismo cubo. Ver `docs/data-model.md#extensión-fase-4`.
2. `administrativeCircularMetadataSchema` (`packages/documents/src/normalizedDocument.ts`) modela: `department`, `administrativeDocumentType`, `referenceNumber`, `version`, `issuedDate`, `effectiveDate`, `supersededDate`, `status` (enum `current`/`superseded`/`withdrawn`/`unknown`), `subjects`, `relatedLegalProvisions`, `supersedesDocuments`, `supersededByDocument`, `territorialScope`, `declaredBindingCharacter` (enum `binding`/`non_binding`/`administrative_guidance_only`). Todos opcionales salvo `administrativeDocumentType`/`status`.
3. Reglas explícitas, verificadas en las tres implementaciones reales (SECO/BSV/ESTV, Fase 4):
   - **Nunca se infiere `declaredBindingCharacter`** a partir del tipo de documento o formato -- solo se rellena si la fuente lo declara explícitamente (ninguna de las tres lo hizo en la auditoría; el campo queda ausente en los tres proveedores).
   - **Nunca se infiere `supersedesDocuments`/`supersededByDocument`** por títulos parecidos o proximidad de fecha -- solo BSV expone una relación de sustitución, y solo en prosa libre dentro del propio PDF (KSIR sobre KSIH); no se implementó extracción automática (ver ADR 0019).
   - `status` refleja únicamente lo que la fuente presenta directamente (p. ej. "current" para la única versión listada de una Weisung de SECO, o "superseded" para una versión histórica de BSV con número de versión inferior), nunca una inferencia sobre datos ausentes.
4. Igual que `legislation`, el bloque se valida con `superRefine`: obligatorio cuando `documentType === "administrative_circular"`, prohibido en cualquier otro caso.

## Consecuencias

- Los tres proveedores de Fase 4 comparten exactamente el mismo bloque de metadatos sin necesitar variantes por proveedor; las diferencias reales (BSV con historial de versiones, SECO/ESTV sin él) se expresan rellenando o no ciertos campos, no con esquemas distintos.
- Un futuro proveedor administrativo (p. ej. otra oficina federal) reutiliza el mismo bloque sin cambios de esquema, salvo que aparezca un campo genuinamente nuevo y verificado.
- El campo `declaredBindingCharacter` vacío en los tres proveedores de Fase 4 es una limitación de fuente, no de implementación: si SECO/BSV/ESTV empiezan a declarar carácter vinculante explícitamente en el futuro, los mappers ya soportan poblarlo sin cambios de esquema.
