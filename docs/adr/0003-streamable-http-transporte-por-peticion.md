# ADR 0003 — Un `StreamableHTTPServerTransport` nuevo por cada petición HTTP

## Estado

Aceptado (Fase 1, 2026-07-26).

## Contexto

El diseño inicial de `apps/mcp-server` creaba **un único** `StreamableHTTPServerTransport` (modo stateless, `sessionIdGenerator: undefined`) al arrancar la app, conectado una sola vez a un `McpServer`, y reutilizado en cada `POST /mcp`. Al probarlo manualmente (`tsx src/http.ts` + peticiones reales), la segunda petición sobre el mismo transporte fallaba con `500` sin cuerpo de error útil.

Inspeccionando el código compilado del SDK (`@modelcontextprotocol/sdk/dist/esm/server/webStandardStreamableHttp.js`, línea 140) se encontró la causa exacta:

```
throw new Error('Stateless transport cannot be reused across requests. Create a new transport per request.');
```

El propio SDK exige explícitamente un transporte nuevo por petición en modo stateless; el ejemplo de su documentación (`app.post('/mcp', (req, res) => transport.handleRequest(...))`) solo ilustra la sintaxis de montaje de la ruta, no implica que el mismo objeto `transport` deba sobrevivir a más de una petición.

## Decisión

`routes/mcp.ts` crea un `StreamableHTTPServerTransport` efímero en cada invocación del handler, llama a `mcpServer.connect(transport)` (reenlazando el mismo `McpServer`, que sí es reutilizable) y luego `transport.handleRequest(req, res, req.body)`. El transporte se cierra en el evento `close` de la respuesta.

## Consecuencias

- `createHttpApp` ya no necesita ser `async` (no hay ninguna espera real durante la construcción de la app), lo que a su vez eliminó un error de lint (`require-await`).
- Reconectar el `McpServer` a un transporte nuevo en cada petición tiene un coste marginal aceptable en Fase 1; si el rendimiento importa en Fase 8, valorar el modo _stateful_ (`sessionIdGenerator` real) para clientes que mantengan una sesión larga.
- Cualquier código futuro que quiera "cachear" o reutilizar un transporte HTTP debe releer este ADR antes de hacerlo.
