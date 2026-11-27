---
name: betreibung-schkg
description: "Maneja una Betreibung suiza: oposicion al requerimiento de pago, levantamiento de la oposicion y accion de reconocimiento. Usar con Zahlungsbefehl, Rechtsvorschlag, Rechtsoeffnung o SchKG."
---

# Ejecucion por deudas (SchKG)

## Plazos clave (verifica con `get_article`; calcula con `compute_legal_deadline`)

1. **Rechtsvorschlag** (oposicion): hay que declararlo en el acto al notificador del Zahlungsbefehl o en 10 dias ante la oficina de ejecuciones, oral o por escrito (Art. 74 Abs. 1 SchKG). Si solo se niega parte de la deuda hay que indicar el importe exacto; si no, se entiende negada toda (Abs. 2). `ruleSet: SCHKG_RECHTSVORSCHLAG`.
2. **Rechtsoeffnung** (levantamiento): el acreedor con titulo judicial ejecutable puede pedir el levantamiento definitivo (Art. 80 SchKG); para otros titulos hay levantamiento provisional (Art. 82). Lee el articulo para ver que titulos equivalen a una sentencia.
3. **Aberkennungsklage**: tras levantamiento provisional, el deudor puede presentar demanda de reconocimiento negativo en 20 dias (Art. 83 Abs. 2 SchKG).

## Pasos

1. Abre el asunto con `alta-asunto` (materia `debt-enforcement`).
2. Anota fecha de notificacion del Zahlungsbefehl y prueba de la misma. Sin fecha no hay plazo calculable.
3. Calcula con `compute_legal_deadline`. Los plazos de la ley no pueden modificarse por contrato (Art. 33 Abs. 1 SchKG); solo se admite un plazo mayor o una prorroga para quien vive en el extranjero o debe ser notificado por publicacion (Abs. 2). Lee el articulo antes de afirmar que un plazo es prorrogable.
4. Decide si se opone a toda la deuda o a una parte, y fija el importe exacto.
5. Si hay levantamiento, calcula el plazo de 20 dias y evalua la accion.

## Reglas

- Es un plazo muy corto: avisa de su urgencia en cuanto aparezca el documento.
- No sugieras presentar la oposicion por un tercero sin comprobar el poder de representacion.

## Datos que hay que pedir

- Requerimiento de pago.
- Fecha de entrega.
- Deuda y titulos.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Declaracion u accion y plazos. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Dejar vencer los diez dias.
- No precisar la parte discutida.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
