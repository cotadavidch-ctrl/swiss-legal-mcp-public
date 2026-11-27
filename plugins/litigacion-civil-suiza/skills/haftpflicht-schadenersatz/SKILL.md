---
name: haftpflicht-schadenersatz
description: "Analiza una reclamacion de danos extracontractual suiza: requisitos, prueba y prescripcion. Usar con danos, responsabilidad civil, Schadenersatz, Genugtuung o accidente."
---

# Responsabilidad por danos

## Base legal (lee cada articulo con `get_article`)

- Quien dana ilicitamente a otro, con intencion o negligencia, debe repararlo; tambien quien dana intencionadamente de forma contraria a las buenas costumbres (Art. 41 OR).
- La accion prescribe a los tres anos desde el conocimiento del dano y del responsable, con un plazo absoluto (Art. 60; lee los plazos largos y el caso de delito).

## Pasos

1. Separa dano, ilicitud, culpa y nexo causal, con prueba de cada uno.
2. Comprueba si hay responsabilidad contractual o una ley especial que prevalezca.
3. Cuantifica solo lo documentado y distingue indemnizacion y reparacion moral.
4. Controla prescripcion y posibles seguros.

## Reglas

- No des por probada la causalidad medica o tecnica sin informe.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Hecho.
- Dano documentado.
- Responsables.
- Seguros.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Analisis por requisitos y reclamacion. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Probar el dano sin el nexo causal.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
