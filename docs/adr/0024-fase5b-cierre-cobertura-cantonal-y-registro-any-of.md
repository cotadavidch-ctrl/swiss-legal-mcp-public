# ADR 0024 — Cierre de Fase 5: cobertura de los 26 cantones y activación "al menos uno" en ToolRegistry

## Estado

Aceptado e implementado (Fase 5B, 2026-07-27).

## Contexto

ADR 0022 documentó la decisión de Fase 5A de auditar una muestra representativa (5 cantones) e implementar solo 2 adaptadores, dejando 24 cantones como inventario pendiente. El usuario indicó explícitamente que esa entrega era una "Fase 5A" y exigió cerrar el alcance completo: auditar en vivo los 21 cantones restantes, clasificarlos por familia técnica, implementar la máxima cobertura verificable, y entregar una matriz de los 26 cantones con evidencia real — sin avanzar a Fase 6 hasta entonces.

## Decisión

1. **Auditoría en vivo de los 21 cantones restantes** mediante 4 agentes de investigación en paralelo (WebFetch/WebSearch/curl reales, nunca simulados), verificando para cada uno: portal oficial, familia técnica (título de página "LexWork" + prueba directa de `/api/{lang}/systematic_categories`), `robots.txt` real, y un ejemplo concreto cuando fue posible.
2. **Hallazgo decisivo**: 19 de los 26 cantones (BE, LU, UR, OW, NW, GL, ZG, SH, AR, AI, SG, GR, AG, TG, SO, BS, BL, FR, VS) comparten la plataforma LexWork con un contrato de API idéntico letra por letra (mismos parámetros, misma forma de respuesta, mismo patrón de `robots.txt`). Se generalizó `CantonalLexWorkProvider` (ya parametrizado desde Fase 5A) a los 19 mediante un descriptor de datos (`LEXWORK_CANTONS`), sin duplicar código.
3. **Ampliación real de capacidades del adaptador LexWork**, descubiertas durante la propia auditoría de cierre (no asumidas de antemano): el endpoint de detalle real `texts_of_law/{numero}/show_as_json` permite texto completo de la versión vigente **y** extracción de artículo individual (árbol de contenido recursivo real con nodos `type: "article"`) — esto justificó activar `get_cantonal_law` y `get_cantonal_article` para los 19 cantones, no solo el catálogo como en Fase 5A.
4. **Ampliación de `CantonalZhProvider`**: se descubrió el servlet JSON real de búsqueda de ZH-Lex (inspección de red sobre el formulario real), con parámetros reales confirmados (`referenceNumber`, `enactmentTitle`) y alternativas descartadas explícitamente (`keyword`/`query`/`text`/`q` no tienen efecto real) — se activó `search_cantonal_legislation` para Zúrich.
5. **Jurisprudencia cantonal**: en vez de auditar 26 portales de jurisprudencia individuales, se verificó en vivo que `entscheidsuche.ch` (fuente ya aceptada por la arquitectura desde Fase 2) ya indexa jurisprudencia real de los 26 cantones (conteos reales verificados, `list_hierarchy` con `size=2000`). Esto satisface el criterio "jurisprudencia... cuando exista... una fuente ya aceptada" para los 26 cantones sin construir 26 scrapers dedicados.
6. **Extensión de `ToolRegistry` (`packages/core`)**: se añadió el campo opcional `requireAnyProviderIds` a `ToolDefinition`, con semántica "al menos uno de estos proveedores debe estar `healthy`" (a diferencia de `requiredProviderIds`, que exige que **todos** lo estén). Esto es necesario porque las herramientas cantonales ahora dependen de 20 proveedores posibles (19 LexWork + ZH) y deben activarse en cuanto exista al menos uno disponible, no todos. Cambio retrocompatible: los tools existentes que no usan el campo nuevo no cambian de comportamiento.
7. **Herramientas canton-aware**: `search_cantonal_legislation`/`get_cantonal_law`/`get_cantonal_article` requieren el parámetro `canton` y cada respuesta incluye `canton`/`provider`/`family`/`capabilities`/`coverage`/`limitations`/`officialSource`/`retrievedAt` — nunca se declara soporte universal. Un canton sin proveedor implementado devuelve un error explícito que enumera los cantones sí soportados.
8. **6 cantones quedan sin legislación implementada, con evidencia real de por qué**: SZ (HTML/PDF sin API), NE y JU (sistema propio ASP.NET sin API JSON), TI y VD (bloqueo de acceso real, HTTP 403 / dominio restringido), GE (HTML complejo con frames/JS legado).
9. **Corrección de esquema por evidencia observada**: al verificar en vivo los 19 cantones (no solo Berna), se encontraron dos campos reales que pueden ser `null` (`structured_document_id` en el índice, `uid` en nodos del árbol de contenido) — los esquemas Zod se corrigieron tras observar el dato real, no por conveniencia.
10. **Corrección de dominio para Fribourg**: el dominio de infraestructura del vendor (`fr.lexwork.naz.ch`), funcional en la auditoría inicial, dejó de responder (404) al verificar en la implementación; se usa el dominio oficial de gobierno (`bdlf.fr.ch`), verificado funcional de forma consistente.

## Consecuencias

- 20 de 26 cantones tienen legislación implementada y probada en vivo (19 LexWork completos + Zúrich parcial); los 26 tienen jurisprudencia cubierta vía el agregador ya aceptado.
- El campo `requireAnyProviderIds` en `ToolRegistry` queda disponible para cualquier futura herramienta con múltiples proveedores alternativos (no exclusivo de cantones).
- La cobertura de artículo individual (`get_cantonal_article`) es explícitamente asimétrica: real para los 19 LexWork, explícitamente no soportada para Zúrich — la herramienta lo comunica en cada respuesta de error, no lo oculta.
- Deuda técnica restante, documentada sin ambigüedad: SZ/NE/JU/GE requerirían scrapers HTML dedicados (fuera de esta fase); TI/VD siguen bloqueados por acceso; texto completo de versiones antiguas/futuras de leyes LexWork no está verificado; búsqueda de artículo en Zúrich no implementada.
