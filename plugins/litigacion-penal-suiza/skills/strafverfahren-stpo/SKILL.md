---
name: strafverfahren-stpo
description: "Maneja plazos y recursos del proceso penal suizo (StPO): oposicion a una orden penal, queja y apelacion. Usar con Strafbefehl, Einsprache penal, Berufung penal o StPO."
---

# Proceso penal (StPO)

## Plazos clave (verifica cada articulo con `get_article`; calcula con `compute_legal_deadline`)

1. **Einsprache contra Strafbefehl**: 10 dias por escrito ante la fiscalia (Art. 354 Abs. 1 StPO; `STPO_EINSPRACHE_STRAFBEFEHL`). La orden penal sin oposicion en plazo pasa a ser firme.
2. **Beschwerde**: 10 dias, por escrito y motivada, ante la instancia de queja; no hay plazo si es por denegacion o retraso de justicia (Art. 396 StPO; `STPO_BESCHWERDE`).
3. **Berufung**: anunciarla en 10 dias desde la notificacion de la sentencia (Art. 399 Abs. 1; `STPO_BERUFUNG_ANMELDUNG`) y presentar la declaracion de apelacion en 20 dias desde la notificacion de la sentencia motivada (Art. 399 Abs. 3; `STPO_BERUFUNG_ERKLAERUNG`). Si se apela solo en parte, hay que indicar con precision que partes (Abs. 4).
4. **Ausencia**: la apelacion se da por retirada si quien la declaro no comparece a la vista y no presenta escrito (Art. 407 StPO).

## Pasos

1. Abre el asunto (`alta-asunto`, materia `criminal`).
2. Fecha de notificacion y forma. En el proceso penal los plazos legales no se pueden prorrogar y no hay ferias judiciales (Art. 89 Abs. 1 y 2 StPO): no apliques las suspensiones de la ZPO; la herramienta ya lo tiene en cuenta.
3. Calcula con `compute_legal_deadline`.
4. Jurisprudencia y citas solo de fuentes leidas (`revision-citas`).

## Reglas

- Una queja o una oposicion sin cumplir el plazo no se subsana: avisa de inmediato en cuanto el plazo sea menor de 3 dias.
- Esta skill no asesora estrategia de defensa; marca todo para revision de un abogado defensor.

## Datos que hay que pedir

- Decision.
- Notificacion.
- Fase.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Plazos y escrito. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Aplicar ferias civiles.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
