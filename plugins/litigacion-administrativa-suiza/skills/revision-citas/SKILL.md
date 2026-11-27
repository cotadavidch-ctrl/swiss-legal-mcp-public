---
name: revision-citas
description: "Revisa todas las citas de un escrito suizo antes de presentarlo con las herramientas de swiss-legal-mcp y entrega un informe de lo verificado, lo alterado y lo pendiente. Usar con revisar citas, comprobar el escrito o antes de presentar."
---

# Revision de citas antes de presentar

## Regla

Una cita no verificada no sale en el escrito: se corrige, se sustituye o se marca `[PENDIENTE DE VERIFICAR]` a la vista del usuario. Cuenta como verificado solo lo que una herramienta ha comprobado en la fuente oficial.

## Pasos

1. **Extrae** todas las citas del borrador: articulos, sentencias (expediente o BGE) y fragmentos entrecomillados.
2. **Articulos**: comprueba cada uno con `get_article` o `verify_legal_citation`. Si la ley es cantonal, usa `get_cantonal_article`. Anota la version en vigor y si la redaccion cambio recientemente.
3. **Sentencias**: comprueba la identidad con `verify_swiss_case_identity` o `resolve_official_swiss_case`. Si el expediente no se encuentra, no sigas con esa cita.
4. **Citas literales**: `verify_quoted_passages` sobre el texto exacto. Distingue literal, literal con cambios menores y alterada. Corrige la alterada con el texto real.
5. **Que dice de verdad**: para las sentencias que sostienen un argumento, lee el considerando citado con `fetch_official_swiss_case_full_text` y comprueba que respalda la afirmacion. Existir no es lo mismo que decir lo que se atribuye.
6. **Conjunto**: `audit_legal_draft` sobre el borrador completo y `validate_swiss_legal_draft` si el escrito es de decision o de recurso.

## Informe

Tabla con una fila por cita: cita | tipo | herramienta usada | resultado (`verificada`, `alterada`, `no encontrada`, `no comprobable`) | accion. Debajo, tres listas: citas que hay que corregir, citas que hay que eliminar y citas pendientes de comprobar por una persona.

## Limites que hay que decir

- `verificada` significa que existe y coincide con la fuente, no que el argumento sea juridicamente acertado.
- El portal del Tribunal Federal se consulta despacio y puede aplicar pausas; si pasa, el resultado queda `no comprobable` y se reintenta mas tarde.
- La revision final de un abogado sigue siendo necesaria.

## Datos que hay que pedir

- Borrador completo e idioma.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Informe cita por cita. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Dar por buena una sentencia porque existe.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
