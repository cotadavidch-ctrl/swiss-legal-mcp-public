---
name: strafanzeige-strafantrag
description: "Prepara una denuncia (Strafanzeige) o una querella (Strafantrag) en derecho penal suizo y la declaracion como acusacion particular, con el plazo de tres meses del Strafantrag. Usar con denunciar un delito, Strafanzeige, Strafantrag o Privatklaegerschaft."
---

# Denuncia, Strafantrag y acusacion particular

## Base legal (lee cada articulo con `get_article`)

- **Denuncia**: cualquier persona puede denunciar delitos ante una autoridad de persecucion, por escrito o de palabra (Art. 301 Abs. 1 StPO). Quien denuncia sin ser perjudicado ni acusador particular no tiene derechos de parte (Art. 301 Abs. 3).
- **Delitos de querella o de autorizacion**: el procedimiento previo solo se abre cuando se presenta el Strafantrag o se concede la autorizacion (Art. 303 Abs. 1 StPO). Antes, la autoridad solo puede adoptar medidas urgentes de aseguramiento (Abs. 2).
- **Plazo del Strafantrag**: el derecho a presentarlo caduca a los tres meses (Art. 31 StGB). El plazo empieza el dia en que la persona con derecho conoce al autor. Es un plazo en meses que `compute_legal_deadline` no calcula: calculalo a mano y marcalo `[CALCULO MANUAL, SIN HERRAMIENTA]`.
- **Acusacion particular** (Privatklaegerschaft): es la persona perjudicada que declara expresamente querer participar como parte acusadora o civil (Art. 118 Abs. 1 StPO). El Strafantrag equivale a esa declaracion (Abs. 2). Hay que declararlo a mas tardar hasta el cierre del procedimiento previo (Abs. 3).

## Pasos

1. Abre el asunto con `alta-asunto` (materia `criminal`, posicion de perjudicado).
2. Identifica el delito que se denuncia y lee el texto de su articulo para ver si se persigue de oficio o solo a querella. No lo des por supuesto: si no puedes verificarlo, dilo.
3. Fija la fecha en que se conocio al autor y calcula a mano el limite de tres meses cuando el delito sea de querella.
4. Redacta el esquema de la denuncia: hechos con fecha y lugar, quien los cometio (anonimiza al usar herramientas externas), calificacion provisional (marcada como tal), pruebas disponibles, y la declaracion expresa de querer participar como acusacion particular y, si procede, como parte civil.
5. Revisa citas con `revision-citas` y los datos con `geheimnis-und-anonymisierung`.

## Reglas

- No califiques el hecho como delito concreto con certeza; propon una calificacion provisional y avisa de que decide la autoridad.
- Si el plazo de tres meses esta cerca de vencer, dilo en la primera linea de la respuesta.
- Es un borrador para revision de un abogado; esta skill no aconseja estrategia de acusacion.

## Datos que hay que pedir

- Hechos.
- Autor.
- Fecha de conocimiento.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Denuncia o querella. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Pasar los tres meses.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
