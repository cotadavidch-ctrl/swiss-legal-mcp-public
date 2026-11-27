---
name: gleichstellung-diskriminierung
description: "Analiza una discriminacion por sexo en el trabajo. Usar con discriminacion salarial, acoso, Gleichstellungsgesetz o despido discriminatorio."
---

# Igualdad en el trabajo

## Base legal (lee cada articulo con `get_article`)

- La persona discriminada puede pedir prohibicion, eliminacion, declaracion y pago segun el Art. 5 GlG (leelo).
- En el despido discriminatorio se aplica el Art. 336b OR (Art. 9 GlG).
- En estos litigios no se imponen costas judiciales en el procedimiento de decision (Art. 114 ZPO).

## Pasos

1. Ordena hechos, comparaciones y fechas.
2. Lee la regla de verosimilitud de la ley (Art. 6) antes de repartir la carga.
3. Respeta la oposicion escrita y la caducidad en despidos (`arbeitsrecht-kuendigung`).

## Reglas

- Trata los datos sensibles con maxima reserva.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Comparadores.
- Fechas.
- Mensajes.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Cuadro de indicios y peticiones. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Perder la oposicion escrita al despido.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
