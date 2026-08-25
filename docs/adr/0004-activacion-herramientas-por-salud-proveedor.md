# ADR 0004 — Activación de herramientas MCP condicionada a la salud del proveedor

## Estado

Aceptado (Fase 1, 2026-07-26).

## Contexto

El encargo exige que "una herramienta sin proveedor funcional debe quedar desactivada y documentada como pendiente", y que el registro de herramientas "permita habilitar herramientas únicamente cuando su proveedor esté disponible".

## Decisión

- `ProviderRegistry` (`packages/core/src/provider.ts`) mantiene un estado (`unknown` / `healthy` / `unhealthy` / `disabled`) por proveedor, actualizado por `checkHealth()`/`checkAllHealth()`, además de metadatos obligatorios: carácter oficial/no oficial, capacidades, idiomas, jurisdicciones y fecha del último control.
- `ToolRegistry` (`packages/core/src/toolRegistry.ts`) calcula el estado de cada herramienta (`active` / `pending` / `blocked`) a partir de si sus `requiredProviderIds` están registrados y en estado `healthy`. `pending` significa "el proveedor no está registrado todavía"; `blocked` significa "está registrado pero no está sano ahora mismo".
- `apps/mcp-server/src/mcpServer.ts` solo llama a `server.registerTool(...)` del SDK oficial para las herramientas cuyo estado es `active` en el momento de construir el servidor. Las demás ni siquiera aparecen en `tools/list` del protocolo MCP.
- Esta evaluación de "activo" se hace **una vez, al construir el servidor** (no dinámicamente en cada petición). Si un proveedor cambia de sano a no sano después de arrancar, las herramientas ya registradas en el `McpServer` seguirán apareciendo en `tools/list` hasta reiniciar el proceso; solo `GET /ready` refleja el estado de salud en tiempo real (vuelve a ejecutar `checkAllHealth()` en cada llamada).

## Consecuencias

- Es una limitación conocida de Fase 1: no hay re-registro dinámico de herramientas cuando un proveedor se recupera o se cae en caliente. Documentado en `IMPLEMENTATION_STATUS.md`.
- El único proveedor registrado en Fase 1 (`FixtureProvider`) solo existe con `NODE_ENV=test`, así que en producción/desarrollo el servidor arranca con cero herramientas activas — comportamiento correcto y esperado hasta Fase 2.
