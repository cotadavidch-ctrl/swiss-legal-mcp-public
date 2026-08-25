# tests/

Este directorio es para pruebas de integración que abarcan más de un `app`/`package` a la vez.

En Fase 1 no existe ninguna: las pruebas unitarias e de integración de cada paquete o app viven junto a su código (`packages/*/src/*.test.ts`, `apps/*/tests/`), que es donde Vitest ya las descubre (ver `vitest.config.ts` en la raíz). Este directorio queda reservado para cuando una prueba necesite orquestar varios servicios a la vez (por ejemplo, un proveedor real + el servidor MCP + PostgreSQL en Fases 2+).
