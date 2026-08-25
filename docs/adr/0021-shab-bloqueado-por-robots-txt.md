# ADR 0021 — `ShabProvider` implementado pero bloqueado por `robots.txt`

## Estado

Aceptado e implementado (Fase 5, 2026-07-27).

## Contexto

La auditoría en vivo confirmó que SHAB opera una API JSON real, pública y sin autenticación (`GET /api/v1/publications`, `/api/v1/rubrics`, `/api/v1/tenants`), verificada por inspección de red directa contra el frontend Angular oficial. Sin embargo, **tanto `shab.ch` como `amtsblattportal.ch` (mismo backend, distintos alias de dominio) declaran `robots.txt: Disallow: /` para todo user-agent** — un bloqueo total, no una restricción parcial ni específica de crawlers de buscadores. No se encontró documentación pública (Swagger/OpenAPI) ni términos de uso que autoricen la reutilización de esta API por terceros — a diferencia de Zefix, cuya API sí está pensada y documentada para consumo externo.

El principio de arquitectura ya establecido desde Fase 0 ("ningún scraper se construye sin verificar antes robots.txt, términos de uso y licencia") es inequívoco ante este hallazgo. Se consultó explícitamente con el usuario antes de decidir cómo proceder.

## Decisión

1. `ShabProvider` (`packages/providers/shab`) se implementa completo a nivel de interfaz (`LegalSourceProvider`) pero **nunca realiza una petición HTTP real**:
   - `healthCheck()` devuelve siempre `{ healthy: false }` con el motivo explícito citando `robots.txt`, sin intentar ninguna conexión.
   - `search`/`getDocument`/`getMetadata`/`getSourceAttribution` lanzan inmediatamente `ProviderUnavailableError` con el mismo mensaje, sin construir ninguna petición de red.
   - `normalize()` es la única operación real: no requiere red, y se prueba contra datos reales capturados durante la auditoría (ver ADR 0020).
2. `ShabProvider` se registra igualmente en `ProviderRegistry` (no se omite su registro) para que `tools/list`/`admin-cli` reflejen su existencia y el motivo exacto del bloqueo, en vez de que la fuente simplemente "no aparezca". Esto es deliberadamente distinto de omitir el registro: un operador que consulte el estado del sistema ve `shab: unhealthy` con una razón clara, no un silencio.
3. `search_shab_publications`/`get_shab_publication` se registran en `ToolRegistry` con `requiredProviderIds: ["shab"]`. Como `healthCheck()` siempre falla, `ToolRegistry.activation()` las marca `blocked` de forma permanente — nunca `active`. Esto reutiliza el mecanismo de activación ya existente (ver ADR 0004) sin necesitar lógica nueva.
4. Se documenta además, como hallazgo relacionado, que Zefix solo re-publica las notificaciones SHAB de rúbrica `HR` (Handelsregister) ligadas a una entidad inscrita — el resto de rúbricas reales (`KK`, `NA`, etc.) no tiene ninguna vía de acceso alternativa confirmada.

## Consecuencias

- Ningún dato de SHAB se sirve nunca desde este sistema en su estado actual, incluso si un operador configura credenciales o intenta forzar el uso — el bloqueo está en el código, no solo en la documentación.
- Si en el futuro SECO/BJ publican una API oficial documentada para SHAB (análoga a la de Zefix), o se obtiene autorización explícita por otra vía, el trabajo de normalización (ADR 0020) ya está listo; solo haría falta implementar las llamadas de red reales y eliminar el bloqueo explícito.
- La rúbrica `KK` (quiebras/sucesiones) expone datos personales reales de individuos — un motivo adicional, independiente del bloqueo de `robots.txt`, para que cualquier implementación futura incluya un diseño de privacidad específico antes de activarse (ver ADR 0020).
