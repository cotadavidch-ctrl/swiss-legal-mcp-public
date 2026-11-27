---
name: krankheit-lohnfortzahlung
description: "Analiza el salario durante enfermedad o accidente. Usar con baja, enfermedad, certificado medico, Lohnfortzahlung o seguro de perdida de ganancia."
---

# Salario durante la incapacidad

## Base legal (lee cada articulo con `get_article`)

- Si el trabajador no puede trabajar sin culpa por causas personales como enfermedad o accidente, el empleador paga el salario por un tiempo limitado, en las condiciones del Art. 324a OR (leelo completo).

## Pasos

1. Comprueba duracion de la relacion, contrato, convenio y seguro colectivo.
2. Para accidentes revisa el seguro de accidentes (`sozialversicherung-atsg` si esta disponible).
3. La duracion exacta depende de escalas jurisprudenciales cantonales: di cual falta por verificar.
4. Conecta con la proteccion contra el despido (`kuendigung-fristen-sperrfristen`).

## Reglas

- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Certificados.
- Antiguedad.
- Seguro colectivo.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Periodo cubierto y reclamacion. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Aplicar una escala sin verificarla.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
