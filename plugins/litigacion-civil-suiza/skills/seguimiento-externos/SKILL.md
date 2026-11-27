---
name: seguimiento-externos
description: "Prepara borradores de seguimiento a peritos, traductores, aseguradoras de defensa juridica y colegas que colaboran en un asunto. Usar con estado a colaboradores, escribe al perito o seguimiento."
---

# Seguimiento a colaboradores externos

## Pasos

1. Lista quien colabora en cada asunto, que se le pidio, cuando y para cuando.
2. Marca lo vencido y lo que condiciona un plazo.
3. Redacta un borrador por destinatario, con lo minimo necesario del asunto.
4. Anota en `actualizar-asunto` lo que el usuario envie.

## Reglas

- Solo borradores: no envies nada.
- No incluyas datos que el destinatario no necesite ni datos de otros asuntos.

## Datos que hay que pedir

- Colaboradores.
- Encargos.
- Fechas y plazos que dependen.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Tabla y borradores por destinatario. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Enviar sin permiso.
- Incluir datos innecesarios.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
