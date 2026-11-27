---
name: configuracion-despacho
description: "Configura el perfil de trabajo: quien usa las skills, en que cantones, idiomas, materias, reglas de anonimizacion y formato de entregables. Usar con configurar, primer uso o cambiar mi perfil."
---

# Configuracion del perfil

## Pasos

1. Pregunta solo lo que falte: rol (abogado, particular, asesor), cantones habituales, idiomas de procedimiento, materias frecuentes, formato de entregables, carpeta base de asuntos.
2. Pregunta las reglas de confidencialidad y deja activada la anonimizacion por defecto.
3. Guarda `perfil.md` en la carpeta base elegida por el usuario.
4. Para el estilo de redaccion ejecuta `perfil-estilo`.

## Reglas

- No pidas contrasenas, claves ni datos bancarios.
- El perfil no contiene datos de clientes.
- Si el usuario no es abogado, recuerda los limites de representacion y recomienda revision profesional.

## Datos que hay que pedir

- Rol.
- Cantones.
- Idiomas.
- Materias.
- Formato.
- Carpeta base.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Perfil.md. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Guardar datos de clientes o claves en el perfil.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
