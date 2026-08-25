# ADR 0011 — Resolución temporal determinista de versiones

## Estado

Aceptado e implementado (Fase 3, 2026-07-26).

## Contexto

`get_law` (fecha por defecto: hoy), `get_article`, `get_article_at_date` y `compare_article_versions` necesitan resolver, de forma determinista, qué `Consolidation` fechada de un acto era la vigente en una fecha arbitraria. Se verificó en vivo (38 Consolidations reales de la Constitución, 100 del Código de Obligaciones) que cada una expone `jolux:dateApplicability` (inicio) y opcionalmente `jolux:dateEndApplicability` (fin; ausente = todavía vigente o versión futura sin sucesora conocida).

## Decisión

`FedlexProvider.resolveConsolidationForDate()` implementa el algoritmo:

```
elegir la Consolidation donde dateApplicability <= fecha
  Y (dateEndApplicability ausente O dateEndApplicability >= fecha)
```

Si ninguna Consolidation cumple la condición (fecha anterior a la primera versión conocida, o hueco en los datos), se lanza `NotFoundError` explícito -- nunca se aproxima a la versión más cercana en silencio. `getArticleAtDate` además devuelve `evidence.chosenEli` y `evidence.reason` con el ELI y el intervalo de vigencia exactos que motivaron la elección, para que el resultado sea auditable por el usuario.

`isHistorical` se calcula como: la Consolidation elegida es la última del array ordenado por fecha Y no tiene `dateEndApplicability`. Cualquier otra combinación (incluida una versión futura ya programada sin sucesora, como la Constitución `2029-01-01` encontrada en la auditoría) se marca `isHistorical: false` solo si es la más reciente sin fin conocido; versiones intermedias se marcan siempre `true`.

## Consecuencias

- El algoritmo depende de que Fedlex mantenga los intervalos `dateApplicability`/`dateEndApplicability` sin solapamientos ni huecos dentro del rango cubierto -- verificado en la muestra auditada, pero no garantizado contractualmente por Fedlex. Si apareciera un solapamiento real, `Array.prototype.find` devolvería la primera coincidencia en orden ascendente, no necesariamente "la más específica".
- `get_article_at_date` hereda directamente esta resolución antes de intentar extraer el artículo; si la versión elegida no tiene manifestación XML (ver ADR 0012), la herramienta falla con `NotFoundError` en vez de aproximar con HTML.
