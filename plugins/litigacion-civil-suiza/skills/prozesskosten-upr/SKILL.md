---
name: prozesskosten-upr
description: "Estima costas y anticipos de un proceso civil suizo y prepara la solicitud de justicia gratuita. Usar con costas, Prozesskosten, anticipo, unentgeltliche Rechtspflege o justicia gratuita."
---

# Costas y asistencia juridica gratuita

## Base legal (lee cada articulo con `get_article`)

- Las costas comprenden costas judiciales e indemnizacion a la otra parte (Art. 95 Abs. 1 ZPO).
- Anticipo: en general hasta la mitad de las costas judiciales previsibles; hasta la totalidad en los casos del Art. 98 Abs. 2, entre ellos los recursos.
- Se imponen a la parte vencida, con reparto si nadie gana del todo (Art. 106).
- Asistencia gratuita si faltan medios y la pretension no esta desprovista de posibilidades (Art. 117); se pide antes o despues de iniciar el pleito exponiendo ingresos, patrimonio y el fondo del asunto (Art. 119).

## Pasos

1. Pide valor litigioso y canton; el importe exacto sale de la tarifa cantonal (`search_cantonal_legislation`).
2. Presenta un rango solo si la tarifa esta leida; si no, di que no se puede estimar.
3. Para la justicia gratuita lista justificantes de ingresos, gastos y patrimonio.
4. Explica que la gratuidad no cubre necesariamente la indemnizacion a la otra parte; verifica en el Art. 118.

## Reglas

- No inventes tarifas.
- Es un borrador para revision de una persona habilitada; no garantiza resultado.

## Datos que hay que pedir

- Valor litigioso.
- Canton.
- Ingresos y patrimonio.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Estimacion con fuentes y solicitud. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Inventar tarifas.
- Creer que cubre todo.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
