# Proveedor: SHAB / Amtsblattportal (`ShabProvider`)

Estado: implementado en Fase 5, **bloqueado por política de la fuente** (no por falta de capacidad técnica). Ver [`docs/provider-contracts/shab.md`](../provider-contracts/shab.md) para el contrato técnico completo y el ADR de bloqueo.

## Qué es

El Schweizerisches Handelsamtsblatt (SHAB, también FOSC en francés y FUSC en italiano — mismo sistema, no plataformas distintas) es la gaceta oficial suiza donde se publican, entre otros: mutaciones del Registro Mercantil, quiebras y procedimientos de ejecución, sucesiones, convocatorias judiciales y otros avisos oficiales. Opera sobre la plataforma "Amtsblattportal", que también aloja gacetas cantonales independientes (Amtsblatt/FAO) como tenants separados de la misma infraestructura.

## Por qué está bloqueado

La auditoría en vivo de Fase 5 confirmó que **tanto `shab.ch` como `amtsblattportal.ch` declaran `robots.txt: Disallow: /`** — un bloqueo total para cualquier agente automatizado, no una restricción parcial. La API JSON real que alimenta el propio frontend Angular de SHAB (`GET /api/v1/publications`, `/api/v1/rubrics`, `/api/v1/tenants`, todas verificadas reales y sin autenticación) no tiene documentación pública ni términos de uso que autoricen su reutilización por terceros. A diferencia de Zefix (que sí publica un Swagger oficial pensado para consumo externo), esta es la API interna de un sitio que explícitamente pide no ser accedido de forma automatizada.

Consistente con el principio de arquitectura ya establecido ("ningún scraper se construye sin verificar antes robots.txt"), `ShabProvider` se implementa con validación de configuración y `healthCheck()` completos, pero **nunca realiza una petición HTTP real** — su `healthCheck()` siempre devuelve `healthy: false` junto con `unavailableByPolicy: { reason: "robots_txt_disallow" }` (nunca se falsea como sano), análogo en seriedad al bloqueo de credenciales que tendría un futuro `ZefixProvider`.

## Qué SÍ se implementó

- El modelo de normalización (`shabPublication`, ver `docs/data-model.md`) y su mapper (`mapShabPublicationToNormalizedDocument`), probados contra las respuestas JSON reales capturadas durante la auditoría (con datos personales redactados) — listos para el día en que exista un canal de acceso autorizado.
- `ShabProvider.healthCheck()` devuelve siempre `healthy: false` con un mensaje explícito citando el bloqueo de `robots.txt`, sin intentar ninguna conexión de red.
- `search()`/`getDocument()` lanzan inmediatamente un error tipado explicando el bloqueo, sin llamar a `fetch`.

## Hallazgo importante: cobertura parcial de Zefix

Confirmado por fuente externa: Zefix solo re-publica las notificaciones SHAB de la rúbrica `HR` (Handelsregister) ligadas a una entidad inscrita. El resto de rúbricas reales de SHAB (quiebras, sucesiones, convocatorias judiciales, etc.) no tiene ninguna vía de acceso alternativa confirmada — no se debe asumir que Zefix sustituye a SHAB.

## Riesgo de privacidad verificado

La rúbrica de quiebras (`KK`) expone datos personales reales de individuos (nombre, fecha de nacimiento y defunción, domicilio) — un motivo adicional, más allá del bloqueo de `robots.txt`, para no construir ninguna vía de indexación masiva de esta fuente sin una autorización y un diseño de privacidad específicos.

## Herramientas MCP

`search_shab_publications`/`get_shab_publication` están **registradas** y **aparecen en `tools/list`**: a diferencia de una herramienta bloqueada por una caída transitoria de proveedor (que no se registra en absoluto), el servidor MCP (`apps/mcp-server/src/mcpServer.ts`) reconoce que `ShabProvider.healthCheck()` reporta `unavailableByPolicy` — un bloqueo permanente por cumplimiento, no una indisponibilidad temporal — y registra igualmente ambas herramientas en el SDK MCP para que el catálogo refleje su existencia real y su motivo de bloqueo, en vez de ocultarlas.

Al invocar cualquiera de las dos (`tools/call`), el servidor nunca llega al handler de la herramienta ni a `ShabProvider.searchDocuments()`/`fetchDocument()`: `ToolRegistry.call()` intercepta la llamada antes y devuelve un error MCP estructurado:

```json
{
  "code": "PROVIDER_UNAVAILABLE_BY_POLICY",
  "message": "El proveedor 'shab' no esta disponible por politica de cumplimiento (robots_txt_disallow).",
  "provider": "shab",
  "retryable": false,
  "details": {
    "reason": "robots_txt_disallow",
    "networkRequestPerformed": false
  }
}
```

`network_request_performed: false` no es una promesa de texto: es una garantía arquitectónica, porque el error se lanza antes de que se ejecute cualquier código que pudiera contactar con `shab.ch`. `robots.txt` se sigue respetando sin excepción, no hay scraping ni fallback de red, y `healthCheck()` nunca reporta `healthy: true` para este proveedor.
