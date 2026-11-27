---
name: staatshaftung-bund
description: "Analiza una reclamacion de danos contra la Confederacion por actos de sus funcionarios. Usar con danos causados por la administracion federal, Staatshaftung o responsabilidad del Estado."
---

# Responsabilidad de la Confederacion

## Base legal (lee cada articulo con `get_article`)

- La Confederacion responde del dano que un funcionario cause ilicitamente a terceros en el ejercicio de su cargo, sin necesidad de culpa de este (Art. 3 Abs. 1 VG); las leyes especiales prevalecen (Abs. 2).
- La prescripcion sigue las reglas del OR sobre actos ilicitos y la peticion se presenta ante el Departamento Federal de Finanzas (Art. 20; lee los apartados).

## Pasos

1. Comprueba que el autor es federal; si es cantonal o municipal, busca la ley cantonal de responsabilidad.
2. Separa dano, ilicitud, nexo y actuacion oficial.
3. Controla la prescripcion y marca el calculo `[CALCULO MANUAL, SIN HERRAMIENTA]`.

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Hecho.
- Funcionario.
- Dano.
- Fechas.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Peticion al departamento. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Demandar a la confederacion por actos cantonales.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
