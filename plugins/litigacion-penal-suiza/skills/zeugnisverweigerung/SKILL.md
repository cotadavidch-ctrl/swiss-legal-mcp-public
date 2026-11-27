---
name: zeugnisverweigerung
description: "Comprueba si un testigo puede negarse a declarar en el proceso penal. Usar con derecho a no declarar, familiar testigo o Zeugnisverweigerung."
---

# Negativa a declarar del testigo

## Base legal (lee cada articulo con `get_article`)

- Pueden negarse por relacion personal, entre otros, el conyuge o pareja de hecho, quien tiene hijos comunes y parientes en linea directa (Art. 168 Abs. 1 StPO; lee la lista completa y las excepciones). Otras causas estan en los articulos siguientes.

## Pasos

1. Identifica el vinculo con el investigado.
2. Lee la causa aplicable y su excepcion.
3. Indica que la advertencia debe constar y que la decision es del testigo.

## Reglas

- No presiones ni aconsejes a un testigo sobre el contenido.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Vinculo y citacion.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Analisis de la causa. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Aconsejar contenido.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
