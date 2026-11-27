---
name: conservacion-documentos
description: "Prepara la instruccion al cliente sobre que documentos y datos conservar y cuales pedir en un asunto suizo. Usar con que tengo que guardar, conservar pruebas o pedir documentos."
---

# Conservacion de pruebas

## Pasos

1. A partir del cuadro de prueba, lista documentos propios, de la otra parte y de terceros.
2. Pide conservar originales, sobres con matasellos, acuses, correos con cabeceras, mensajes y copias de seguridad, y suspender borrados automaticos.
3. Indica que prueba corre peligro de perderse; si procede, valora la practica anticipada (Art. 158 ZPO en civil; verificalo).
4. Redacta la carta al cliente en lenguaje claro, con fecha de revision.

## Reglas

- No aconsejes destruir, alterar ni ocultar nada.
- No sugieras obtener pruebas por medios ilicitos: en civil solo se admiten si el interes en la verdad prevalece (Art. 152 Abs. 2 ZPO).
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Hechos discutidos.
- Quien tiene cada documento.
- Borrados automaticos.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Carta al cliente con lista y plazos. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Dejar perder mensajes.
- Pedir pruebas de forma ilicita.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
