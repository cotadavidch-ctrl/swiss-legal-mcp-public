# ADR 0002 — TypeScript 6.0.3 (no 7.0.2) y sin `exactOptionalPropertyTypes`

## Estado

Aceptado (Fase 1, 2026-07-26).

## Contexto

Al configurar el monorepo se instaló inicialmente `typescript@7.0.2` (la versión `latest` de npm en el momento de la auditoría), con `exactOptionalPropertyTypes: true` en `tsconfig.base.json` como parte de "TypeScript estricto".

Dos incompatibilidades reales aparecieron al integrar herramientas obligatorias del encargo:

1. **`typescript-eslint@8.65.0` rechaza TypeScript 7.0** en tiempo de ejecución (`Error: typescript-eslint does not support TS 7.0`), y no existe todavía ninguna versión publicada de `typescript-eslint` que lo soporte (TypeScript 7 es la reescritura nativa del compilador, publicada como nueva major muy recientemente).
2. **El SDK oficial de MCP (`@modelcontextprotocol/sdk@1.29.0`) no es compatible con `exactOptionalPropertyTypes: true`**: su propia documentación de ejemplo usa `sessionIdGenerator: undefined` para el modo stateless, y sus interfaces (`Transport`, `WebStandardStreamableHTTPServerTransportOptions`) declaran miembros opcionales sin el `| undefined` explícito que `exactOptionalPropertyTypes` exige para permitir esa asignación.

## Decisión

- Fijar `typescript` en `6.0.3` (última versión estable de la serie anterior a la 7.x) en todos los `package.json` del monorepo, para que `typescript-eslint` funcione.
- Quitar `exactOptionalPropertyTypes` de `tsconfig.base.json`, manteniendo el resto de `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature` y `forceConsistentCasingInFileNames`.

## Consecuencias

- El proyecto sigue siendo estricto (todas las demás banderas de `strict` activas), pero sin la variante más agresiva de propiedades opcionales, que resultó incompatible con el propio SDK oficial que el encargo exige usar.
- Revisar esta decisión cuando `typescript-eslint` publique soporte para TypeScript 7.x, o cuando el SDK de MCP corrija sus tipos para `exactOptionalPropertyTypes`.
- Varios tipos internos (`ProviderEntry.lastCheckedAt`, `SearchResult.snippet`, etc.) quedaron declarados como `T | undefined` explícito en vez de `T?` — se mantiene así aunque ya no sea obligatorio, porque documenta la intención sin coste.
