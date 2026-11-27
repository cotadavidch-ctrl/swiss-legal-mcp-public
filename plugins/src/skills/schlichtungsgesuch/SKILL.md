---
name: schlichtungsgesuch
description: "Prepara la solicitud de conciliacion previa y la vista ante la autoridad de conciliacion suiza. Usar con Schlichtungsgesuch, conciliacion, Friedensrichter o Klagebewilligung."
---

# Conciliacion (Schlichtung)

## Base legal (lee cada articulo con `get_article`)

- Antes del procedimiento de decision hay un intento de conciliacion (Art. 197 ZPO); comprueba las excepciones en el Art. 198.
- Si no hay acuerdo, la autoridad expide la autorizacion para demandar (Art. 209 Abs. 1 ZPO) y hay tres meses para presentar la demanda; en alquiler y arrendamiento de vivienda y local, 30 dias (Abs. 3 y 4).
- En asuntos patrimoniales de hasta CHF 2000 la autoridad puede decidir si la parte demandante lo pide (Art. 212 Abs. 1).

## Pasos

1. Comprueba si la conciliacion es obligatoria, opcional o excluida.
2. Redacta la solicitud con partes, peticion y objeto del litigio (Art. 202 ZPO), con `generate_rechtsbegehren`.
3. Prepara la vista: hechos, documentos, margen de acuerdo y minimo aceptable que fije el usuario.
4. Anota la fecha de entrega de la autorizacion y calcula a mano el plazo para demandar, marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`.

## Reglas

- La competencia local se verifica antes de presentar.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Partes.
- Pretension.
- Importe.
- Documentos.
- Domicilio.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Solicitud y guion de la vista. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Autoridad incompetente.
- Perder la validez de la autorizacion.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
