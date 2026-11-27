---
name: berufungsantwort
description: "Prepara la respuesta a una Berufung civil suiza (Art. 312 ZPO) y la Anschlussberufung (Art. 313 ZPO) cuando la sentencia tambien perjudica al usuario. Usar con contestar apelacion, Berufungsantwort o recurso adhesivo."
---

# Respuesta a la Berufung

## Requisitos previos

- Asunto abierto con `alta-asunto`.
- El escrito de Berufung de la otra parte y la sentencia de primera instancia, completos.
- Plazo con `plazos-y-via` (`ZPO_BERUFUNG_ANTWORT`; en sumario `ZPO_BERUFUNG_ANTWORT_SUMMARISCH`, donde ademas no cabe la Anschlussberufung segun el Art. 314 Abs. 1 ZPO). La fecha de notificacion es la de la entrega de la Berufung a tu parte, no la de la sentencia. La norma fija 30 dias para la respuesta (Art. 312 Abs. 2 ZPO; verifica el texto con `get_article`). Si la notificacion no consta, no hay plazo calculable.

## Fase 1. Leer el recurso de la otra parte

1. Lista sus motivos y clasificalos: derecho (Art. 310 lit. a) o hechos (lit. b).
2. Para cada motivo busca: si ataca todos los fundamentos de la sentencia, si identifica el pasaje concreto que critica, y si propone una decision distinta o solo anular.
3. Revisa la prueba nueva que aporta contra Art. 317 Abs. 1 ZPO y senala la que no cumple los requisitos.
4. Marca cualquier motivo que no cumpla el deber de motivacion de Art. 311 Abs. 1 ZPO.

## Fase 2. Respuesta, motivo a motivo

- Primero, admisibilidad: si procede pedir que no se entre en la Berufung y por que.
- Despues, cada motivo en el mismo orden que el recurso: lo que dice, por que no prospera, apoyo en el expediente y en la norma.
- Los hechos que la otra parte reproduce de forma distinta a como constan se corrigen citando el documento.

## Fase 3. Anschlussberufung

Valora si la sentencia tambien perjudica al usuario en algo (costas, intereses, una pretension rechazada). Si es asi, la Anschlussberufung se plantea dentro de la Berufungsantwort (Art. 313 Abs. 1 ZPO). Explica al usuario que cae en los supuestos de Art. 313 Abs. 2 (por ejemplo, si el tribunal no entra en la Berufung o esta se retira). Recomienda sin forzarla: deja claro el riesgo y el beneficio.

## Fase 4. Jurisprudencia y control

Mismas reglas que `berufung-zpo`: solo sentencias leidas, ficha por sentencia, `verify_quoted_passages` y `audit_legal_draft` antes de entregar. Para cotejar el recurso de la otra parte puedes usar `analyze_opposing_submission`.

## Pretensiones de la respuesta

Genera con `generate_rechtsbegehren` las peticiones: no entrar en la Berufung o desestimarla, y confirmar la sentencia; mas la Anschlussberufung si se plantea; costas a cargo de la otra parte.

## Salida

Borrador de la Berufungsantwort, lista de motivos con su respuesta, decision sobre Anschlussberufung y datos pendientes. Borrador para revision de un abogado.

## Datos que hay que pedir

- Recurso contrario.
- Sentencia.
- Fecha de entrega.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Respuesta motivo a motivo y decision sobre adhesion. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Olvidar que el plazo corre desde la entrega del recurso.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
