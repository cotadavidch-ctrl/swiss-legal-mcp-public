---
name: sozialversicherung-atsg
description: "Maneja un caso de seguros sociales suizo (ATSG): oposicion (Einsprache), recurso cantonal, informes medicos y deber de colaboracion. Usar con SUVA, AHV, IV, desempleo, Einsprache, aseguradora o Versicherungsgericht."
---

# Seguros sociales (ATSG)

## Via y plazos (cada articulo con `get_article`)

1. **Einsprache** contra la resolucion (Verfuegung): 30 dias, ante la propia aseguradora o autoridad que resolvio (Art. 52 Abs. 1 ATSG). El procedimiento de oposicion es gratuito y la decision debe estar motivada y llevar instruccion de recursos (Abs. 2 y 3). Plazo con `compute_legal_deadline` (`ATSG_EINSPRACHE`).
2. **Beschwerde** contra la decision sobre la oposicion: 30 dias desde su notificacion, ante el tribunal cantonal de seguros, que cada canton designa como instancia unica (Art. 57 ATSG); admisibilidad y plazo en los Art. 56 y 60 (`ATSG_BESCHWERDE`). Tambien cabe si la aseguradora no resuelve (Art. 56 Abs. 2). El procedimiento cantonal lo regula el derecho cantonal con las exigencias del Art. 61 ATSG.
3. Despues, Beschwerde al Tribunal Federal (`beschwerde-bgg`).

## Computo de plazos (Art. 38 ATSG, verifica con `get_article`)

El plazo empieza el dia siguiente a la comunicacion. Una comunicacion que solo se entrega contra firma se considera notificada, como tarde, el septimo dia tras el primer intento de entrega fallido (Art. 38 Abs. 2bis ATSG): si hubo aviso de recogida, pasa `firstDeliveryAttemptDate` a `compute_legal_deadline`. Las reglas de suspension de plazos estan en los Art. 38 a 41 ATSG y la herramienta ya las aplica.

## Que hay que revisar de fondo

- **Abklaerung de oficio**: la aseguradora investiga y fija el alcance de las pruebas (Art. 43 ATSG); las personas aseguradas deben colaborar con examenes razonables. Comprueba si faltan pruebas que debia obtener.
- **Peritajes medicos**: tipo de peritaje y requisitos de independencia (Art. 44 ATSG). Contrasta informes de la aseguradora, del medico tratante y de peritos, y sus contradicciones, con `cronologia-y-prueba`.
- **Peticion concreta**: prestacion, periodo y cuantia que se reclama, y si hay efecto suspensivo.

## Pasos

1. Abre el asunto (`alta-asunto`, materia `social-insurance`).
2. Fecha de notificacion y prueba de la misma (`plazos-y-via`).
3. Cuadro de prueba medica y cronologia (`cronologia-y-prueba`), marcando contradicciones entre informes.
4. Estrategia con `analyze_procedural_strategy`; consejo de cinco voces con `prepare_legal_council` si hay riesgo.
5. Redaccion y control de citas (`revision-citas`).

## Reglas

- No des por probada una afirmacion medica de una sola de las partes.
- No cites sentencias que no hayas leido.
- Un resultado por plazo calculado es orientativo; la fecha de la instruccion de recursos prevalece si la ley no dice otra cosa, pero avisa de cualquier diferencia.

## Datos que hay que pedir

- Decision.
- Notificacion.
- Informes medicos.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Oposicion o recurso y cuadro medico. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Fiarse de un solo informe.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
