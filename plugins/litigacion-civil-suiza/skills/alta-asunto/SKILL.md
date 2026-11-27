---
name: alta-asunto
description: "Abre un asunto de derecho suizo. Recoge hechos con estado, la resolucion impugnada, la fecha de notificacion y lo que falta, y guarda el asunto con create_or_update_matter. Usar con nuevo asunto, abrir caso o alta del asunto."
---

# Alta de asunto

## Antes de empezar

1. Comprueba que las herramientas de swiss-legal-mcp responden con una consulta barata, por ejemplo `get_matter_state` con el slug del asunto (si no existe devuelve `found: false`, y eso ya prueba que el servidor responde). Si el servidor no responde, para y dilo.
2. Usa siempre una carpeta propia del asunto, vacia al crearla: `asuntos/<slug>/`. Un asunto, una carpeta. El slug es `tema-anio`, sin nombres reales.
3. Aplica la anonimizacion del README: en las consultas externas van CLIENTE_1, PARTE_CONTRARIA_1, DIRECCION_1.

## Que hay que recoger

Pregunta solo lo que falte, en este orden:

1. **Posicion**: demandante, demandado, recurrente, recurrido, asegurado, aseguradora, contribuyente, autoridad.
2. **Materia y canton** (civil, social, fiscal, administrativo, penal; BE, ZH...).
3. **Resolucion o acto impugnado**: autoridad, fecha, tipo, si tiene instruccion de recursos (Rechtsmittelbelehrung) y que dice.
4. **Fecha de notificacion** y como consta (acuse, sobre, correo certificado). Es el dato que mas cambia el resultado: si no se sabe, el estado es `unknown`.
5. **Hechos**, cada uno con id, descripcion breve, fuente (documento) y estado `accepted`, `alleged`, `disputed` o `unknown`.
6. **Pretensiones** (Rechtsbegehren) y valor litigioso, si lo hay.
7. **Documentos** disponibles y numero que se les da.

## Que haces

1. Escribe `asuntos/<slug>/asunto.md` con: posicion, materia, resolucion, notificacion, hechos con estado, pretensiones, documentos y una seccion **Datos que faltan**.
2. Registra el asunto en el almacen con `create_or_update_matter`. Su modelo completo (actores, proposiciones, procedencia) es muy formal, asi que usa solo el registro minimo: `matter: { matter: { id: "<slug>", title: "<titulo anonimizado>", jurisdiction: "<canton>" } }`, con `change_summary` y `human_approved=false`. El contenido del asunto vive en `asunto.md`; el almacen sirve de indice y de historial de versiones. Solo rellena documentos, pretensiones o autoridades del modelo si el usuario lo pide.
3. Devuelve al usuario un resumen de cinco lineas y la lista de datos que faltan, ordenada por impacto (notificacion primero).
4. Propon el siguiente paso: `cronologia-y-prueba` y despues `plazos-y-via`.

## Reglas

- No inventes hechos, fechas ni cuantias. Si falta, `unknown`.
- Un hecho que solo afirma una parte es `alleged`, no `accepted`.
- No abras un asunto dentro de una carpeta que ya contiene documentos de otro asunto.
- No subas documentos a ningun servicio externo sin permiso expreso del usuario.

## Datos que hay que pedir

- Posicion.
- Materia.
- Canton.
- Resolucion.
- Notificacion.
- Hechos.
- Pretensiones.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Asunto.md y registro minimo. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Asumir la fecha de notificacion.
- Mezclar asuntos.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
