# syntax=docker/dockerfile:1
#
# Imagen de apps/mcp-server (transporte Streamable HTTP).
#
# Nota de Fase 1: cada paquete interno resuelve "main"/"types" directamente a
# su codigo fuente TypeScript (sin paso de build propio), asi que el runtime
# ejecuta el servidor via tsx en vez de un `node dist/...` con dist propio por
# paquete. Es la opcion mas simple para esta fase; una imagen mas ligera
# (compilacion a JS por paquete + install --prod) queda para la auditoria de
# rendimiento de Fase 8 (ver IMPLEMENTATION_STATUS.md).
FROM node:22.23.4-slim

RUN corepack enable
WORKDIR /workspace

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/mcp-server/package.json apps/mcp-server/package.json
COPY apps/admin-cli/package.json apps/admin-cli/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/documents/package.json packages/documents/package.json
COPY packages/search/package.json packages/search/package.json
COPY packages/citations/package.json packages/citations/package.json
COPY packages/providers/fixture/package.json packages/providers/fixture/package.json

# Se instala antes de fijar NODE_ENV=production para que pnpm no omita las
# devDependencies (tsx, typescript) que el runtime necesita en este esquema.
RUN pnpm install --frozen-lockfile

COPY . .

# Internal packages expose dist/index.js, required by the HTTP server.
RUN pnpm -r --if-present run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node_modules/.bin/tsx", "apps/mcp-server/src/http.ts"]
