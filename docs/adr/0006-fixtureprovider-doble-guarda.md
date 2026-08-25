# ADR 0006 — FixtureProvider con doble guarda (declarativa + en el constructor)

## Estado

Aceptado (Fase 1, 2026-07-26).

## Contexto

El encargo pide "un proveedor interno de prueba llamado FixtureProvider, habilitado únicamente en entorno test" y advierte repetidamente contra exponer herramientas o datos simulados como si fueran reales. Un único punto de control (solo la configuración del registro) se puede desactivar por error de configuración sin que nadie lo note.

## Decisión

`FixtureProvider` (`packages/providers/fixture/src/fixtureProvider.ts`) queda protegido en dos capas independientes:

1. **Declarativa**: se registra en `ProviderRegistry` con `enabledInEnv: ["test"]`; si el proceso no corre con `NODE_ENV=test`, el registro lo marca `disabled` y `ProviderRegistry.get()` devuelve `undefined`.
2. **Constructor**: `new FixtureProvider(env)` lanza `FixtureNotAllowedError` si `env !== "test"`, independientemente de que alguien lo instancie fuera del flujo normal de `buildRegistries()`.

Además, cada documento sintético que devuelve marca `provenance.officialCharacter: "unofficial_aggregator"` con `aggregatorName: "fixture-test-provider"`, para que sea imposible confundirlo con una fuente real incluso si apareciera en una respuesta por error.

## Consecuencias

- Cualquier intento de usar `FixtureProvider` en desarrollo o producción falla de forma ruidosa (excepción), no en silencio.
- La única herramienta que depende de él (`fixture_search_cases`, registrada en `apps/mcp-server/src/registry.ts` y `apps/admin-cli/src/registry.ts`) queda fuera del catálogo de las 38 herramientas MCP reales de `docs/tool-catalog.md`: es exclusivamente una fixture de infraestructura, no una herramienta jurídica candidata.
