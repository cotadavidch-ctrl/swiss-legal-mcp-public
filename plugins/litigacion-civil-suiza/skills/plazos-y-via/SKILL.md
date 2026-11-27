---
name: plazos-y-via
description: "Determina la via procesal suiza y calcula el plazo con base legal usando compute_legal_deadline y analyze_procedural_strategy, con la fecha de notificacion como dato critico. Usar con plazo de recurso, que recurso procede o cuando vence."
---

# Via procesal y plazos

## Regla de oro

El plazo lo calcula `compute_legal_deadline`, no tu memoria. Si falta la fecha de notificacion, no hay plazo: se dice que no se puede calcular y se pide ese dato.

## Pasos

1. **Lee la resolucion**: autoridad, materia, valor litigioso, instruccion de recursos. Parte del asunto abierto con `alta-asunto`.
2. **Via procesal**: llama a `analyze_procedural_strategy`. Para civil, laboral, alquiler, seguros sociales, ejecucion por deudas, penal, administrativo y fiscal devuelve en `applicableLaw` reglas con extracto literal y fecha de verificacion: usalas como punto de partida y confirma la version aplicable con `get_article`. Contrasta el resultado con el texto literal de los articulos que sustentan la via (`get_article`), por ejemplo Art. 308 ZPO (Berufung, umbral de CHF 10 000) o Art. 319 ss. ZPO (Beschwerde).
3. **Elige el conjunto de reglas** de `compute_legal_deadline`:

| Situacion                              | ruleSet                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Berufung civil                         | `ZPO_BERUFUNG` (summarisch: `ZPO_BERUFUNG_SUMMARISCH`)                                                  |
| Respuesta a la Berufung                | `ZPO_BERUFUNG_ANTWORT` (sumario: `ZPO_BERUFUNG_ANTWORT_SUMMARISCH`)                                     |
| Impugnacion del despido de un alquiler | `OR_MIETE_KUENDIGUNG_ANFECHTUNG`                                                                        |
| Beschwerde civil                       | `ZPO_BESCHWERDE` (10 dias: `ZPO_BESCHWERDE_10TAGE`)                                                     |
| Beschwerde al Tribunal Federal         | `BGG_BESCHWERDE`                                                                                        |
| Seguros sociales, Einsprache o recurso | `ATSG_EINSPRACHE`, `ATSG_BESCHWERDE`                                                                    |
| Recurso administrativo federal         | `VWVG_BESCHWERDE`                                                                                       |
| Oposicion a un requerimiento de pago   | `SCHKG_RECHTSVORSCHLAG`                                                                                 |
| Penal                                  | `STPO_BESCHWERDE`, `STPO_BERUFUNG_ANMELDUNG`, `STPO_BERUFUNG_ERKLAERUNG`, `STPO_EINSPRACHE_STRAFBEFEHL` |

4. **Tipo de procedimiento civil**: si has confirmado que es un proceso ORDINARIO, pasa `stillstandExempt: false`: la suspension de verano, Pascua y Navidad rige y el resultado sale firme, sin fecha prudente anterior. Si es sumario, pasa `true`. Si no lo sabes, omite el campo: la herramienta devuelve el vencimiento y, ademas, una fecha prudente sin suspension.
5. **Notificacion**: pasa `notificationDate` y `notificationProof` (`proven`, `assumed`, `unknown`). Si hubo un primer intento de entrega no recogido, pasa `firstDeliveryAttemptDate`.
6. **Lee la salida de `compute_legal_deadline`**: `deadlineDate` es el vencimiento; `firstDay` es el primer dia del computo; `stillstandApplied` y `stillstandDaysSkipped` dicen cuanta suspension se descuento; `status: conditional` y `alternativeDates` indican que el resultado depende de condiciones (por ejemplo, que la suspension se aplique al procedimiento concreto); `safeDate` es la fecha prudente para presentar. Si `analyze_procedural_strategy` devuelve en `deadlines` una entrada `cannot_calculate` con `notification_date_present_but_legal_basis_missing`, ignorala: el plazo sale de `compute_legal_deadline`, no de ahi.
7. **Calcula** y presenta: fecha de vencimiento, base legal de cada paso, suspensiones aplicadas (ferias de Pascua, verano y Navidad cuando correspondan) y festivos usados.
8. **Fechas distintas**: si la herramienta devuelve una fecha segura anterior al vencimiento, explicalo asi: es la fecha prudente para presentar, no el vencimiento; desaparece si confirmas el tipo de procedimiento con `stillstandExempt`. Si el usuario o un colega da otra fecha, compara y explica la diferencia.
9. **Escribe** `asuntos/<slug>/plazos.md` con la tabla de plazos, el ruleSet, el dato de notificacion y su fuente.

## Reglas

- Los plazos legales no se prorrogan (Art. 144 Abs. 1 ZPO para el civil); dilo cuando proceda.
- Si la instruccion de recursos de la resolucion dice otro plazo, prevalece lo que la ley fije; indica la discrepancia.
- Festivos cantonales: la herramienta no los conoce. Pidelos al usuario o marca que no estan aplicados.
- Antes de presentar nada, recomienda comprobar la fecha en el documento original.
- Un plazo calculado es un borrador de calculo. La decision de presentar es del usuario o de su abogado.

## Datos que hay que pedir

- Resolucion.
- Tipo de procedimiento.
- Notificacion y su prueba.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Tabla de plazos con base legal. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Calcular de memoria.
- Confundir fecha prudente con vencimiento.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
