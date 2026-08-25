# ADR 0001 — pnpm workspaces como gestor del monorepo

## Estado

Aceptado (Fase 1, 2026-07-26).

## Contexto

El proyecto requiere un monorepo con `apps/*` y `packages/*` (incluyendo `packages/providers/*` como subpaquetes). Node.js ya trae `npm`, pero `pnpm` estaba disponible en la máquina de desarrollo (`pnpm --version` funcionando) y ofrece instalación por enlaces simbólicos (menos duplicación de `node_modules`) y soporte nativo de `workspace:*` para dependencias internas.

## Decisión

Usar `pnpm` (v11.17.0, gestionado vía `packageManager` en `package.json` y corepack) con `pnpm-workspace.yaml` listando `apps/*`, `packages/*` y `packages/providers/*`.

## Consecuencias

- Cada paquete interno se referencia como `"@swiss-legal-mcp/xxx": "workspace:*"`.
- CI y Docker deben tener pnpm disponible (`pnpm/action-setup` en GitHub Actions; `corepack enable` en el Dockerfile).
- No se evaluaron alternativas (npm workspaces, Turborepo, Nx) en profundidad: pnpm ya estaba disponible y cumple los requisitos de Fase 1 sin añadir herramientas adicionales.
