---
name: bau-einsprache
description: "Prepara una oposicion o recurso en materia de construccion. Usar con licencia de obra, Baubewilligung, Baueinsprache o vecino que construye."
---

# Construccion y licencias

## Base legal (lee cada articulo con `get_article`)

- La materia es cantonal y municipal: localiza ley de construccion y reglamento con `search_cantonal_legislation` y `get_cantonal_article`; los reglamentos municipales pueden no estar disponibles y hay que pedirlos.

## Pasos

1. Anota publicacion del proyecto y plazo de oposicion que indique.
2. Comprueba legitimacion como vecino segun la ley cantonal.
3. Compara planos con las normas leidas y lista incumplimientos.
4. Marca plazos `[CALCULO MANUAL, SIN HERRAMIENTA]`.

## Reglas

- No cites normas municipales que no hayas leido.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Publicacion.
- Planos.
- Distancia.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Oposicion con normas. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Fuera del plazo de publicacion.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
