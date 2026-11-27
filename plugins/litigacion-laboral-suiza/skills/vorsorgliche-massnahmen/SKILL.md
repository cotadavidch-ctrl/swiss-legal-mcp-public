---
name: vorsorgliche-massnahmen
description: "Prepara la solicitud de medidas cautelares civiles suizas, incluidas las urgentes sin oir a la otra parte, y su oposicion. Usar con medidas cautelares, vorsorgliche Massnahmen, superprovisorisch o prohibicion urgente."
---

# Medidas cautelares

## Base legal (lee cada articulo con `get_article`)

- Se conceden si se hace verosimil que un derecho esta violado o amenazado y que de ello resultaria un perjuicio dificilmente reparable (Art. 261 Abs. 1 ZPO; lee Abs. 2).
- Puede ordenarse cualquier medida idonea, como prohibiciones, cese de una situacion ilicita u ordenes a un registro (Art. 262).
- El tribunal puede exigir garantia, y quien las pide responde del dano en los supuestos de la ley (Art. 264).
- En caso de especial urgencia pueden ordenarse sin oir a la otra parte (Art. 265 Abs. 1).

## Pasos

1. Fija la medida exacta que se pide y por que es proporcionada.
2. Documenta apariencia de derecho, riesgo, urgencia y dano dificilmente reparable.
3. Si se pide sin audiencia, explica por que avisar frustraria la medida.
4. Advierte al usuario de la garantia y de su responsabilidad por el dano.
5. Para dinero, valora el embargo preventivo (`arrest`).

## Reglas

- Las deudas de dinero se aseguran por la via de la SchKG: comprueba antes de pedir medidas civiles.
- Tardar en pedirlas debilita la urgencia: dilo.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Derecho.
- Amenaza.
- Urgencia.
- Dano.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Solicitud con medida concreta. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Esperar demasiado.
- Medida desproporcionada.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
